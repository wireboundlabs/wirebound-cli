import {confirm, input, password} from '@inquirer/prompts'

import {
  listRepoProfiles,
  normalizeAuth0Domain,
  normalizeProfileName,
  readRepoDefaultProfile,
  validateProfileName,
} from '../config/profile.js'
import {type Auth0Credentials} from './run-setup.js'

export async function promptProfileName(
  targetDir: string,
  existingName?: string,
): Promise<string> {
  const existingProfiles = listRepoProfiles(targetDir)
  const hint =
    existingProfiles.length > 0
      ? `Existing: ${existingProfiles.join(', ')}`
      : 'Examples: dev, test, production'

  const name = normalizeProfileName(
    existingName ??
      (await input({
        default: existingProfiles.length === 0 ? 'dev' : undefined,
        message: `Profile name (${hint})`,
        required: true,
        validate: validateProfileName,
      })),
  )

  return name
}

export async function promptAuth0Credentials(): Promise<Auth0Credentials> {
  const domain = normalizeAuth0Domain(
    await input({
      message: 'Auth0 tenant domain (e.g. acme.us.auth0.com)',
      required: true,
      validate: (value) => {
        const normalized = normalizeAuth0Domain(value)
        if (!normalized) {
          return 'Domain is required'
        }

        return true
      },
    }),
  )

  const clientId = (
    await input({
      message: 'Auth0 M2M Client ID',
      required: true,
      validate: (value) => (value.trim() ? true : 'Client ID is required'),
    })
  ).trim()

  const clientSecret = (
    await password({
      mask: '*',
      message: 'Auth0 M2M Client Secret',
      validate: (value) => (value.trim() ? true : 'Client secret is required'),
    })
  ).trim()

  return {clientId, clientSecret, domain}
}

export async function promptOverwrite(configPath: string): Promise<boolean> {
  return confirm({
    default: false,
    message: `Profile already exists at ${configPath}. Overwrite?`,
  })
}

export async function promptSetDefault(
  profileName: string,
  targetDir: string,
): Promise<boolean> {
  const currentDefault = readRepoDefaultProfile(targetDir)
  if (currentDefault === profileName) {
    return false
  }

  return confirm({
    default: currentDefault === undefined,
    message:
      currentDefault === undefined
        ? `Set "${profileName}" as the default profile for this repo?`
        : `Set "${profileName}" as the default profile? (current default: ${currentDefault})`,
  })
}
