import {Command, Flags} from '@oclif/core'
import {CLIError} from '@oclif/core/errors'

import {resolveProfileVars} from '@/lib/config/profile'

export abstract class WireboundCommand extends Command {
  static baseFlags = {
    json: Flags.boolean({
      default: false,
      description: 'Output machine-readable JSON',
    }),
    profile: Flags.string({
      description:
        'Profile name — loads .wirebound/profiles/<name>.env in the repo (or ~/.config/wirebound/profiles/<name>.env). Default: $WIREBOUND_PROFILE, then .wirebound/default, then legacy config.env.',
      env: 'WIREBOUND_PROFILE',
    }),
    verbose: Flags.boolean({
      default: false,
      description: 'Enable verbose logging',
    }),
  }

  protected profileVars?: Record<string, string>

  protected async loadConfigVars(profile?: string): Promise<void> {
    try {
      this.profileVars = resolveProfileVars(profile)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new CLIError(message)
    }
  }

  protected logVerbose(message: string, verbose: boolean): void {
    if (verbose) {
      this.log(message)
    }
  }
}
