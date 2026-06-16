import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const authFlags = ['--domain', DOMAIN, '--client-id', 'cid', '--client-secret', 'secret']

const sampleOrg = {display_name: 'Acme Corp', id: 'org_1', name: 'acme-corp'}

const sampleMember = {
  email: 'member@example.com',
  name: 'Member User',
  user_id: 'auth0|1',
}

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

describe('auth0 orgs members list', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('lists members by org name', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations/name/acme-corp')
      .reply(200, sampleOrg)

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

    const {stdout} = await runCommand([
      'auth0:orgs:members:list',
      ...authFlags,
      '--org-name',
      'acme-corp',
      '--json',
    ])

    const result = JSON.parse(stdout) as {
      org: {name: string}
      members: Array<{user_id: string}>
    }

    expect(result.org.name).to.equal('acme-corp')
    expect(result.members).to.have.length(1)
    expect(result.members[0].user_id).to.equal('auth0|1')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('renders human output without json', async () => {
    mockToken()
    nock(BASE).get('/api/v2/organizations/name/acme-corp').reply(200, sampleOrg)
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

    const {stdout} = await runCommand([
      'auth0:orgs:members:list',
      ...authFlags,
      '--org-name',
      'acme-corp',
    ])

    expect(stdout).to.contain('acme-corp')
    expect(stdout).to.contain('member@example.com')
    expect(nock.pendingMocks()).to.have.length(0)
  })
})

describe('auth0 orgs members add', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('dry-run lists candidates without posting members', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations/name/acme-corp')
      .reply(200, sampleOrg)

    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'member@example.com'})
      .reply(200, [sampleMember])

    nock(BASE)
      .get('/api/v2/organizations/org_1/members')
      .query(true)
      .reply(200, {length: 0, limit: 100, members: [], start: 0, total: 0})

    const {stdout} = await runCommand([
      'auth0:orgs:members:add',
      ...authFlags,
      '--org-name',
      'acme-corp',
      '--email',
      'member@example.com',
      '--json',
    ])

    const result = JSON.parse(stdout) as {
      dryRun: boolean
      candidates: Array<{user_id: string}>
      updated: string[]
    }

    expect(result.dryRun).to.equal(true)
    expect(result.candidates).to.have.length(1)
    expect(result.updated).to.have.length(0)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('confirm adds eligible members', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations/name/acme-corp')
      .reply(200, sampleOrg)

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
      .reply(204)

    const {stdout} = await runCommand([
      'auth0:orgs:members:add',
      ...authFlags,
      '--org-name',
      'acme-corp',
      '--email',
      'member@example.com',
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {updated: string[]}
    expect(result.updated).to.deep.equal(['auth0|1'])
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('dry-run renders human output without json', async () => {
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

    const {stdout} = await runCommand([
      'auth0:orgs:members:add',
      ...authFlags,
      '--org-name',
      'acme-corp',
      '--email',
      'member@example.com',
    ])

    expect(stdout).to.contain('Would add to org acme-corp')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('records add errors and exits non-zero when confirm fails', async () => {
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

    const {stdout, error} = await runCommand([
      'auth0:orgs:members:add',
      ...authFlags,
      '--org-name',
      'acme-corp',
      '--email',
      'member@example.com',
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {errors: Array<{user_id: string}>}
    expect(result.errors).to.have.length(1)
    expect(error).to.not.equal(undefined)
  })
})

describe('auth0 orgs members remove', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('confirm removes eligible members', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations/name/acme-corp')
      .reply(200, sampleOrg)

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

    nock(BASE)
      .delete('/api/v2/organizations/org_1/members', {members: ['auth0|1']})
      .reply(204)

    const {stdout} = await runCommand([
      'auth0:orgs:members:remove',
      ...authFlags,
      '--org-name',
      'acme-corp',
      '--email',
      'member@example.com',
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {updated: string[]}
    expect(result.updated).to.deep.equal(['auth0|1'])
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('dry-run renders human output without json', async () => {
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

    const {stdout} = await runCommand([
      'auth0:orgs:members:remove',
      ...authFlags,
      '--org-name',
      'acme-corp',
      '--email',
      'member@example.com',
    ])

    expect(stdout).to.contain('Would remove from org acme-corp')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('records remove errors and exits non-zero when confirm fails', async () => {
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
    nock(BASE)
      .delete('/api/v2/organizations/org_1/members', {members: ['auth0|1']})
      .reply(500, 'fail')

    const {stdout, error} = await runCommand([
      'auth0:orgs:members:remove',
      ...authFlags,
      '--org-name',
      'acme-corp',
      '--email',
      'member@example.com',
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {errors: Array<{user_id: string}>}
    expect(result.errors).to.have.length(1)
    expect(error).to.not.equal(undefined)
  })
})
