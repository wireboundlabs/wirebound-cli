import {createAuth0Client} from '@/lib/auth0/create-client'
import {orgMemberMutationFlags} from '@/lib/auth0/org-members'
import {runOrgMemberMutation} from '@/lib/auth0/org-member-mutation'
import {formatOrgMemberMutationResult} from '@/lib/output'
import {Auth0Command} from '@/lib/commands/auth0-command'

export default class Auth0OrgsMembersRemove extends Auth0Command {
  static override description =
    'Remove users from an Auth0 organization by email, ID, or query (dry-run by default)'

  static override examples = [
    '<%= config.bin %> auth0 orgs members remove --org-name acme-corp --email user@example.com',
    '<%= config.bin %> auth0 orgs members remove --org-id org_abc --query \'email:*@acme.com\' --confirm',
  ]

  static override flags = orgMemberMutationFlags

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0OrgsMembersRemove)
    const config = await this.resolveConfig(flags)

    const client = createAuth0Client(config, {
      onRetry: (message) => this.logVerbose(message, flags.verbose),
    })

    this.logResolvedConfig(config, flags.verbose ?? false)

    const progress = this.createProgress(flags)

    const result = await runOrgMemberMutation(client, {
      action: 'remove',
      confirm: flags.confirm,
      email: flags.email,
      id: flags.id,
      limit: flags.limit,
      logVerbose: (message) => this.logVerbose(message, flags.verbose),
      orgId: flags['org-id'],
      orgName: flags['org-name'],
      progress,
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
