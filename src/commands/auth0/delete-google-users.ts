import {Flags} from '@oclif/core'

import {createAuth0Client} from '@/lib/auth0/create-client'
import {type Auth0User} from '@/lib/auth0/types'
import {formatHumanResult, type DeleteCommandResult} from '@/lib/output'
import {type ProgressReporter} from '@/lib/progress'
import {Auth0Command} from '@/lib/commands/auth0-command'
import {type Auth0Client} from '@/lib/auth0/client'

async function deleteEligibleUsers(
  client: Auth0Client,
  users: Auth0User[],
  logVerbose: (message: string) => void,
  progress?: ProgressReporter,
): Promise<{deleted: string[]; errors: DeleteCommandResult['errors']}> {
  const deleted: string[] = []
  const errors: DeleteCommandResult['errors'] = []

  progress?.taskStart('Deleting users', users.length)

  for (const user of users) {
    try {
      await client.deleteUser(user.user_id)
      deleted.push(user.user_id)
      logVerbose(`Deleted ${user.user_id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push({message, user_id: user.user_id})
    }

    progress?.taskAdvance()
  }

  progress?.taskStop()

  return {deleted, errors}
}

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

    const client = createAuth0Client(config, {
      onRetry: (message) => this.logVerbose(message, flags.verbose),
    })

    this.logResolvedConfig(config, flags.verbose ?? false)

    this.logVerbose(
      `Listing users with google-oauth2 identity`,
      flags.verbose,
    )

    const progress = this.createProgress(flags)
    progress.fetchStart('Finding google-only users', flags.limit)

    const {totalRaw, users} = await client.listGoogleOnlyUsers({
      limit: flags.limit,
      onPage: this.pageProgressHandler(
        progress,
        flags.verbose,
        ({page, rawCount, total}) =>
          `Page ${page}: ${rawCount} result(s), ${total} total match(es) in search`,
      ),
    })

    progress.fetchStop()

    const result: DeleteCommandResult = {
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

    if (flags.confirm) {
      const deletion = await deleteEligibleUsers(
        client,
        users,
        (message) => this.logVerbose(message, flags.verbose),
        progress,
      )
      result.deleted = deletion.deleted
      result.errors = deletion.errors
    }

    this.emitResult(result, flags.json)

    if (result.errors.length > 0) {
      this.exit(1)
    }
  }

  private emitResult(result: DeleteCommandResult, asJson: boolean): void {
    if (asJson) {
      this.log(JSON.stringify(result, null, 2))
      return
    }

    this.log(formatHumanResult(result))
  }
}
