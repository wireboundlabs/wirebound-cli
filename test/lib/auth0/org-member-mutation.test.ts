import {expect} from 'chai'
import nock from 'nock'

import {Auth0Client} from '@/lib/auth0/client'
import {runOrgMemberMutation} from '@/lib/auth0/org-member-mutation'
import {RateLimiter} from '@/lib/rate-limiter'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const config = {
  clientId: 'cid',
  clientSecret: 'secret',
  domain: DOMAIN,
  rps: 10,
}

const sampleOrg = {display_name: 'Acme Corp', id: 'org_1', name: 'acme-corp'}

const sampleMember = {
  email: 'member@example.com',
  user_id: 'auth0|1',
}

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

describe('runOrgMemberMutation', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('skips users already in the org on add', async () => {
    mockToken()
    nock(BASE).get('/api/v2/organizations/name/acme-corp').reply(200, sampleOrg)
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'member@example.com'})
      .reply(200, [sampleMember])
    nock(BASE)
      .get('/api/v2/organizations/org_1/members')
      .query(true)
      .reply(200, {
        length: 1,
        limit: 100,
        members: [sampleMember],
        start: 0,
        total: 1,
      })

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const result = await runOrgMemberMutation(client, {
      action: 'add',
      confirm: false,
      email: 'member@example.com',
      logVerbose: () => {},
      orgName: 'acme-corp',
    })

    expect(result.candidates).to.have.length(0)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('skips users not in the org on remove dry-run', async () => {
    mockToken()
    nock(BASE).get('/api/v2/organizations/org_1').reply(200, sampleOrg)
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'member@example.com'})
      .reply(200, [sampleMember])
    nock(BASE)
      .get('/api/v2/organizations/org_1/members')
      .query(true)
      .reply(200, {length: 0, limit: 100, members: [], start: 0, total: 0})

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const result = await runOrgMemberMutation(client, {
      action: 'remove',
      confirm: false,
      email: 'member@example.com',
      logVerbose: () => {},
      orgId: 'org_1',
    })

    expect(result.candidates).to.have.length(0)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('uses progress hooks when a reporter is provided', async () => {
    mockToken()
    nock(BASE).get('/api/v2/organizations/name/acme-corp').reply(200, sampleOrg)
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'member@example.com'})
      .reply(200, [sampleMember])
    nock(BASE)
      .get('/api/v2/organizations/org_1/members')
      .query(true)
      .reply(200, {length: 0, limit: 100, members: [], start: 0, total: 0})

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
      async spinAsync<T>(message: string, fn: () => Promise<T>) {
        progressEvents.push(`spin:${message}`)
        return fn()
      },
    }

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    await runOrgMemberMutation(client, {
      action: 'add',
      confirm: false,
      email: 'member@example.com',
      logVerbose: () => {},
      orgName: 'acme-corp',
      progress,
    })

    expect(progressEvents[0]).to.equal('spin:Resolving organization')
    expect(progressEvents).to.include('fetchStart:Finding users')
    expect(progressEvents).to.include('fetchStart:Loading org members')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('records errors when confirm add fails', async () => {
    mockToken()
    nock(BASE).get('/api/v2/organizations/name/acme-corp').reply(200, sampleOrg)
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'member@example.com'})
      .reply(200, [sampleMember])
    nock(BASE)
      .get('/api/v2/organizations/org_1/members')
      .query(true)
      .reply(200, {length: 0, limit: 100, members: [], start: 0, total: 0})
    nock(BASE)
      .post('/api/v2/organizations/org_1/members', {members: ['auth0|1']})
      .reply(500, 'fail')

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const logs: string[] = []
    const result = await runOrgMemberMutation(client, {
      action: 'add',
      confirm: true,
      email: 'member@example.com',
      logVerbose: (message) => logs.push(message),
      orgName: 'acme-corp',
    })

    expect(result.errors).to.have.length(1)
    expect(result.errors[0].user_id).to.equal('auth0|1')
    expect(nock.pendingMocks()).to.have.length(0)
  })
})
