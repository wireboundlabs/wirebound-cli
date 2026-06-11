export interface Auth0Identity {
  connection: string
  user_id: string
  provider: string
  isSocial?: boolean
}

export interface Auth0User {
  user_id: string
  email?: string
  created_at?: string
  identities?: Auth0Identity[]
}

export interface Auth0UsersSearchResponse {
  start: number
  limit: number
  length: number
  total: number
  users: Auth0User[]
}

export interface Auth0TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}
