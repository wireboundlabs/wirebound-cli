import {expect} from 'chai'
import nock from 'nock'

import {verifyAuth0Credentials} from '@/lib/config/verify-auth0'

describe('verifyAuth0Credentials', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('succeeds when Auth0 returns an access token', async () => {
    nock('https://tenant.example.com')
      .post('/oauth/token', (body) => {
        expect(body).to.deep.include({
          audience: 'https://tenant.example.com/api/v2/',
          client_id: 'cid',
          client_secret: 'secret',
          grant_type: 'client_credentials',
        })
        return true
      })
      .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})

    await verifyAuth0Credentials({
      clientId: 'cid',
      clientSecret: 'secret',
      domain: 'tenant.example.com',
      rps: 2,
    })

    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('throws when Auth0 rejects the credentials', async () => {
    nock('https://tenant.example.com')
      .post('/oauth/token')
      .reply(401, 'invalid_client')

    try {
      await verifyAuth0Credentials({
        clientId: 'bad',
        clientSecret: 'bad',
        domain: 'tenant.example.com',
        rps: 2,
      })
      expect.fail('Expected verifyAuth0Credentials to throw')
    } catch (error) {
      expect(String(error)).to.contain('Auth0 credential check failed (HTTP 401)')
      expect(String(error)).to.contain('invalid_client')
    }
  })
})
