import {expect} from 'chai'
import nock from 'nock'

import {createTestAuth0Client} from '@/lib/auth0/create-client'
import {resolveUsers, validateTargetFlags} from '@/lib/auth0/resolve-users'

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

describe('resolveUsers', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('validateTargetFlags requires exactly one target', () => {
    expect(() => validateTargetFlags({})).to.throw(
      'One of --email, --id, or --query is required',
    )
    expect(() => validateTargetFlags({email: 'a@b.com', id: 'auth0|1'})).to.throw(
      'Only one of --email, --id, or --query may be specified',
    )
    expect(() => validateTargetFlags({query: 'email:a@b.com'})).to.not.throw()
    expect(() => validateTargetFlags({id: 'auth0|1'})).to.not.throw()
    expect(() => validateTargetFlags({email: 'a@b.com'})).to.not.throw()
  })

  it('resolveUsers throws when no target is provided', async () => {
    const client = createTestAuth0Client(config)

    try {
      await resolveUsers(client, {})
      expect.fail('expected resolveUsers to throw')
    } catch (error) {
      expect((error as Error).message).to.contain('One of --email, --id, or --query is required')
    }
  })

  it('resolveUsers fetches a user by id', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users/auth0%7C1')
      .reply(200, {email: 'user@example.com', user_id: 'auth0|1'})

    const client = createTestAuth0Client(config)
    const users = await resolveUsers(client, {id: 'auth0|1'})

    expect(users).to.deep.equal([{email: 'user@example.com', user_id: 'auth0|1'}])
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('resolveUsers fetches users by email', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [{email: 'user@example.com', user_id: 'auth0|1'}])

    const client = createTestAuth0Client(config)
    const users = await resolveUsers(client, {email: 'user@example.com'})

    expect(users).to.have.length(1)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('resolveUsers searches by query and reports page progress', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users')
      .query(true)
      .reply(200, {
        length: 1,
        limit: 100,
        start: 0,
        total: 1,
        users: [{email: 'user@example.com', user_id: 'auth0|1'}],
      })

    const pages: string[] = []
    const client = createTestAuth0Client(config)
    const users = await resolveUsers(client, {
      limit: 10,
      onPage: ({page, rawCount, total}) => {
        pages.push(`${page}:${rawCount}:${total}`)
      },
      query: 'email:user@example.com',
    })

    expect(users).to.have.length(1)
    expect(pages).to.deep.equal(['0:1:1'])
    expect(nock.pendingMocks()).to.have.length(0)
  })
})
