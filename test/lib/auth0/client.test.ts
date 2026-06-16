import {expect} from 'chai'
import nock from 'nock'

import {Auth0Client} from '@/lib/auth0/client'
import {RateLimiter} from '@/lib/rate-limiter'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const config = {
  clientId: 'cid',
  clientSecret: 'secret',
  domain: DOMAIN,
  rps: 10,
}

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

describe('Auth0Client', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('searchUsers returns paginated results', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users')
      .query(true)
      .reply(200, {
        length: 1,
        limit: 100,
        start: 0,
        total: 1,
        users: [{email: 'a@example.com', user_id: 'auth0|1'}],
      })

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const {total, users} = await client.searchUsers('email:a@example.com')

    expect(total).to.equal(1)
    expect(users).to.have.length(1)
    expect(users[0].user_id).to.equal('auth0|1')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('getUserById fetches a single user', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users/auth0%7C1')
      .reply(200, {email: 'a@example.com', user_id: 'auth0|1'})

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const user = await client.getUserById('auth0|1')

    expect(user.user_id).to.equal('auth0|1')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('getUsersByEmail returns matching users', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'a@example.com'})
      .reply(200, [{email: 'a@example.com', user_id: 'auth0|1'}])

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const users = await client.getUsersByEmail('a@example.com')

    expect(users).to.have.length(1)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('updateUser patches user fields', async () => {
    mockToken()
    nock(BASE)
      .patch('/api/v2/users/auth0%7C1', {blocked: true})
      .reply(200, {blocked: true, user_id: 'auth0|1'})

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const user = await client.updateUser('auth0|1', {blocked: true})

    expect(user.blocked).to.equal(true)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('searchLogs returns log entries', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/logs')
      .query(true)
      .reply(200, [
        {
          date: '2026-06-01T00:00:00.000Z',
          description: 'Failed login',
          log_id: 'log1',
          type: 'f',
        },
      ])

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const {logs} = await client.searchLogs('type:f', {limit: 10})

    expect(logs).to.have.length(1)
    expect(logs[0].type).to.equal('f')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('findDuplicateEmails groups users with shared email', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users')
      .query(true)
      .reply(200, {
        length: 2,
        limit: 100,
        start: 0,
        total: 2,
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
        ],
      })

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const {duplicates, scanned} = await client.findDuplicateEmails()

    expect(scanned).to.equal(2)
    expect(duplicates).to.have.length(1)
    expect(duplicates[0].email).to.equal('shared@example.com')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('listOrganizations returns paginated organizations', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations')
      .query(true)
      .reply(200, {
        length: 1,
        limit: 100,
        organizations: [{id: 'org_1', name: 'acme-corp'}],
        start: 0,
        total: 1,
      })

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const {organizations, total} = await client.listOrganizations()

    expect(total).to.equal(1)
    expect(organizations[0].name).to.equal('acme-corp')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('getOrganizationById fetches a single organization', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations/org_1')
      .reply(200, {id: 'org_1', name: 'acme-corp'})

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const org = await client.getOrganizationById('org_1')

    expect(org.name).to.equal('acme-corp')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('getOrganizationByName fetches a single organization', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations/name/acme-corp')
      .reply(200, {id: 'org_1', name: 'acme-corp'})

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const org = await client.getOrganizationByName('acme-corp')

    expect(org.id).to.equal('org_1')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('listOrganizationMembers returns paginated members', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations/org_1/members')
      .query(true)
      .reply(200, {
        length: 1,
        limit: 100,
        members: [{email: 'user@example.com', user_id: 'auth0|1'}],
        start: 0,
        total: 1,
      })

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const {members, total} = await client.listOrganizationMembers('org_1')

    expect(total).to.equal(1)
    expect(members[0].user_id).to.equal('auth0|1')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('removeOrganizationMembers deletes members', async () => {
    mockToken()
    nock(BASE)
      .delete('/api/v2/organizations/org_1/members', {members: ['auth0|1']})
      .reply(204)

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    await client.removeOrganizationMembers('org_1', ['auth0|1'])

    expect(nock.pendingMocks()).to.have.length(0)
  })
})
