import {existsSync} from 'node:fs'
import {resolve} from 'node:path'

import {CLIError} from '@oclif/core/errors'

import {resolveAuth0Config} from '@/lib/config/auth0'
import {
  ensureGitignore,
  formatProfileList,
  listRepoProfiles,
  readRepoDefaultProfile,
  repoProfilePath,
  writeRepoDefaultProfile,
  writeRepoProfile,
} from '@/lib/config/profile'
import {verifyAuth0Credentials} from '@/lib/config/verify-auth0'
import {type ProgressReporter} from '@/lib/progress'

export interface Auth0Credentials {
  domain: string
  clientId: string
  clientSecret: string
}

export interface RunSetupOptions {
  targetDir: string
  profileName: string
  force: boolean
  check: boolean
  setDefault?: boolean
  credentials: Auth0Credentials
  confirmOverwrite?: (configPath: string) => Promise<boolean>
  confirmSetDefault?: (profileName: string, targetDir: string) => Promise<boolean>
  log: (message: string) => void
  progress?: ProgressReporter
}

export function listSetupProfiles(targetDir: string): string {
  const profiles = listRepoProfiles(targetDir)
  const defaultProfile = readRepoDefaultProfile(targetDir)
  return formatProfileList(profiles, defaultProfile)
}

async function verifySetupCredentials(
  credentials: Auth0Credentials,
): Promise<void> {
  const config = resolveAuth0Config({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    domain: credentials.domain,
  })

  try {
    await verifyAuth0Credentials(config)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CLIError(`Credential check failed: ${message}`)
  }
}

async function resolveSetDefault(
  options: RunSetupOptions,
  targetDir: string,
): Promise<boolean> {
  if (options.setDefault !== undefined) {
    return options.setDefault
  }

  if (!options.confirmSetDefault) {
    return false
  }

  return options.confirmSetDefault(options.profileName, targetDir)
}

async function confirmOverwriteIfNeeded(
  options: RunSetupOptions,
  configPath: string,
): Promise<boolean> {
  if (!existsSync(configPath) || options.force) {
    return true
  }

  if (!options.confirmOverwrite) {
    throw new CLIError(
      `Profile "${options.profileName}" already exists at ${configPath}. Re-run with --force to overwrite.`,
    )
  }

  return options.confirmOverwrite(configPath)
}

function logNextSteps(
  log: RunSetupOptions['log'],
  profileName: string,
  shouldSetDefault: boolean,
): void {
  log('')
  log('Next steps:')
  log(`  wirebound auth0 delete-google-users --profile ${profileName}   # dry-run (safe)`)
  if (!shouldSetDefault) {
    log(`  export WIREBOUND_PROFILE=${profileName}   # or run setup with --default`)
  } else {
    log('  wirebound auth0 delete-google-users   # uses default profile')
  }
  log('')
  log(
    'Need M2M credentials? See docs/vendors/auth0.md#set-up-machine-to-machine-credentials-in-auth0',
  )
}

export async function runSetup(options: RunSetupOptions): Promise<void> {
  const targetDir = resolve(options.targetDir)
  const configPath = repoProfilePath(targetDir, options.profileName)

  const shouldContinue = await confirmOverwriteIfNeeded(options, configPath)
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
