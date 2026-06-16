export type Auth0Plan = 'free' | 'essentials-professional' | 'enterprise'

export type Auth0TenantEnvironment = 'production' | 'non-production'

export type Auth0EndpointKey =
  | 'read-users'
  | 'read-users-by-email'
  | 'write-users'
  | 'read-logs'
  | 'read-organizations'
  | 'read-organizations-by-id'
  | 'read-organizations-by-name'
  | 'read-organization-members'
  | 'write-organization-members'
  | 'oauth-token'

/** Sustained requests per minute for Management API endpoints (paid tiers). */
const ESSENTIALS_ENDPOINTS_PER_MINUTE: Partial<Record<Auth0EndpointKey, number>> = {
  'read-users': 500,
  'read-users-by-email': 150,
  'write-users': 200,
  'read-logs': 100,
  'read-organizations': 50,
  'read-organizations-by-id': 200,
  'read-organizations-by-name': 100,
  'read-organization-members': 500,
  'write-organization-members': 200,
}

const ENTERPRISE_ENDPOINTS_PER_MINUTE: Partial<Record<Auth0EndpointKey, number>> = {
  'read-users-by-email': 150,
  'read-organizations-by-name': 200,
  'write-organization-members': 200,
  'read-organization-members': 500,
}

const OAUTH_TOKEN_RPS = 30

export function parseAuth0Plan(value: string | undefined): Auth0Plan {
  if (value === undefined || value === '') return 'free'

  const normalized = value.trim().toLowerCase()
  if (normalized === 'free') return 'free'
  if (
    normalized === 'essentials-professional' ||
    normalized === 'essentials' ||
    normalized === 'professional'
  ) {
    return 'essentials-professional'
  }
  if (normalized === 'enterprise') return 'enterprise'

  throw new Error(
    `Invalid AUTH0_PLAN "${value}". Use free, essentials-professional, or enterprise (or set AUTH0_PLAN / --auth0-plan).`,
  )
}

export function parseAuth0TenantEnvironment(
  value: string | undefined,
): Auth0TenantEnvironment {
  if (value === undefined || value === '') return 'production'

  const normalized = value.trim().toLowerCase()
  if (normalized === 'production' || normalized === 'prod') return 'production'
  if (
    normalized === 'non-production' ||
    normalized === 'nonproduction' ||
    normalized === 'non-prod' ||
    normalized === 'dev' ||
    normalized === 'staging'
  ) {
    return 'non-production'
  }

  throw new Error(
    `Invalid AUTH0_TENANT_ENV "${value}". Use production or non-production (or set AUTH0_TENANT_ENV / --auth0-tenant-env).`,
  )
}

export function resolveDefaultGlobalRps(
  plan: Auth0Plan,
  tenantEnvironment: Auth0TenantEnvironment,
): number {
  if (plan === 'free') return 2

  if (plan === 'enterprise') {
    return tenantEnvironment === 'production' ? 16 : 2
  }

  // Essentials/Professional: 150/min "All other Endpoints Combined" ≈ 2.5/sec
  return 3
}

export function resolveGlobalRps(
  plan: Auth0Plan,
  tenantEnvironment: Auth0TenantEnvironment,
  rpsOverride?: number,
): number {
  if (rpsOverride !== undefined) return rpsOverride
  return resolveDefaultGlobalRps(plan, tenantEnvironment)
}

function perMinuteToMinTimeMs(perMinute: number): number {
  return Math.ceil(60_000 / perMinute)
}

function perSecondToMinTimeMs(perSecond: number): number {
  return Math.ceil(1000 / perSecond)
}

export function resolveEndpointMinTimeMs(
  plan: Auth0Plan,
  tenantEnvironment: Auth0TenantEnvironment,
  endpointKey: Auth0EndpointKey,
): number | undefined {
  if (endpointKey === 'oauth-token') {
    return perSecondToMinTimeMs(OAUTH_TOKEN_RPS)
  }

  if (plan === 'free') {
    return undefined
  }

  const table =
    plan === 'essentials-professional'
      ? ESSENTIALS_ENDPOINTS_PER_MINUTE
      : ENTERPRISE_ENDPOINTS_PER_MINUTE

  const perMinute = table[endpointKey]
  if (perMinute === undefined) {
    if (plan === 'essentials-professional') {
      return perMinuteToMinTimeMs(150)
    }

    return undefined
  }

  return perMinuteToMinTimeMs(perMinute)
}

export function resolveEffectiveMinTimeMs(
  plan: Auth0Plan,
  tenantEnvironment: Auth0TenantEnvironment,
  globalRps: number,
  endpointKey: Auth0EndpointKey,
): number {
  const globalMinTime = perSecondToMinTimeMs(globalRps)
  const endpointMinTime = resolveEndpointMinTimeMs(plan, tenantEnvironment, endpointKey)
  if (endpointMinTime === undefined) return globalMinTime
  return Math.max(globalMinTime, endpointMinTime)
}
