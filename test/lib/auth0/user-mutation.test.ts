import {expect} from 'chai'
import nock from 'nock'

import {createTestAuth0Client} from '@/lib/auth0/create-client'
import {runUserBlockMutation} from '@/lib/auth0/user-mutation'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const config = {
  clientId: 'cid',
  clientSecret: 'secret',
  domain: DOMAIN,
  rps: 10,
}

const blockedUser = {
  blocked: true,
  email: 'blocked@example.com',
  user_id: 'auth0|1',
}

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

describe('runUserBlockMutation', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('skips users that already match the target blocked state', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'blocked@example.com'})
      .reply(200, [blockedUser])

    const client = createTestAuth0Client(config)
    const result = await runUserBlockMutation(client, {
      blocked: true,
      confirm: false,
      email: 'blocked@example.com',
      logVerbose: () => {},
    })

    expect(result.candidates).to.have.length(0)
  })

  it('unblocks users when blocked is false', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'blocked@example.com'})
      .reply(200, [blockedUser])
    nock(BASE)
      .patch('/api/v2/users/auth0%7C1', {blocked: false})
      .reply(200, {...blockedUser, blocked: false})

    const logs: string[] = []
    const client = createTestAuth0Client(config)
    const result = await runUserBlockMutation(client, {
      blocked: false,
      confirm: true,
      email: 'blocked@example.com',
      logVerbose: (message) => logs.push(message),
    })

    expect(result.updated).to.deep.equal(['auth0|1'])
    expect(logs.some((line) => line.includes('Unblocked auth0|1'))).to.equal(true)
  })

  it('uses progress hooks during confirm', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [{blocked: false, email: 'user@example.com', user_id: 'auth0|2'}])
    nock(BASE)
      .patch('/api/v2/users/auth0%7C2', {blocked: true})
      .reply(200, {blocked: true, user_id: 'auth0|2'})

    const progressEvents: string[] = []
    const progress = {
      fetchPage() {
        progressEvents.push('fetchPage')
      },
      fetchStart(label: string) {
        progressEvents.push(`fetchStart:${label}`)
      },
      fetchStop() {
        progressEvents.push('fetchStop')
      },
      taskAdvance() {
        progressEvents.push('taskAdvance')
      },
      taskStart(label: string) {
        progressEvents.push(`taskStart:${label}`)
      },
      taskStop() {
        progressEvents.push('taskStop')
      },
      async spinAsync<T>(_message: string, fn: () => Promise<T>) {
        return fn()
      },
    }

    const client = createTestAuth0Client(config)
    await runUserBlockMutation(client, {
      blocked: true,
      confirm: true,
      email: 'user@example.com',
      logVerbose: () => {},
      progress,
    })

    expect(progressEvents).to.include('fetchStart:Finding users')
    expect(progressEvents).to.include('taskStart:Blocking users')
    expect(progressEvents).to.include('taskAdvance')
  })

  it('records non-Error failures while updating users', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [{blocked: false, email: 'user@example.com', user_id: 'auth0|2'}])
    nock(BASE).patch('/api/v2/users/auth0%7C2', {blocked: true}).reply(500, 'fail')

    const client = createTestAuth0Client(config)
    const result = await runUserBlockMutation(client, {
      blocked: true,
      confirm: true,
      email: 'user@example.com',
      logVerbose: () => {},
    })

    expect(result.errors).to.have.length(1)
    expect(result.errors[0].user_id).to.equal('auth0|2')
  })
})
