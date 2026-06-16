export interface Auth0Identity {
  connection: string
  user_id: string
  provider: string
  isSocial?: boolean
}

export interface Auth0User {
  user_id: string
  email?: string
  name?: string
  created_at?: string
  last_login?: string
  logins_count?: number
  blocked?: boolean
  identities?: Auth0Identity[]
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

export interface Auth0UsersSearchResponse {
  start: number
  limit: number
  length: number
  total: number
  users: Auth0User[]
}

export interface Auth0Log {
  log_id: string
  date: string
  type: string
  description?: string
  user_id?: string
  user_name?: string
  ip?: string
  client_name?: string
}

export type Auth0LogsResponse = Auth0Log[]

export interface Auth0TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface Auth0UserUpdate {
  blocked?: boolean
}

export interface Auth0Organization {
  id: string
  name: string
  display_name?: string
  metadata?: Record<string, unknown>
}

export interface Auth0OrganizationsResponse {
  start: number
  limit: number
  length: number
  total: number
  organizations: Auth0Organization[]
}

export interface Auth0OrganizationMembersResponse {
  start: number
  limit: number
  length: number
  total: number
  members: Auth0User[]
}
