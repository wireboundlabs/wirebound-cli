import {action} from '@oclif/core/ux'
import cliProgress from 'cli-progress'

import {AUTH0_SEARCH_MAX_RESULTS} from '@/lib/auth0/pagination'

export interface PageProgressInfo {
  collected: number
  page: number
  rawCount: number
  total: number
}

export interface ProgressContext {
  enabled: boolean
}

export interface ProgressReporter {
  fetchPage(info: PageProgressInfo): void
  fetchStart(label: string, limit?: number): void
  fetchStop(): void
  spinAsync<T>(message: string, fn: () => Promise<T>, doneMessage?: string): Promise<T>
  taskAdvance(): void
  taskStart(label: string, total: number): void
  taskStop(): void
}

export function createProgressContext(options: {
  json?: boolean
  verbose?: boolean
}): ProgressContext {
  return {
    enabled: Boolean(process.stderr.isTTY) && !options.json && !options.verbose,
  }
}

const noopReporter: ProgressReporter = {
  fetchPage() {},
  fetchStart() {},
  fetchStop() {},
  async spinAsync(_message, fn) {
    return fn()
  },
  taskAdvance() {},
  taskStart() {},
  taskStop() {},
}

export function createProgressReporter(context: ProgressContext): ProgressReporter {
  if (!context.enabled) {
    return noopReporter
  }

  return new TerminalProgressReporter()
}

class TerminalProgressReporter implements ProgressReporter {
  private bar?: cliProgress.SingleBar
  private fetchLimit?: number

  fetchStart(label: string, limit?: number): void {
    this.stopBar()
    this.fetchLimit = limit
    this.bar = new cliProgress.SingleBar(
      {
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        clearOnComplete: true,
        format: '{label} |{bar}| {percentage}% | {value}/{total}',
        hideCursor: true,
      },
      cliProgress.Presets.legacy,
    )
    this.bar.start(1, 0, {label})
  }

  fetchPage(info: PageProgressInfo): void {
    if (!this.bar) {
      return
    }

    const cappedTotal = Math.min(info.total, AUTH0_SEARCH_MAX_RESULTS)
    const total =
      this.fetchLimit === undefined
        ? cappedTotal
        : Math.min(this.fetchLimit, cappedTotal)

    if (this.bar.getTotal() !== total) {
      this.bar.setTotal(Math.max(total, 1))
    }

    this.bar.update(Math.min(info.collected, total))
  }

  fetchStop(): void {
    this.stopBar()
    this.fetchLimit = undefined
  }

  taskStart(label: string, total: number): void {
    this.stopBar()
    this.bar = new cliProgress.SingleBar(
      {
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        clearOnComplete: true,
        format: '{label} |{bar}| {percentage}% | {value}/{total}',
        hideCursor: true,
      },
      cliProgress.Presets.legacy,
    )
    this.bar.start(Math.max(total, 1), 0, {label})
  }

  taskAdvance(): void {
    this.bar?.increment()
  }

  taskStop(): void {
    this.stopBar()
  }

  async spinAsync<T>(
    message: string,
    fn: () => Promise<T>,
    doneMessage?: string,
  ): Promise<T> {
    this.stopBar()
    action.start(message)

    try {
      return await fn()
    } finally {
      action.stop(doneMessage ?? message)
    }
  }

  private stopBar(): void {
    if (!this.bar) {
      return
    }

    this.bar.stop()
    this.bar = undefined
  }
}
