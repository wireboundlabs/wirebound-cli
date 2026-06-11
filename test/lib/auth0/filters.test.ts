import {expect} from 'chai'

import {isGoogleOnlyUser} from '../../../src/lib/auth0/filters.js'
import {type Auth0User} from '../../../src/lib/auth0/types.js'

function user(identities: Auth0User['identities']): Auth0User {
  return {identities, user_id: 'test'}
}

describe('isGoogleOnlyUser', () => {
  it('returns true for a single google-oauth2 identity', () => {
    expect(
      isGoogleOnlyUser(
        user([{connection: 'google-oauth2', provider: 'google-oauth2', user_id: '1'}]),
      ),
    ).to.equal(true)
  })

  it('returns false for a single auth0 database identity', () => {
    expect(
      isGoogleOnlyUser(
        user([{connection: 'Username-Password-Authentication', provider: 'auth0', user_id: '1'}]),
      ),
    ).to.equal(false)
  })

  it('returns false when google is linked with a database identity', () => {
    expect(
      isGoogleOnlyUser(
        user([
          {connection: 'google-oauth2', provider: 'google-oauth2', user_id: '1'},
          {connection: 'Username-Password-Authentication', provider: 'auth0', user_id: '2'},
        ]),
      ),
    ).to.equal(false)
  })

  it('returns false for empty identities', () => {
    expect(isGoogleOnlyUser(user([]))).to.equal(false)
    expect(isGoogleOnlyUser(user(undefined))).to.equal(false)
  })

  it('returns false for a single non-google provider string', () => {
    expect(
      isGoogleOnlyUser(
        user([{connection: 'github', provider: 'github', user_id: '1'}]),
      ),
    ).to.equal(false)
  })
})
