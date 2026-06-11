import {existsSync, readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

import {parse} from 'dotenv'

export function profilePath(name: string): string {
  return join(homedir(), '.config', 'wirebound', 'profiles', `${name}.env`)
}

export function loadProfile(name: string): Record<string, string> {
  const path = profilePath(name)

  if (!existsSync(path)) {
    throw new Error(`Profile not found: ${path}`)
  }

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
