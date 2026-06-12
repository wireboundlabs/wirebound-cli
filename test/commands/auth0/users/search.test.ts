import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const sampleUser = {
  blocked: false,
  created_at: '2024-01-01T00:00:00.000Z',
  email: 'user@example.com',
  last_login: '2024-06-01T00:00:00.000Z',
  user_id: 'auth0|1',
}

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

function mockUserSearch(users: unknown[]): void {
  nock(BASE)
    .get('/api/v2/users')
    .query(true)
    .reply(200, {
      length: users.length,
      limit: 100,
      start: 0,
      total: users.length,
      users,
    })
}

const authFlags = ['--domain', DOMAIN, '--client-id', 'cid', '--client-secret', 'secret']

describe('auth0 users search', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('returns matching users in human output', async () => {
    mockToken()
    mockUserSearch([sampleUser])

    const {stdout} = await runCommand([
      'auth0:users:search',
      ...authFlags,
      '--query',
      'email:user@example.com',
    ])

    expect(stdout).to.contain('user@example.com')
    expect(stdout).to.contain('auth0|1')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('returns json output', async () => {
    mockToken()
    mockUserSearch([sampleUser])

    const {stdout} = await runCommand([
      'auth0:users:search',
      ...authFlags,
      '--query',
      'email:user@example.com',
      '--json',
    ])

    const result = JSON.parse(stdout) as {
      total: number
      users: Array<{email: string}>
    }

    expect(result.total).to.equal(1)
    expect(result.users[0].email).to.equal('user@example.com')
    expect(nock.pendingMocks()).to.have.length(0)
  })
})
