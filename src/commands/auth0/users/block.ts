import {Auth0Command} from '@/lib/commands/auth0-command'
import {blockUnblockBaseFlags, runBlockUnblockCommand} from '@/lib/auth0/block-unblock'

export default class Auth0UsersBlock extends Auth0Command {
  static override description =
    'Block Auth0 users by email, user ID, or search query (dry-run by default)'

  static override examples = [
    '<%= config.bin %> auth0 users block --email user@example.com',
    '<%= config.bin %> auth0 users block --query \'email:*@acme.com\' --confirm',
  ]

  static override flags = blockUnblockBaseFlags

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0UsersBlock)

    await runBlockUnblockCommand(
      {
        exit: (code) => this.exit(code),
        log: (message) => this.log(message),
        logVerbose: (message, verbose) => this.logVerbose(message, verbose),
      },
      {
        action: 'block',
        blocked: true,
        flags,
        progress: this.createProgress(flags),
        resolveConfig: (input) => this.resolveConfig(input),
      },
    )
  }
}
