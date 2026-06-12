import {Command, Flags} from '@oclif/core'
import {resolve} from 'node:path'

import {validateProfileName} from '../lib/config/profile.js'
import {
  promptAuth0Credentials,
  promptOverwrite,
  promptProfileName,
  promptSetDefault,
} from '../lib/setup/prompt-auth0-credentials.js'
import {listSetupProfiles, runSetup} from '../lib/setup/run-setup.js'

export default class Setup extends Command {
  static description =
    'Interactive setup — create repo-local Auth0 profiles under .wirebound/profiles/'

  static examples = [
    '<%= config.bin %> setup',
    '<%= config.bin %> setup --profile production --default',
    '<%= config.bin %> setup --profile test --check',
    '<%= config.bin %> setup --list',
  ]

  static flags = {
    check: Flags.boolean({
      default: false,
      description: 'Verify Auth0 credentials after writing config',
    }),
    default: Flags.boolean({
      default: false,
      description: 'Set this profile as the repo default (written to .wirebound/default)',
    }),
    dir: Flags.string({
      default: process.cwd(),
      description: 'Target repository directory (default: current working directory)',
    }),
    force: Flags.boolean({
      default: false,
      description: 'Overwrite existing profile without prompting',
    }),
    list: Flags.boolean({
      default: false,
      description: 'List repo-local profiles and exit',
    }),
    profile: Flags.string({
      description: 'Profile name (e.g. dev, test, production). Prompted if omitted.',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Setup)
    const targetDir = resolve(flags.dir)

    if (flags.list) {
      this.log(listSetupProfiles(targetDir))
      return
    }

    this.assertValidProfileFlag(flags.profile)

    const profileName = await promptProfileName(targetDir, flags.profile)
    const credentials = await promptAuth0Credentials()

    await runSetup({
      check: flags.check,
      confirmOverwrite: promptOverwrite,
      confirmSetDefault: promptSetDefault,
      credentials,
      force: flags.force,
      log: (message) => this.log(message),
      profileName,
      setDefault: flags.default ? true : undefined,
      targetDir,
    })
  }

  private assertValidProfileFlag(profile?: string): void {
    if (!profile) {
      return
    }

    const validation = validateProfileName(profile)
    if (validation !== true) {
      this.error(validation)
    }
  }
}
