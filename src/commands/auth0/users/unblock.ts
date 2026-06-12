import {Auth0Command} from '../../../lib/commands/auth0-command.js'
import {blockUnblockBaseFlags, runBlockUnblockCommand} from './block-shared.js'

export default class Auth0UsersUnblock extends Auth0Command {
  static override description =
    'Unblock Auth0 users by email, user ID, or search query (dry-run by default)'

  static override examples = [
    '<%= config.bin %> auth0 users unblock --email user@example.com',
    '<%= config.bin %> auth0 users unblock --query \'blocked:true\' --confirm',
  ]

  static override flags = blockUnblockBaseFlags

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0UsersUnblock)

    await runBlockUnblockCommand(
      {
        exit: (code) => this.exit(code),
        log: (message) => this.log(message),
        logVerbose: (message, verbose) => this.logVerbose(message, verbose),
      },
      {
      action: 'unblock',
      blocked: false,
      flags,
      resolveConfig: (input) => this.resolveConfig(input),
    })
  }
}
