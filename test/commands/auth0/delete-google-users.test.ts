import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const googleOnlyUser = {
  created_at: '2024-01-01T00:00:00.000Z',
  email: 'solo@gmail.com',
  identities: [{connection: 'google-oauth2', provider: 'google-oauth2', user_id: '123'}],
  user_id: 'google-oauth2|123',
}

const linkedUser = {
  email: 'linked@gmail.com',
  identities: [
    {connection: 'google-oauth2', provider: 'google-oauth2', user_id: '456'},
    {connection: 'Username-Password-Authentication', provider: 'auth0', user_id: 'abc'},
  ],
  user_id: 'auth0|abc',
}

const databaseOnlyUser = {
  email: 'db@example.com',
  identities: [
    {connection: 'Username-Password-Authentication', provider: 'auth0', user_id: 'def'},
  ],
  user_id: 'auth0|def',
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

describe('auth0 delete-google-users', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('dry-run lists only google-only users and performs no deletes', async () => {
    mockToken()
    mockUserSearch([googleOnlyUser, linkedUser, databaseOnlyUser])

    const {stdout} = await runCommand([
      'auth0:delete-google-users',
      '--domain',
      DOMAIN,
      '--client-id',
      'cid',
      '--client-secret',
      'secret',
    ])

    expect(stdout).to.contain('solo@gmail.com')
    expect(stdout).to.contain('google-oauth2|123')
    expect(stdout).to.contain('dry run')
    expect(stdout).not.to.contain('linked@gmail.com')
    expect(stdout).not.to.contain('db@example.com')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('json dry-run returns only eligible candidates', async () => {
    mockToken()
    mockUserSearch([googleOnlyUser, linkedUser, databaseOnlyUser])

    const {stdout} = await runCommand([
      'auth0:delete-google-users',
      '--domain',
      DOMAIN,
      '--client-id',
      'cid',
      '--client-secret',
      'secret',
      '--json',
    ])

    const result = JSON.parse(stdout) as {
      dryRun: boolean
      eligible: number
      candidates: Array<{user_id: string}>
      deleted: string[]
    }

    expect(result.dryRun).to.equal(true)
    expect(result.eligible).to.equal(1)
    expect(result.candidates).to.have.length(1)
    expect(result.candidates[0].user_id).to.equal('google-oauth2|123')
    expect(result.deleted).to.have.length(0)
  })

  it('confirm deletes only eligible google-only users', async () => {
    mockToken()
    mockUserSearch([googleOnlyUser, linkedUser])

    nock(BASE)
      .delete('/api/v2/users/google-oauth2%7C123')
      .reply(204)

    const {stdout} = await runCommand([
      'auth0:delete-google-users',
      '--domain',
      DOMAIN,
      '--client-id',
      'cid',
      '--client-secret',
      'secret',
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {deleted: string[]; errors: unknown[]}
    expect(result.deleted).to.deep.equal(['google-oauth2|123'])
    expect(result.errors).to.have.length(0)
    expect(nock.pendingMocks()).to.have.length(0)
  })
})
