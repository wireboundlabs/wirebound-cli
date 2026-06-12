import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import {homedir} from 'node:os'
import {dirname, join, resolve} from 'node:path'

import {parse} from 'dotenv'

export const GITIGNORE_ENTRY = '.wirebound/'
const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

function globalProfilePath(name: string): string {
  return join(homedir(), '.config', 'wirebound', 'profiles', `${name}.env`)
}

export function validateProfileName(name: string): string | true {
  const trimmed = name.trim()
  if (!trimmed) {
    return 'Profile name is required'
  }

  if (!PROFILE_NAME_PATTERN.test(trimmed)) {
    return 'Use letters, numbers, hyphens, and underscores (must start with a letter or number)'
  }

  return true
}

export function normalizeProfileName(name: string): string {
  return name.trim()
}

function findRepoRoot(startDir = process.cwd()): string | undefined {
  let dir = resolve(startDir)

  while (true) {
    if (existsSync(join(dir, '.wirebound'))) {
      return dir
    }

    const parent = dirname(dir)
    if (parent === dir) {
      break
    }

    dir = parent
  }

  return undefined
}

function repoProfilesDir(cwd: string): string {
  return join(resolve(cwd), '.wirebound', 'profiles')
}

export function repoProfilePath(cwd: string, name: string): string {
  return join(repoProfilesDir(cwd), `${name}.env`)
}

function repoConfigPath(cwd: string): string {
  return join(resolve(cwd), '.wirebound', 'config.env')
}

function repoDefaultProfilePath(cwd: string): string {
  return join(resolve(cwd), '.wirebound', 'default')
}

export function findRepoProfilePath(
  name: string,
  startDir = process.cwd(),
): string | undefined {
  const root = findRepoRoot(startDir)
  if (!root) {
    return undefined
  }

  const path = repoProfilePath(root, name)
  return existsSync(path) ? path : undefined
}

export function findRepoConfig(startDir = process.cwd()): string | undefined {
  const root = findRepoRoot(startDir)
  if (!root) {
    return undefined
  }

  const legacyPath = repoConfigPath(root)
  return existsSync(legacyPath) ? legacyPath : undefined
}

export function readRepoDefaultProfile(startDir = process.cwd()): string | undefined {
  const root = findRepoRoot(startDir)
  if (!root) {
    return undefined
  }

  const defaultPath = repoDefaultProfilePath(root)
  if (!existsSync(defaultPath)) {
    return undefined
  }

  const name = readFileSync(defaultPath, 'utf8').trim()
  return name || undefined
}

export function writeRepoDefaultProfile(cwd: string, name: string): string {
  const path = repoDefaultProfilePath(cwd)
  mkdirSync(dirname(path), {recursive: true})
  writeFileSync(path, `${name}\n`, 'utf8')
  return path
}

export function listRepoProfiles(startDir = process.cwd()): string[] {
  const root = findRepoRoot(startDir)
  if (!root) {
    return []
  }

  const profilesDir = repoProfilesDir(root)
  if (!existsSync(profilesDir)) {
    return []
  }

  return readdirSync(profilesDir)
    .filter((file) => file.endsWith('.env'))
    .map((file) => file.slice(0, -'.env'.length))
    .sort((a, b) => a.localeCompare(b))
}

export function loadConfigFile(path: string): Record<string, string> {
  const content = readFileSync(path, 'utf8')
  const parsed = parse(content)

  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) {
      vars[key] = value
    }
  }

  return vars
}

function loadGlobalProfile(name: string): Record<string, string> {
  const path = globalProfilePath(name)

  if (!existsSync(path)) {
    throw new Error(`Profile not found: ${path}`)
  }

  return loadConfigFile(path)
}

function profileNotFoundMessage(name: string, startDir = process.cwd()): string {
  const repoProfiles = listRepoProfiles(startDir)
  const lines = [`Profile not found: ${name}`]

  if (repoProfiles.length > 0) {
    lines.push(`Available repo profiles: ${repoProfiles.join(', ')}`)
  }

  lines.push(`Create one with: wirebound setup --profile ${name}`)
  return lines.join('\n')
}

export function resolveProfileVars(
  profileName?: string,
  startDir = process.cwd(),
): Record<string, string> | undefined {
  const explicitName = profileName ? normalizeProfileName(profileName) : undefined

  if (explicitName) {
    const repoPath = findRepoProfilePath(explicitName, startDir)
    if (repoPath) {
      return loadConfigFile(repoPath)
    }

    try {
      return loadGlobalProfile(explicitName)
    } catch {
      throw new Error(profileNotFoundMessage(explicitName, startDir))
    }
  }

  const defaultName = readRepoDefaultProfile(startDir)
  if (defaultName) {
    const defaultPath = findRepoProfilePath(defaultName, startDir)
    if (defaultPath) {
      return loadConfigFile(defaultPath)
    }
  }

  const legacyPath = findRepoConfig(startDir)
  if (legacyPath) {
    return loadConfigFile(legacyPath)
  }

  return undefined
}

export function formatConfigFile(
  vars: Record<string, string>,
  profileName?: string,
): string {
  const profileLine = profileName
    ? `# Profile: ${profileName}`
    : '# Wirebound CLI — repo-local config (do not commit)'

  const lines = [
    profileLine,
    '# Created by: wirebound setup',
    '',
    '# Auth0 — required for wirebound auth0:* commands',
    `AUTH0_DOMAIN=${vars.AUTH0_DOMAIN ?? ''}`,
    `AUTH0_MGMT_CLIENT_ID=${vars.AUTH0_MGMT_CLIENT_ID ?? ''}`,
    `AUTH0_MGMT_CLIENT_SECRET=${vars.AUTH0_MGMT_CLIENT_SECRET ?? ''}`,
    '',
  ]

  return lines.join('\n')
}

export function writeRepoProfile(
  cwd: string,
  name: string,
  vars: Record<string, string>,
): string {
  const dir = repoProfilesDir(cwd)
  const path = repoProfilePath(cwd, name)

  mkdirSync(dir, {recursive: true})
  writeFileSync(path, formatConfigFile(vars, name), {encoding: 'utf8', mode: 0o600})
  chmodSync(path, 0o600)

  return path
}

export function ensureGitignore(cwd: string): boolean {
  const gitignorePath = join(resolve(cwd), '.gitignore')
  if (!existsSync(gitignorePath)) {
    return false
  }

  const content = readFileSync(gitignorePath, 'utf8')
  const lines = content.split('\n')
  const hasEntry = lines.some((line) => {
    const trimmed = line.trim()
    return (
      trimmed === GITIGNORE_ENTRY ||
      trimmed === '.wirebound' ||
      trimmed === '.wirebound/**' ||
      trimmed === '.wirebound/*'
    )
  })

  if (hasEntry) {
    return false
  }

  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n'
  writeFileSync(gitignorePath, `${content}${suffix}${GITIGNORE_ENTRY}\n`, 'utf8')

  return true
}

export function normalizeAuth0Domain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function formatProfileList(
  profiles: string[],
  defaultProfile?: string,
): string {
  if (profiles.length === 0) {
    return 'No repo profiles found. Run wirebound setup to create one.'
  }

  return profiles
    .map((name) => {
      const suffix = name === defaultProfile ? ' (default)' : ''
      return `  ${name}${suffix}`
    })
    .join('\n')
}
