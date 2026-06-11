import Bottleneck from 'bottleneck'

import {HttpError} from './http-error.js'

export type GetRetryDelayMs = (error: unknown) => number | undefined

export interface RateLimiterOptions {
  rps: number
  maxRetries?: number
  getRetryDelayMs?: GetRetryDelayMs
  onRetry?: (message: string) => void
}

function defaultAuth0RetryDelayMs(error: unknown): number | undefined {
  if (!(error instanceof HttpError) || error.status !== 429) {
    return undefined
  }

  const resetHeader = error.headers.get('x-ratelimit-reset')
  if (!resetHeader) return 1000

  const resetEpoch = Number.parseInt(resetHeader, 10)
  if (Number.isNaN(resetEpoch)) return 1000

  const waitMs = Math.max(0, resetEpoch * 1000 - Date.now())
  const jitter = 50 + Math.floor(Math.random() * 150)
  return waitMs + jitter
}

export class RateLimiter {
  private readonly limiter: Bottleneck
  private readonly maxRetries: number
  private readonly getRetryDelayMs: GetRetryDelayMs
  private readonly onRetry?: (message: string) => void

  constructor(options: RateLimiterOptions) {
    const minTime = Math.ceil(1000 / options.rps)
    this.maxRetries = options.maxRetries ?? 5
    this.getRetryDelayMs = options.getRetryDelayMs ?? defaultAuth0RetryDelayMs
    this.onRetry = options.onRetry

    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime,
    })

    this.limiter.on('failed', async (error, jobInfo) => {
      if (jobInfo.retryCount >= this.maxRetries) return

      const delayMs = this.getRetryDelayMs(error)
      if (delayMs === undefined) return

      this.onRetry?.(
        `Rate limited (attempt ${jobInfo.retryCount + 1}/${this.maxRetries}); retrying in ${delayMs}ms`,
      )
      return delayMs
    })
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter.schedule(fn)
  }
}
