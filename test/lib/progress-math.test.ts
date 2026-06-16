import {expect} from 'chai'

import {AUTH0_SEARCH_MAX_RESULTS} from '@/lib/auth0/pagination'
import {
  computeFetchProgressTotal,
  normalizeTaskTotal,
  runWithSpinner,
  stopProgressBar,
} from '@/lib/progress'

describe('progress helpers', () => {
  describe('computeFetchProgressTotal', () => {
  it('caps totals at the Auth0 search limit', () => {
    expect(
      computeFetchProgressTotal(
        {collected: 500, page: 0, rawCount: 100, total: 5000},
        undefined,
      ),
    ).to.deep.equal({
      total: AUTH0_SEARCH_MAX_RESULTS,
      value: 500,
    })
  })

  it('respects an explicit fetch limit', () => {
    expect(
      computeFetchProgressTotal(
        {collected: 40, page: 0, rawCount: 20, total: 200},
        50,
      ),
    ).to.deep.equal({total: 50, value: 40})
  })

  it('never reports zero total or value above total', () => {
    expect(
      computeFetchProgressTotal({collected: 0, page: 0, rawCount: 0, total: 0}, undefined),
    ).to.deep.equal({total: 1, value: 0})

    expect(
      computeFetchProgressTotal({collected: 999, page: 0, rawCount: 100, total: 10}, 5),
    ).to.deep.equal({total: 5, value: 5})
  })

  it('uses the smaller of fetch limit and Auth0 cap', () => {
    expect(
      computeFetchProgressTotal(
        {collected: 100, page: 0, rawCount: 100, total: AUTH0_SEARCH_MAX_RESULTS + 100},
        AUTH0_SEARCH_MAX_RESULTS + 500,
      ),
    ).to.deep.equal({
      total: AUTH0_SEARCH_MAX_RESULTS,
      value: 100,
    })
  })
  })

  describe('normalizeTaskTotal', () => {
    it('never returns zero', () => {
      expect(normalizeTaskTotal(0)).to.equal(1)
      expect(normalizeTaskTotal(5)).to.equal(5)
    })
  })

  describe('runWithSpinner', () => {
    it('starts and stops the spinner around the task', async () => {
      const events: string[] = []
      const spinner = {
        start(message: string) {
          events.push(`start:${message}`)
        },
        stop(message: string) {
          events.push(`stop:${message}`)
        },
      }

      const value = await runWithSpinner(
        'Working',
        async () => 'done',
        'Finished',
        spinner,
      )

      expect(value).to.equal('done')
      expect(events).to.deep.equal(['start:Working', 'stop:Finished'])
    })

    it('reuses the start message when no done message is provided', async () => {
      const events: string[] = []
      const spinner = {
        start(message: string) {
          events.push(message)
        },
        stop(message: string) {
          events.push(message)
        },
      }

      await runWithSpinner('Working', async () => 1, undefined, spinner)
      expect(events).to.deep.equal(['Working', 'Working'])
    })

    it('stops the spinner when the task throws', async () => {
      const stops: string[] = []
      const spinner = {
        start() {},
        stop(message: string) {
          stops.push(message)
        },
      }

      try {
        await runWithSpinner(
          'Working',
          async () => {
            throw new Error('fail')
          },
          undefined,
          spinner,
        )
        expect.fail('Expected runWithSpinner to throw')
      } catch (error) {
        expect((error as Error).message).to.equal('fail')
      }

      expect(stops).to.deep.equal(['Working'])
    })
  })

  describe('stopProgressBar', () => {
    it('is a no-op when bar is undefined', () => {
      expect(() => stopProgressBar(undefined)).to.not.throw()
    })

    it('stops an existing bar', () => {
      let stopped = false
      stopProgressBar({stop: () => { stopped = true }} as never)
      expect(stopped).to.equal(true)
    })
  })
})
