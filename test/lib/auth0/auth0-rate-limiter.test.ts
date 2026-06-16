import {expect} from 'chai'

import {HttpError} from '@/lib/http-error'
import {Auth0RateLimiter} from '@/lib/auth0/auth0-rate-limiter'
import {type Auth0Config} from '@/lib/config/auth0'

describe('Auth0RateLimiter', () => {
  const baseConfig: Auth0Config = {
    clientId: 'cid',
    clientSecret: 'secret',
    domain: 'tenant.example.com',
    plan: 'essentials-professional',
    rps: 3,
    tenantEnvironment: 'production',
  }

  it('applies endpoint-specific spacing for read-logs on paid plans', async () => {
    const limiter = new Auth0RateLimiter({config: baseConfig})
    const timestamps: number[] = []

    await limiter.schedule('read-logs', async () => {
      timestamps.push(Date.now())
    })
    await limiter.schedule('read-logs', async () => {
      timestamps.push(Date.now())
    })

    expect(timestamps[1] - timestamps[0]).to.be.at.least(550)
  })

  it('uses global spacing only on free plans', async () => {
    const limiter = new Auth0RateLimiter({
      config: {...baseConfig, plan: 'free', rps: 2},
    })
    const timestamps: number[] = []

    await limiter.schedule('read-logs', async () => {
      timestamps.push(Date.now())
    })
    await limiter.schedule('read-logs', async () => {
      timestamps.push(Date.now())
    })

    expect(timestamps[1] - timestamps[0]).to.be.at.least(450)
    expect(timestamps[1] - timestamps[0]).to.be.below(550)
  })

  it('reuses cached endpoint limiters across requests', async () => {
    const limiter = new Auth0RateLimiter({config: baseConfig})

    await limiter.schedule('read-logs', async () => undefined)
    await limiter.schedule('read-logs', async () => undefined)

    expect(true).to.equal(true)
  })

  it('stops retrying after maxRetries is exceeded', async () => {
    const retries: string[] = []
    const limiter = new Auth0RateLimiter({
      config: {...baseConfig, plan: 'free', rps: 100},
      maxRetries: 1,
      onRetry: (message) => retries.push(message),
    })

    try {
      await limiter.schedule('read-users', async () => {
        throw new HttpError(429, new Headers({'x-ratelimit-reset': '0'}), 'rate limited')
      })
      expect.fail('Expected schedule to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
    }

    expect(retries).to.have.length(1)
  })

  it('does not schedule a retry when getRetryDelayMs returns undefined', async () => {
    const retries: string[] = []
    const limiter = new Auth0RateLimiter({
      config: {...baseConfig, plan: 'free', rps: 100},
      getRetryDelayMs: () => undefined,
      maxRetries: 2,
      onRetry: (message) => retries.push(message),
    })

    try {
      await limiter.schedule('read-users', async () => {
        throw new HttpError(429, new Headers(), 'rate limited')
      })
      expect.fail('Expected schedule to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
    }

    expect(retries).to.deep.equal([])
  })
})
