import {Auth0Client} from '@/lib/auth0/client'
import {Auth0RateLimiter} from '@/lib/auth0/auth0-rate-limiter'
import {type Auth0Config} from '@/lib/config/auth0'

export interface CreateAuth0ClientOptions {
  onRetry?: (message: string) => void
}

export function createAuth0Client(
  config: Auth0Config,
  options: CreateAuth0ClientOptions = {},
): Auth0Client {
  const limiter = new Auth0RateLimiter({
    config,
    onRetry: options.onRetry,
  })
  return new Auth0Client(config, limiter)
}

export function createTestAuth0Client(
  overrides: Partial<Auth0Config> & Pick<Auth0Config, 'domain' | 'clientId' | 'clientSecret'>,
  options: CreateAuth0ClientOptions = {},
): Auth0Client {
  return createAuth0Client(
    {
      plan: 'free',
      rps: 10,
      tenantEnvironment: 'production',
      ...overrides,
    },
    options,
  )
}
