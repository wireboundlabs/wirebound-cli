import {existsSync} from 'node:fs'

import {CLIError} from '@oclif/core/errors'

import {Auth0Client} from '@/lib/auth0/client'
import {resolveAuth0Config} from '@/lib/config/auth0'
import {repoProfilePath} from '@/lib/config/profile'
import {RateLimiter} from '@/lib/rate-limiter'

import {type Auth0Credentials, type RunSetupOptions} from './run-setup-types'

export async function verifySetupCredentials(
  credentials: Auth0Credentials,
): Promise<void> {
  const config = resolveAuth0Config({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    domain: credentials.domain,
  })

  try {
    const client = new Auth0Client(config, new RateLimiter({rps: config.rps}))
    await client.getToken()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CLIError(`Credential check failed: ${message}`)
  }
}

export async function resolveSetDefault(
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

export async function confirmOverwriteIfNeeded(
  options: RunSetupOptions,
  targetDir: string,
): Promise<boolean> {
  const configPath = repoProfilePath(targetDir, options.profileName)

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

export function logNextSteps(
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
