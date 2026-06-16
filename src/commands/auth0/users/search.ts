import {Flags} from '@oclif/core'

import {Auth0Client} from '@/lib/auth0/client'
import {
  formatUserSearchResult,
  parseUserFields,
  projectUser,
  type UserSearchResult,
} from '@/lib/output'
import {Auth0Command} from '@/lib/commands/auth0-command'
import {RateLimiter} from '@/lib/rate-limiter'

export default class Auth0UsersSearch extends Auth0Command {
  static override description = 'Search Auth0 users with a Lucene v3 query'

  static override examples = [
    '<%= config.bin %> auth0 users search --query \'email:*@acme.com\'',
    '<%= config.bin %> auth0 users search --query \'identities.provider:"google-oauth2"\' --limit 50 --json',
  ]

  static override flags = {
    ...Auth0Command.baseFlags,
    fields: Flags.string({
      default: 'email,user_id,created_at,blocked,last_login',
      description: 'Comma-separated fields for table/JSON projection',
    }),
    limit: Flags.integer({
      description: 'Maximum number of users to return',
    }),
    query: Flags.string({
      char: 'q',
      description: 'Lucene v3 search query',
      required: true,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0UsersSearch)
    const config = await this.resolveConfig(flags)

    const limiter = new RateLimiter({
      onRetry: (message) => this.logVerbose(message, flags.verbose),
      rps: config.rps,
    })
    const client = new Auth0Client(config, limiter)

    this.logVerbose(`Searching users on ${config.domain}`, flags.verbose)

    const progress = this.createProgress(flags)
    progress.fetchStart('Searching users', flags.limit)

    const {total, truncated, users} = await client.searchUsers(flags.query, {
      limit: flags.limit,
      onPage: this.pageProgressHandler(
        progress,
        flags.verbose,
        ({page, rawCount, total: pageTotal}) =>
          `Page ${page}: ${rawCount} result(s), ${pageTotal} total match(es) in search`,
      ),
    })

    progress.fetchStop()

    const fields = parseUserFields(flags.fields)
    const result: UserSearchResult = {total, truncated, users}

    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            total,
            truncated,
            users: users.map((user) => projectUser(user, fields)),
          },
          null,
          2,
        ),
      )
      return
    }

    this.log(formatUserSearchResult(result, flags.query))
  }
}
