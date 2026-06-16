import {Flags} from '@oclif/core'

import {createAuth0Client} from '@/lib/auth0/create-client'
import {orgTargetFlags} from '@/lib/auth0/org-members'
import {resolveOrganization, validateOrgFlags} from '@/lib/auth0/resolve-org'
import {
  formatOrganizationMembersResult,
  type OrganizationMembersResult,
} from '@/lib/output'
import {Auth0Command} from '@/lib/commands/auth0-command'

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

    const client = createAuth0Client(config, {
      onRetry: (message) => this.logVerbose(message, flags.verbose),
    })

    const progress = this.createProgress(flags)
    const org = await progress.spinAsync('Resolving organization', () =>
      resolveOrganization(client, {
        orgId: flags['org-id'],
        orgName: flags['org-name'],
      }),
    )

    this.logResolvedConfig(config, flags.verbose ?? false)
    this.logVerbose(`Listing members of org ${org.name}`, flags.verbose)

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
