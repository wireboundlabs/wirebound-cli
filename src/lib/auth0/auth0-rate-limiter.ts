import Bottleneck from 'bottleneck'

import {type Auth0Config} from '@/lib/config/auth0'
import {
  type Auth0EndpointKey,
  resolveEndpointMinTimeMs,
} from '@/lib/auth0/rate-limit-policy'
import {
  defaultAuth0RetryDelayMs,
  type GetRetryDelayMs,
} from '@/lib/rate-limiter'

export interface Auth0RateLimiterOptions {
  config: Auth0Config
  maxRetries?: number
  getRetryDelayMs?: GetRetryDelayMs
  onRetry?: (message: string) => void
}

export class Auth0RateLimiter {
  private readonly globalLimiter: Bottleneck
  private readonly endpointLimiters = new Map<Auth0EndpointKey, Bottleneck>()
  private readonly maxRetries: number
  private readonly getRetryDelayMs: GetRetryDelayMs
  private readonly onRetry?: (message: string) => void
  private readonly config: Auth0Config

  constructor(options: Auth0RateLimiterOptions) {
    this.config = options.config
    this.maxRetries = options.maxRetries ?? 5
    this.getRetryDelayMs = options.getRetryDelayMs ?? defaultAuth0RetryDelayMs
    this.onRetry = options.onRetry

    this.globalLimiter = this.createLimiter(Math.ceil(1000 / this.config.rps))
  }

  private createLimiter(minTime: number): Bottleneck {
    const limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime,
    })

    limiter.on('failed', async (error, jobInfo) => {
      if (jobInfo.retryCount >= this.maxRetries) return

      const delayMs = this.getRetryDelayMs(error)
      if (delayMs === undefined) return

      this.onRetry?.(
        `Rate limited (attempt ${jobInfo.retryCount + 1}/${this.maxRetries}); retrying in ${delayMs}ms`,
      )
      return delayMs
    })

    return limiter
  }

  private getEndpointLimiter(endpointKey: Auth0EndpointKey): Bottleneck | undefined {
    const endpointMinTime = resolveEndpointMinTimeMs(
      this.config.plan,
      this.config.tenantEnvironment,
      endpointKey,
    )
    if (endpointMinTime === undefined) return undefined

    const existing = this.endpointLimiters.get(endpointKey)
    if (existing) return existing

    const limiter = this.createLimiter(endpointMinTime)
    this.endpointLimiters.set(endpointKey, limiter)
    return limiter
  }

  async schedule<T>(endpointKey: Auth0EndpointKey, fn: () => Promise<T>): Promise<T> {
    const endpointLimiter = this.getEndpointLimiter(endpointKey)
    if (!endpointLimiter) {
      return this.globalLimiter.schedule(fn)
    }

    return this.globalLimiter.schedule(() => endpointLimiter.schedule(fn))
  }
}
