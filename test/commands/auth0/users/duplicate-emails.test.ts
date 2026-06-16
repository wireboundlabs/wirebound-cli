import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const authFlags = ['--domain', DOMAIN, '--client-id', 'cid', '--client-secret', 'secret']

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

describe('auth0 users duplicate-emails', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('reports duplicate email groups', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users')
      .query(true)
      .reply(200, {
        length: 3,
        limit: 100,
        start: 0,
        total: 3,
        users: [
          {
            email: 'shared@example.com',
            identities: [{connection: 'google-oauth2', provider: 'google-oauth2', user_id: '1'}],
            user_id: 'google-oauth2|1',
          },
          {
            email: 'shared@example.com',
            identities: [{connection: 'auth0', provider: 'auth0', user_id: '2'}],
            user_id: 'auth0|2',
          },
          {
            email: 'solo@example.com',
            identities: [{connection: 'auth0', provider: 'auth0', user_id: '3'}],
            user_id: 'auth0|3',
          },
        ],
      })

    const {stdout} = await runCommand([
      'auth0:users:duplicate-emails',
      ...authFlags,
      '--json',
    ])

    const result = JSON.parse(stdout) as {
      duplicateCount: number
      duplicates: Array<{email: string; count: number}>
    }

    expect(result.duplicateCount).to.equal(1)
    expect(result.duplicates[0].email).to.equal('shared@example.com')
    expect(result.duplicates[0].count).to.equal(2)
    expect(nock.pendingMocks()).to.have.length(0)
  })
})
