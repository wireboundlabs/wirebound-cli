import {CLIError} from '@oclif/core/errors'

import {
  parseAuth0Plan,
  parseAuth0TenantEnvironment,
  resolveGlobalRps,
  type Auth0Plan,
  type Auth0TenantEnvironment,
} from '@/lib/auth0/rate-limit-policy'

export type {Auth0Plan, Auth0TenantEnvironment}

export interface Auth0ConfigInput {
  domain?: string
  clientId?: string
  clientSecret?: string
  plan?: string
  tenantEnvironment?: string
  rps?: number
  profileVars?: Record<string, string>
}

export interface Auth0Config {
  domain: string
  clientId: string
  clientSecret: string
  plan: Auth0Plan
  tenantEnvironment: Auth0TenantEnvironment
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

function readOptionalInt(
  explicit: number | undefined,
  profileVars: Record<string, string> | undefined,
  key: string,
): number | undefined {
  if (explicit !== undefined) {
    if (explicit <= 0) {
      throw new CLIError(`Invalid ${key}: expected a positive integer`)
    }

    return explicit
  }

  const raw = readEnv(profileVars, key)
  if (raw === undefined) return undefined

  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new CLIError(`Invalid ${key}: expected a positive integer`)
  }

  return parsed
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

function resolvePlan(input: Auth0ConfigInput): Auth0Plan {
  const raw = firstDefined(
    input.plan,
    readEnv(input.profileVars, 'AUTH0_PLAN'),
  )

  try {
    return parseAuth0Plan(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CLIError(message)
  }
}

function resolveTenantEnvironment(input: Auth0ConfigInput): Auth0TenantEnvironment {
  const raw = firstDefined(
    input.tenantEnvironment,
    readEnv(input.profileVars, 'AUTH0_TENANT_ENV'),
  )

  try {
    return parseAuth0TenantEnvironment(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CLIError(message)
  }
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

  const plan = resolvePlan(input)
  const tenantEnvironment = resolveTenantEnvironment(input)
  const rpsOverride = readOptionalInt(input.rps, input.profileVars, 'AUTH0_RPS')

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    domain: domain!,
    plan,
    tenantEnvironment,
    rps: resolveGlobalRps(plan, tenantEnvironment, rpsOverride),
  }
}

export function formatRateLimitSummary(config: Auth0Config): string {
  const tenantSuffix =
    config.tenantEnvironment === 'non-production'
      ? ', tenant=non-production'
      : ''
  return `plan=${config.plan}${tenantSuffix}, ${config.rps} req/s global`
}
