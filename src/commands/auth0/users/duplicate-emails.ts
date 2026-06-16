import {Flags} from '@oclif/core'

import {Auth0Client} from '@/lib/auth0/client'
import {
  formatDuplicateEmailsResult,
  type DuplicateEmailsResult,
} from '@/lib/output'
import {Auth0Command} from '@/lib/commands/auth0-command'
import {RateLimiter} from '@/lib/rate-limiter'

export default class Auth0UsersDuplicateEmails extends Auth0Command {
  static override description =
    'Find Auth0 users that share the same email across different user records'

  static override examples = [
    '<%= config.bin %> auth0 users duplicate-emails',
    '<%= config.bin %> auth0 users duplicate-emails --limit 500 --json',
    '<%= config.bin %> auth0 users duplicate-emails --profile production --verbose',
  ]

  static override flags = {
    ...Auth0Command.baseFlags,
    limit: Flags.integer({
      description: 'Maximum number of users to scan (default: all up to Auth0 search cap)',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0UsersDuplicateEmails)
    const config = await this.resolveConfig(flags)

    const limiter = new RateLimiter({
      onRetry: (message) => this.logVerbose(message, flags.verbose),
      rps: config.rps,
    })
    const client = new Auth0Client(config, limiter)

    this.logVerbose(`Scanning users with emails on ${config.domain}`, flags.verbose)

    const progress = this.createProgress(flags)
    progress.fetchStart('Scanning users', flags.limit)

    const {duplicates, scanned, truncated} = await client.findDuplicateEmails({
      limit: flags.limit,
      onPage: this.pageProgressHandler(
        progress,
        flags.verbose,
        ({page, rawCount, total}) =>
          `Page ${page}: ${rawCount} result(s), ${total} total match(es) in search`,
      ),
    })

    progress.fetchStop()

    const result: DuplicateEmailsResult = {
      duplicateCount: duplicates.length,
      duplicates,
      scanned,
      truncated,
    }

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
      return
    }

    this.log(formatDuplicateEmailsResult(result))
  }
}
