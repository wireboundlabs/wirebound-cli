import {CLIError} from '@oclif/core/errors'

export interface Auth0ConfigInput {
  domain?: string
  clientId?: string
  clientSecret?: string
  rps?: number
  profileVars?: Record<string, string>
}

export interface Auth0Config {
  domain: string
  clientId: string
  clientSecret: string
  rps: number
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value !== undefined && value !== '') return value
  }

  return undefined
}

function readEnv(
  profileVars: Record<string, string> | undefined,
  key: string,
): string | undefined {
  const fromProfile = profileVars?.[key]
  if (fromProfile !== undefined && fromProfile !== '') return fromProfile

  const fromEnv = process.env[key]
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv

  return undefined
}

function missingAuth0Fields(
  domain: string | undefined,
  clientId: string | undefined,
  clientSecret: string | undefined,
): string[] {
  const missing: string[] = []
  if (!domain) missing.push('domain (AUTH0_DOMAIN or --domain)')
  if (!clientId) missing.push('client ID (AUTH0_MGMT_CLIENT_ID or --client-id)')
  if (!clientSecret) {
    missing.push('client secret (AUTH0_MGMT_CLIENT_SECRET or --client-secret)')
  }

  return missing
}

export function resolveAuth0Config(input: Auth0ConfigInput): Auth0Config {
  const domain = firstDefined(
    input.domain,
    readEnv(input.profileVars, 'AUTH0_DOMAIN'),
  )
  const clientId = firstDefined(
    input.clientId,
    readEnv(input.profileVars, 'AUTH0_MGMT_CLIENT_ID'),
  )
  const clientSecret = firstDefined(
    input.clientSecret,
    readEnv(input.profileVars, 'AUTH0_MGMT_CLIENT_SECRET'),
  )

  const missing = missingAuth0Fields(domain, clientId, clientSecret)
  if (missing.length > 0) {
    throw new CLIError(`Missing required Auth0 configuration: ${missing.join(', ')}`)
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    domain: domain!,
    rps: input.rps ?? 2,
  }
}
