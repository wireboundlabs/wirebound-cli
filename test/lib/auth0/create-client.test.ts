import {expect} from 'chai'
import nock from 'nock'

import {createAuth0Client, createTestAuth0Client} from '@/lib/auth0/create-client'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

describe('createAuth0Client', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('createTestAuth0Client accepts overrides and retry hooks', async () => {
    const retries: string[] = []
    nock(BASE)
      .post('/oauth/token')
      .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
    nock(BASE)
      .get('/api/v2/users/auth0%7C1')
      .reply(200, {email: 'a@example.com', user_id: 'auth0|1'})

    const client = createTestAuth0Client(
      {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: DOMAIN,
        plan: 'enterprise',
        rps: 16,
        tenantEnvironment: 'production',
      },
      {onRetry: (message) => retries.push(message)},
    )
    const user = await client.getUserById('auth0|1')

    expect(user.user_id).to.equal('auth0|1')
    expect(retries).to.deep.equal([])
  })

  it('createAuth0Client forwards onRetry to the limiter', async () => {
    const retries: string[] = []
    const client = createAuth0Client(
      {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: DOMAIN,
        plan: 'free',
        rps: 100,
        tenantEnvironment: 'production',
      },
      {
        onRetry: (message) => retries.push(message),
      },
    )

    nock(BASE)
      .post('/oauth/token')
      .times(2)
      .reply(429, {}, {'x-ratelimit-reset': '0'})
      .post('/oauth/token')
      .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})

    await client.getToken()

    expect(retries.length).to.be.greaterThan(0)
  })
})
