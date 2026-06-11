import {type Auth0User} from './types.js'

export function isGoogleOnlyUser(user: Auth0User): boolean {
  const ids = user.identities ?? []
  return ids.length === 1 && ids[0].provider === 'google-oauth2'
}
