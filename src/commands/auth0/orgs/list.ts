import {Flags} from '@oclif/core'

import {Auth0Client} from '@/lib/auth0/client'
import {
  formatOrganizationListResult,
  type OrganizationListResult,
} from '@/lib/output'
import {Auth0Command} from '@/lib/commands/auth0-command'
import {RateLimiter} from '@/lib/rate-limiter'

export default class Auth0OrgsList extends Auth0Command {
  static override description = 'List Auth0 organizations in the tenant'

  static override examples = [
    '<%= config.bin %> auth0 orgs list',
    '<%= config.bin %> auth0 orgs list --limit 20 --json',
  ]

  static override flags = {
    ...Auth0Command.baseFlags,
    limit: Flags.integer({
      description: 'Maximum number of organizations to return',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0OrgsList)
    const config = await this.resolveConfig(flags)

    const limiter = new RateLimiter({
      onRetry: (message) => this.logVerbose(message, flags.verbose),
      rps: config.rps,
    })
    const client = new Auth0Client(config, limiter)

    this.logVerbose(`Listing organizations on ${config.domain}`, flags.verbose)

    const {organizations, total, truncated} = await client.listOrganizations({
      limit: flags.limit,
      onPage: ({page, rawCount, total: pageTotal}) => {
        this.logVerbose(
          `Page ${page}: ${rawCount} result(s), ${pageTotal} total organization(s)`,
          flags.verbose,
        )
      },
    })

    const result: OrganizationListResult = {organizations, total, truncated}

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
      return
    }

    this.log(formatOrganizationListResult(result))
  }
}
