import {Flags} from '@oclif/core'

import {Auth0Client} from '../../lib/auth0/client.js'
import {formatHumanResult, type CommandResult} from '../../lib/output.js'
import {RateLimiter} from '../../lib/rate-limiter.js'
import {Auth0Command} from '../../lib/commands/auth0-command.js'

export default class Auth0DeleteGoogleUsers extends Auth0Command {
  static override description =
    'Delete Auth0 users with exactly one google-oauth2 identity (dry-run by default)'

  static override examples = [
    '<%= config.bin %> auth0 delete-google-users --profile acme',
    '<%= config.bin %> auth0 delete-google-users --domain tenant.us.auth0.com --client-id ID --client-secret SECRET',
    '<%= config.bin %> auth0 delete-google-users --profile acme --confirm',
    '<%= config.bin %> auth0 delete-google-users --profile acme --limit 10 --json',
  ]

  static override flags = {
    ...Auth0Command.baseFlags,
    confirm: Flags.boolean({
      default: false,
      description: 'Actually delete users (default is dry-run)',
    }),
    limit: Flags.integer({
      description: 'Maximum number of google-only users to process',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0DeleteGoogleUsers)
    const config = await this.resolveConfig(flags)

    const limiter = new RateLimiter({
      onRetry: (message) => this.logVerbose(message, flags.verbose),
      rps: config.rps,
    })
    const client = new Auth0Client(config, limiter)

    this.logVerbose(
      `Listing users with google-oauth2 identity from ${config.domain}`,
      flags.verbose,
    )

    const {totalRaw, users} = await client.listGoogleOnlyUsers({
      limit: flags.limit,
      onPage: ({page, rawCount, total}) => {
        this.logVerbose(
          `Page ${page}: ${rawCount} result(s), ${total} total match(es) in search`,
          flags.verbose,
        )
      },
    })

    const result: CommandResult = {
      candidates: users.map((user) => ({
        created_at: user.created_at,
        email: user.email,
        user_id: user.user_id,
      })),
      deleted: [],
      dryRun: !flags.confirm,
      eligible: users.length,
      errors: [],
      found: totalRaw,
    }

    if (!flags.confirm) {
      this.emitResult(result, flags.json)
      return
    }

    for (const user of users) {
      try {
        await client.deleteUser(user.user_id)
        result.deleted.push(user.user_id)
        this.logVerbose(`Deleted ${user.user_id}`, flags.verbose)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        result.errors.push({message, user_id: user.user_id})
      }
    }

    this.emitResult(result, flags.json)

    if (result.errors.length > 0) {
      this.exit(1)
    }
  }

  private emitResult(result: CommandResult, asJson: boolean): void {
    if (asJson) {
      this.log(JSON.stringify(result, null, 2))
      return
    }

    this.log(formatHumanResult(result))
  }
}
