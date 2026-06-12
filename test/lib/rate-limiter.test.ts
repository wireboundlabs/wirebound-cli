import {expect} from 'chai'

import {HttpError} from '../../src/lib/http-error.js'
import {RateLimiter} from '../../src/lib/rate-limiter.js'

describe('RateLimiter', () => {
  it('retries when getRetryDelayMs returns a delay', async () => {
    let attempts = 0
    let retried = false
    const messages: string[] = []

    const limiter = new RateLimiter({
      getRetryDelayMs: (error) => {
        if (!retried && error instanceof HttpError && error.status === 429) {
          retried = true
          return 1
        }
        return undefined
      },
      maxRetries: 2,
      onRetry: (message) => messages.push(message),
      rps: 100,
    })

    const result = await limiter.schedule(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new HttpError(429, new Headers({'x-ratelimit-reset': '0'}), 'rate limited')
      }
      return 'ok'
    })

    expect(result).to.equal('ok')
    expect(attempts).to.equal(2)
    expect(messages).to.have.length(1)
  })

  it('does not retry non-429 errors', async () => {
    const limiter = new RateLimiter({maxRetries: 3, rps: 100})

    try {
      await limiter.schedule(async () => {
        throw new HttpError(500, new Headers(), 'server error')
      })
      expect.fail('expected schedule to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
      expect((error as HttpError).status).to.equal(500)
    }
  })
})
