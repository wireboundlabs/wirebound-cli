import {Flags} from '@oclif/core'

import {Auth0Client} from '@/lib/auth0/client'
import {orgTargetFlags} from '@/lib/auth0/org-members'
import {resolveOrganization, validateOrgFlags} from '@/lib/auth0/resolve-org'
import {
  formatOrganizationMembersResult,
  type OrganizationMembersResult,
} from '@/lib/output'
import {Auth0Command} from '@/lib/commands/auth0-command'
import {RateLimiter} from '@/lib/rate-limiter'

export default class Auth0OrgsMembersList extends Auth0Command {
  static override description = 'List members of an Auth0 organization'

  static override examples = [
    '<%= config.bin %> auth0 orgs members list --org-name acme-corp',
    '<%= config.bin %> auth0 orgs members list --org-id org_abc123 --limit 50 --json',
  ]

  static override flags = {
    ...Auth0Command.baseFlags,
    limit: Flags.integer({
      description: 'Maximum number of members to return',
    }),
    ...orgTargetFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0OrgsMembersList)
    validateOrgFlags({orgId: flags['org-id'], orgName: flags['org-name']})

    const config = await this.resolveConfig(flags)

    const limiter = new RateLimiter({
      onRetry: (message) => this.logVerbose(message, flags.verbose),
      rps: config.rps,
    })
    const client = new Auth0Client(config, limiter)

    const progress = this.createProgress(flags)
    const org = await progress.spinAsync('Resolving organization', () =>
      resolveOrganization(client, {
        orgId: flags['org-id'],
        orgName: flags['org-name'],
      }),
    )

    this.logVerbose(`Listing members of org ${org.name} on ${config.domain}`, flags.verbose)

    progress.fetchStart('Listing org members', flags.limit)

    const {members, total, truncated} = await client.listOrganizationMembers(org.id, {
      limit: flags.limit,
      onPage: this.pageProgressHandler(
        progress,
        flags.verbose,
        ({page, rawCount, total: pageTotal}) =>
          `Page ${page}: ${rawCount} result(s), ${pageTotal} total member(s)`,
      ),
    })

    progress.fetchStop()

    const result: OrganizationMembersResult = {
      members,
      org: {id: org.id, name: org.name},
      total,
      truncated,
    }

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
      return
    }

    this.log(formatOrganizationMembersResult(result))
  }
}
