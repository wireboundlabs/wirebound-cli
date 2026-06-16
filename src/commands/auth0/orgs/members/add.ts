import {Auth0Client} from '@/lib/auth0/client'
import {orgMemberMutationFlags} from '@/lib/auth0/org-members'
import {runOrgMemberMutation} from '@/lib/auth0/org-member-mutation'
import {formatOrgMemberMutationResult} from '@/lib/output'
import {Auth0Command} from '@/lib/commands/auth0-command'
import {RateLimiter} from '@/lib/rate-limiter'

export default class Auth0OrgsMembersAdd extends Auth0Command {
  static override description =
    'Add users to an Auth0 organization by email, ID, or query (dry-run by default)'

  static override examples = [
    '<%= config.bin %> auth0 orgs members add --org-name acme-corp --email user@example.com',
    '<%= config.bin %> auth0 orgs members add --org-id org_abc --query \'email:*@acme.com\' --confirm',
  ]

  static override flags = orgMemberMutationFlags

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0OrgsMembersAdd)
    const config = await this.resolveConfig(flags)

    const limiter = new RateLimiter({
      onRetry: (message) => this.logVerbose(message, flags.verbose),
      rps: config.rps,
    })
    const client = new Auth0Client(config, limiter)

    const result = await runOrgMemberMutation(client, {
      action: 'add',
      confirm: flags.confirm,
      email: flags.email,
      id: flags.id,
      limit: flags.limit,
      logVerbose: (message) => this.logVerbose(message, flags.verbose),
      orgId: flags['org-id'],
      orgName: flags['org-name'],
      query: flags.query,
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      this.log(formatOrgMemberMutationResult(result))
    }

    if (result.errors.length > 0) {
      this.exit(1)
    }
  }
}
