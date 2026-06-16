import {expect} from 'chai'

import {HttpError} from '@/lib/http-error'
import {
  defaultAuth0RetryDelayMs,
  parseRateLimitResetMs,
  RateLimiter,
} from '@/lib/rate-limiter'

describe('RateLimiter', () => {
  it('parseRateLimitResetMs uses future reset epochs', () => {
    const future = `${Math.floor(Date.now() / 1000) + 10}`
    expect(parseRateLimitResetMs(new Headers({'x-ratelimit-reset': future}))).to.be.greaterThan(0)
    expect(parseRateLimitResetMs(new Headers())).to.equal(1000)
    expect(parseRateLimitResetMs(new Headers({'x-ratelimit-reset': 'bad'}))).to.equal(1000)
  })

  it('defaultAuth0RetryDelayMs ignores non-429 errors', () => {
    expect(defaultAuth0RetryDelayMs(new HttpError(500, new Headers(), 'fail'))).to.equal(undefined)
    expect(
      defaultAuth0RetryDelayMs(new HttpError(429, new Headers(), 'rate limited')),
    ).to.be.greaterThan(1000)
  })

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

  it('retries 429 responses without an onRetry handler', async () => {
    let attempts = 0
    const limiter = new RateLimiter({maxRetries: 2, rps: 100})

    const result = await limiter.schedule(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new HttpError(429, new Headers(), 'rate limited')
      }
      return 'ok'
    })

    expect(result).to.equal('ok')
    expect(attempts).to.equal(2)
  })

  it('falls back to 1000ms when rate limit reset header is missing', async () => {
    let attempts = 0

    const limiter = new RateLimiter({maxRetries: 2, rps: 100})

    const result = await limiter.schedule(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new HttpError(429, new Headers(), 'rate limited')
      }
      return 'ok'
    })

    expect(result).to.equal('ok')
    expect(attempts).to.equal(2)
  })

  it('does not schedule a retry when getRetryDelayMs returns undefined', async () => {
    const limiter = new RateLimiter({
      getRetryDelayMs: () => undefined,
      maxRetries: 3,
      onRetry: () => expect.fail('onRetry should not run'),
      rps: 100,
    })

    try {
      await limiter.schedule(async () => {
        throw new HttpError(429, new Headers(), 'rate limited')
      })
      expect.fail('expected schedule to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
    }
  })

  it('stops retrying after maxRetries is exceeded', async () => {
    const limiter = new RateLimiter({
      getRetryDelayMs: () => 1,
      maxRetries: 1,
      rps: 100,
    })

    try {
      await limiter.schedule(async () => {
        throw new HttpError(429, new Headers(), 'rate limited')
      })
      expect.fail('expected schedule to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
      expect((error as HttpError).status).to.equal(429)
    }
  })

  it('ignores invalid rate limit reset headers', async () => {
    let attempts = 0

    const limiter = new RateLimiter({maxRetries: 2, rps: 100})

    const result = await limiter.schedule(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new HttpError(
          429,
          new Headers({'x-ratelimit-reset': 'not-a-number'}),
          'rate limited',
        )
      }
      return 'ok'
    })

    expect(result).to.equal('ok')
    expect(attempts).to.equal(2)
  })
})
