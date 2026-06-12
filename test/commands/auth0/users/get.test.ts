import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const sampleUser = {
  blocked: false,
  created_at: '2024-01-01T00:00:00.000Z',
  email: 'user@example.com',
  identities: [{connection: 'Username-Password-Authentication', provider: 'auth0', user_id: '1'}],
  last_login: '2024-06-01T00:00:00.000Z',
  logins_count: 3,
  name: 'Test User',
  user_id: 'auth0|1',
}

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

const authFlags = ['--domain', DOMAIN, '--client-id', 'cid', '--client-secret', 'secret']

describe('auth0 users get', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('fetches user by id', async () => {
    mockToken()
    nock(BASE).get('/api/v2/users/auth0%7C1').reply(200, sampleUser)

    const {stdout} = await runCommand(['auth0:users:get', ...authFlags, '--id', 'auth0|1'])

    expect(stdout).to.contain('auth0|1')
    expect(stdout).to.contain('user@example.com')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('fetches users by email', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [sampleUser])

    const {stdout} = await runCommand([
      'auth0:users:get',
      ...authFlags,
      '--email',
      'user@example.com',
      '--json',
    ])

    const result = JSON.parse(stdout) as {user_id: string}
    expect(result.user_id).to.equal('auth0|1')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('errors when neither email nor id is provided', async () => {
    const {error} = await runCommand(['auth0:users:get', ...authFlags])
    expect(error?.message).to.contain('Exactly one of --email or --id is required')
  })

  it('errors when both email and id are provided', async () => {
    const {error} = await runCommand([
      'auth0:users:get',
      ...authFlags,
      '--email',
      'user@example.com',
      '--id',
      'auth0|1',
    ])
    expect(error?.message).to.contain('Exactly one of --email or --id is required')
  })
})
