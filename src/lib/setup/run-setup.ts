import {resolve} from 'node:path'

import {
  ensureGitignore,
  formatProfileList,
  listRepoProfiles,
  readRepoDefaultProfile,
  repoProfilePath,
  writeRepoDefaultProfile,
  writeRepoProfile,
} from '@/lib/config/profile'

import {
  confirmOverwriteIfNeeded,
  logNextSteps,
  resolveSetDefault,
  verifySetupCredentials,
} from './run-setup-steps'
import {type Auth0Credentials, type RunSetupOptions} from './run-setup-types'

export type {Auth0Credentials, RunSetupOptions} from './run-setup-types'

export function listSetupProfiles(targetDir: string): string {
  const profiles = listRepoProfiles(targetDir)
  const defaultProfile = readRepoDefaultProfile(targetDir)
  return formatProfileList(profiles, defaultProfile)
}

export async function runSetup(options: RunSetupOptions): Promise<void> {
  const targetDir = resolve(options.targetDir)

  const shouldContinue = await confirmOverwriteIfNeeded(options, targetDir)
  if (!shouldContinue) {
    options.log('Setup cancelled.')
    return
  }

  const writtenPath = writeRepoProfile(targetDir, options.profileName, {
    AUTH0_DOMAIN: options.credentials.domain,
    AUTH0_MGMT_CLIENT_ID: options.credentials.clientId,
    AUTH0_MGMT_CLIENT_SECRET: options.credentials.clientSecret,
  })

  const gitignoreUpdated = ensureGitignore(targetDir)

  options.log(`Wrote ${writtenPath}`)
  if (gitignoreUpdated) {
    options.log('Added .wirebound/ to .gitignore')
  }

  const shouldSetDefault = await resolveSetDefault(options, targetDir)
  if (shouldSetDefault) {
    const defaultPath = writeRepoDefaultProfile(targetDir, options.profileName)
    options.log(`Set default profile to "${options.profileName}" (${defaultPath})`)
  }

  if (options.check) {
    if (options.progress) {
      await options.progress.spinAsync(
        'Verifying Auth0 credentials',
        () => verifySetupCredentials(options.credentials),
        'Auth0 credentials verified.',
      )
    } else {
      await verifySetupCredentials(options.credentials)
      options.log('Auth0 credentials verified.')
    }
  }

  logNextSteps(options.log, options.profileName, shouldSetDefault)
}
