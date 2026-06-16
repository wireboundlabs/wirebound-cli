import {Auth0Client} from './client'
import {type Auth0User} from './types'

export interface ResolveUsersOptions {
  email?: string
  id?: string
  query?: string
  limit?: number
  onPage?: (info: {page: number; total: number; rawCount: number}) => void
}

export async function resolveUsers(
  client: Auth0Client,
  options: ResolveUsersOptions,
): Promise<Auth0User[]> {
  if (options.id) {
    return [await client.getUserById(options.id)]
  }

  if (options.email) {
    return client.getUsersByEmail(options.email)
  }

  if (options.query) {
    const {users} = await client.searchUsers(options.query, {
      limit: options.limit,
      onPage: options.onPage,
    })
    return users
  }

  throw new Error('One of --email, --id, or --query is required')
}

export function validateTargetFlags(flags: {
  email?: string
  id?: string
  query?: string
}): void {
  const set = [flags.email, flags.id, flags.query].filter(Boolean)
  if (set.length === 0) {
    throw new Error('One of --email, --id, or --query is required')
  }
  if (set.length > 1) {
    throw new Error('Only one of --email, --id, or --query may be specified')
  }
}
