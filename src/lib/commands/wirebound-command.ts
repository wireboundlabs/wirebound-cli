import {Command, Flags} from '@oclif/core'

import {loadProfile} from '../config/profile.js'

export abstract class WireboundCommand extends Command {
  static baseFlags = {
    json: Flags.boolean({
      default: false,
      description: 'Output machine-readable JSON',
    }),
    profile: Flags.string({
      description:
        'Load credentials from ~/.config/wirebound/profiles/<name>.env (default: $WIREBOUND_PROFILE)',
      env: 'WIREBOUND_PROFILE',
    }),
    verbose: Flags.boolean({
      default: false,
      description: 'Enable verbose logging',
    }),
  }

  protected profileVars?: Record<string, string>

  protected async loadProfileIfNeeded(profile?: string): Promise<void> {
    if (!profile) return
    this.profileVars = loadProfile(profile)
  }

  protected logVerbose(message: string, verbose: boolean): void {
    if (verbose) {
      this.log(message)
    }
  }
}
