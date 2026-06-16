import {Flags} from '@oclif/core'

import {resolveAuth0Config, formatRateLimitSummary, type Auth0Config} from '@/lib/config/auth0'
import {WireboundCommand} from './wirebound-command'

export abstract class Auth0Command extends WireboundCommand {
  static baseFlags = {
    ...WireboundCommand.baseFlags,
    'auth0-plan': Flags.string({
      description:
        'Auth0 subscription plan for rate limits: free, essentials-professional, or enterprise (default: $AUTH0_PLAN or free)',
      env: 'AUTH0_PLAN',
      options: ['free', 'essentials-professional', 'enterprise'],
    }),
    'auth0-tenant-env': Flags.string({
      description:
        'Enterprise tenant environment for rate limits: production or non-production (default: $AUTH0_TENANT_ENV or production)',
      env: 'AUTH0_TENANT_ENV',
      options: ['production', 'non-production'],
    }),
    'client-id': Flags.string({
      description: 'Auth0 Management API M2M client ID (default: $AUTH0_MGMT_CLIENT_ID)',
      env: 'AUTH0_MGMT_CLIENT_ID',
    }),
    'client-secret': Flags.string({
      description:
        'Auth0 Management API M2M client secret (default: $AUTH0_MGMT_CLIENT_SECRET)',
      env: 'AUTH0_MGMT_CLIENT_SECRET',
    }),
    domain: Flags.string({
      description: 'Auth0 tenant domain (default: $AUTH0_DOMAIN)',
      env: 'AUTH0_DOMAIN',
    }),
    rps: Flags.integer({
      description:
        'Override global Auth0 Management API requests per second (default: from plan; $AUTH0_RPS)',
      env: 'AUTH0_RPS',
    }),
  }

  protected async resolveConfig(flags: {
    'auth0-plan'?: string
    'auth0-tenant-env'?: string
    domain?: string
    'client-id'?: string
    'client-secret'?: string
    rps?: number
    profile?: string
    verbose?: boolean
  }): Promise<Auth0Config> {
    await this.loadConfigVars(flags.profile)

    return resolveAuth0Config({
      clientId: flags['client-id'],
      clientSecret: flags['client-secret'],
      domain: flags.domain,
      plan: flags['auth0-plan'],
      profileVars: this.profileVars,
      rps: flags.rps,
      tenantEnvironment: flags['auth0-tenant-env'],
    })
  }

  protected logResolvedConfig(config: Auth0Config, verbose: boolean): void {
    this.logVerbose(`Auth0 tenant: ${config.domain}`, verbose)
    this.logVerbose(`Rate limits: ${formatRateLimitSummary(config)}`, verbose)
  }
}
