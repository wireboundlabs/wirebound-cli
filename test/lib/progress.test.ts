import {expect} from 'chai'

import {AUTH0_SEARCH_MAX_RESULTS} from '@/lib/auth0/pagination'
import {
  createProgressContext,
  createProgressReporter,
  type ProgressReporter,
} from '@/lib/progress'

describe('progress', () => {
  describe('createProgressContext', () => {
    let originalIsTTY: boolean | undefined

    beforeEach(() => {
      originalIsTTY = process.stderr.isTTY
    })

    afterEach(() => {
      Object.defineProperty(process.stderr, 'isTTY', {
        configurable: true,
        value: originalIsTTY,
      })
    })

    it('disables progress for json output', () => {
      expect(createProgressContext({json: true, verbose: false}).enabled).to.equal(false)
    })

    it('disables progress for verbose output', () => {
      expect(createProgressContext({json: false, verbose: true}).enabled).to.equal(false)
    })

    it('enables progress on a TTY without json or verbose', () => {
      Object.defineProperty(process.stderr, 'isTTY', {
        configurable: true,
        value: true,
      })

      expect(createProgressContext({json: false, verbose: false}).enabled).to.equal(true)
    })

    it('disables progress when stderr is not a TTY', () => {
      Object.defineProperty(process.stderr, 'isTTY', {
        configurable: true,
        value: false,
      })

      expect(createProgressContext({json: false, verbose: false}).enabled).to.equal(false)
    })
  })

  describe('noop reporter', () => {
    it('returns a no-op reporter when progress is disabled', async () => {
      const reporter = createProgressReporter({enabled: false})

      reporter.fetchStart('Finding users', 10)
      reporter.fetchPage({collected: 5, page: 0, rawCount: 5, total: 10})
      reporter.fetchStop()
      reporter.taskStart('Blocking users', 3)
      reporter.taskAdvance()
      reporter.taskStop()

      const value = await reporter.spinAsync('Working', async () => 'done')
      expect(value).to.equal('done')
    })
  })

  describe('terminal reporter', () => {
    let reporter: ProgressReporter

    beforeEach(() => {
      reporter = createProgressReporter({enabled: true})
    })

    it('runs fetch progress with limits and Auth0 caps', () => {
      reporter.fetchStart('Finding users', 50)
      reporter.fetchPage({collected: 25, page: 0, rawCount: 25, total: 200})
      reporter.fetchPage({collected: 50, page: 1, rawCount: 25, total: 200})
      reporter.fetchStop()
    })

    it('ignores fetchPage before fetchStart', () => {
      reporter.fetchPage({collected: 1, page: 0, rawCount: 1, total: 10})
    })

    it('caps fetch totals at the Auth0 search limit', () => {
      reporter.fetchStart('Scanning users')
      reporter.fetchPage({
        collected: AUTH0_SEARCH_MAX_RESULTS,
        page: 9,
        rawCount: 100,
        total: AUTH0_SEARCH_MAX_RESULTS + 500,
      })
      reporter.fetchStop()
    })

    it('runs task progress and spinAsync', async () => {
      reporter.taskStart('Deleting users', 2)
      reporter.taskAdvance()
      reporter.taskAdvance()
      reporter.taskStop()

      const value = await reporter.spinAsync(
        'Resolving organization',
        async () => 'org_123',
        'Resolved organization',
      )
      expect(value).to.equal('org_123')
    })

    it('reuses spinAsync without a custom done message', async () => {
      const value = await reporter.spinAsync('Working', async () => 1)
      expect(value).to.equal(1)
    })
  })
})
