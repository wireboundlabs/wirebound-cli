import {Flags} from '@oclif/core'

import {resolveAuth0Config, type Auth0Config} from '../config/auth0.js'
import {WireboundCommand} from './wirebound-command.js'

export abstract class Auth0Command extends WireboundCommand {
  static baseFlags = {
    ...WireboundCommand.baseFlags,
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
      default: 2,
      description: 'Maximum Auth0 Management API requests per second',
    }),
  }

  protected async resolveConfig(flags: {
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
      profileVars: this.profileVars,
      rps: flags.rps,
    })
  }
}
