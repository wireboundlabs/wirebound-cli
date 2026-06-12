import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const sampleUser = {
  blocked: false,
  email: 'user@example.com',
  user_id: 'auth0|1',
}

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

const authFlags = ['--domain', DOMAIN, '--client-id', 'cid', '--client-secret', 'secret']

describe('auth0 users block', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('dry-run lists candidates without patching', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [sampleUser])

    const {stdout} = await runCommand([
      'auth0:users:block',
      ...authFlags,
      '--email',
      'user@example.com',
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

  it('confirm blocks eligible users', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [sampleUser])

    nock(BASE)
      .patch('/api/v2/users/auth0%7C1', {blocked: true})
      .reply(200, {...sampleUser, blocked: true})

    const {stdout} = await runCommand([
      'auth0:users:block',
      ...authFlags,
      '--email',
      'user@example.com',
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {updated: string[]; errors: unknown[]}
    expect(result.updated).to.deep.equal(['auth0|1'])
    expect(result.errors).to.have.length(0)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('blocks users matched by query', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users')
      .query(true)
      .reply(200, {
        length: 1,
        limit: 100,
        start: 0,
        total: 1,
        users: [sampleUser],
      })

    nock(BASE)
      .patch('/api/v2/users/auth0%7C1', {blocked: true})
      .reply(200, {...sampleUser, blocked: true})

    const {stdout} = await runCommand([
      'auth0:users:block',
      ...authFlags,
      '--query',
      'email:user@example.com',
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {updated: string[]}
    expect(result.updated).to.deep.equal(['auth0|1'])
  })

  it('records patch errors without exiting zero when confirm fails', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [sampleUser])

    nock(BASE).patch('/api/v2/users/auth0%7C1', {blocked: true}).reply(500, 'fail')

    const {stdout, error} = await runCommand([
      'auth0:users:block',
      ...authFlags,
      '--email',
      'user@example.com',
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {errors: Array<{user_id: string}>}
    expect(result.errors).to.have.length(1)
    expect(result.errors[0].user_id).to.equal('auth0|1')
    expect(error).to.not.equal(undefined)
  })
})
