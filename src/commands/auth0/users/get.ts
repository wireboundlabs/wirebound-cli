import {Flags} from '@oclif/core'
import {CLIError} from '@oclif/core/errors'

import {Auth0Client} from '../../../lib/auth0/client.js'
import {formatUserGetResult} from '../../../lib/output.js'
import {Auth0Command} from '../../../lib/commands/auth0-command.js'
import {RateLimiter} from '../../../lib/rate-limiter.js'

export default class Auth0UsersGet extends Auth0Command {
  static override description = 'Get an Auth0 user by email or user ID'

  static override examples = [
    '<%= config.bin %> auth0 users get --email user@example.com',
    '<%= config.bin %> auth0 users get --id auth0|abc123 --json',
  ]

  static override flags = {
    ...Auth0Command.baseFlags,
    email: Flags.string({
      description: 'User email address',
    }),
    id: Flags.string({
      description: 'Auth0 user ID',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0UsersGet)

    if (Boolean(flags.email) === Boolean(flags.id)) {
      throw new CLIError('Exactly one of --email or --id is required')
    }

    const config = await this.resolveConfig(flags)

    const limiter = new RateLimiter({
      onRetry: (message) => this.logVerbose(message, flags.verbose),
      rps: config.rps,
    })
    const client = new Auth0Client(config, limiter)

    const users = flags.id
      ? [await client.getUserById(flags.id)]
      : await client.getUsersByEmail(flags.email!)

    if (flags.json) {
      this.log(JSON.stringify(users.length === 1 ? users[0] : users, null, 2))
      return
    }

    this.log(formatUserGetResult(users))
  }
}
