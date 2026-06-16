import {Auth0Client} from './client'
import {type Auth0Organization} from './types'

export interface ResolveOrgOptions {
  orgId?: string
  orgName?: string
}

export async function resolveOrganization(
  client: Auth0Client,
  options: ResolveOrgOptions,
): Promise<Auth0Organization> {
  if (options.orgId) {
    return client.getOrganizationById(options.orgId)
  }

  if (options.orgName) {
    return client.getOrganizationByName(options.orgName)
  }

  throw new Error('One of --org-id or --org-name is required')
}

export function validateOrgFlags(flags: {orgId?: string; orgName?: string}): void {
  const set = [flags.orgId, flags.orgName].filter(Boolean)
  if (set.length === 0) {
    throw new Error('One of --org-id or --org-name is required')
  }
  if (set.length > 1) {
    throw new Error('Only one of --org-id or --org-name may be specified')
  }
}
