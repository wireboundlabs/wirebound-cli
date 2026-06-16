import {expect} from 'chai'
import nock from 'nock'

import {runBlockUnblockCommand} from '@/lib/auth0/block-unblock'
import {resolveAuth0Config} from '@/lib/config/auth0'

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

describe('runBlockUnblockCommand', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('renders human output when json is disabled', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [sampleUser])

    const logs: string[] = []
    await runBlockUnblockCommand(
      {
        exit: () => {},
        log: (message) => logs.push(message),
        logVerbose: () => {},
      },
      {
        action: 'block',
        blocked: true,
        flags: {
          confirm: false,
          domain: DOMAIN,
          email: 'user@example.com',
          json: false,
          'client-id': 'cid',
          'client-secret': 'secret',
        },
        resolveConfig: async (flags) =>
          resolveAuth0Config({
            clientId: flags['client-id'],
            clientSecret: flags['client-secret'],
            domain: flags.domain,
            profile: flags.profile,
            rps: flags.rps,
          }),
      },
    )

    expect(logs.join('\n')).to.contain('Would block')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('returns json output when requested', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [sampleUser])

    const logs: string[] = []
    await runBlockUnblockCommand(
      {
        exit: () => {},
        log: (message) => logs.push(message),
        logVerbose: () => {},
      },
      {
        action: 'block',
        blocked: true,
        flags: {
          confirm: false,
          domain: DOMAIN,
          email: 'user@example.com',
          json: true,
          'client-id': 'cid',
          'client-secret': 'secret',
        },
        resolveConfig: async (flags) =>
          resolveAuth0Config({
            clientId: flags['client-id'],
            clientSecret: flags['client-secret'],
            domain: flags.domain,
            profile: flags.profile,
            rps: flags.rps,
          }),
      },
    )

    expect(JSON.parse(logs[0]).dryRun).to.equal(true)
  })

  it('renders unblock human output when json is disabled', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'blocked@example.com'})
      .reply(200, [{blocked: true, email: 'blocked@example.com', user_id: 'auth0|1'}])

    const logs: string[] = []
    await runBlockUnblockCommand(
      {
        exit: () => {},
        log: (message) => logs.push(message),
        logVerbose: () => {},
      },
      {
        action: 'unblock',
        blocked: false,
        flags: {
          confirm: false,
          domain: DOMAIN,
          email: 'blocked@example.com',
          json: false,
          'client-id': 'cid',
          'client-secret': 'secret',
        },
        resolveConfig: async (flags) =>
          resolveAuth0Config({
            clientId: flags['client-id'],
            clientSecret: flags['client-secret'],
            domain: flags.domain,
            profile: flags.profile,
            rps: flags.rps,
          }),
      },
    )

    expect(logs.join('\n')).to.contain('Would unblock')
  })

  it('exits non-zero when confirm returns errors', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/users-by-email')
      .query({email: 'user@example.com'})
      .reply(200, [sampleUser])
    nock(BASE).patch('/api/v2/users/auth0%7C1', {blocked: true}).reply(500, 'fail')

    let exitCode: number | undefined
    const logs: string[] = []

    await runBlockUnblockCommand(
      {
        exit: (code) => {
          exitCode = code
        },
        log: (message) => logs.push(message),
        logVerbose: () => {},
      },
      {
        action: 'block',
        blocked: true,
        flags: {
          confirm: true,
          domain: DOMAIN,
          email: 'user@example.com',
          json: true,
          'client-id': 'cid',
          'client-secret': 'secret',
        },
        resolveConfig: async (flags) =>
          resolveAuth0Config({
            clientId: flags['client-id'],
            clientSecret: flags['client-secret'],
            domain: flags.domain,
            profile: flags.profile,
            rps: flags.rps,
          }),
      },
    )

    expect(exitCode).to.equal(1)
    expect(logs.join('\n')).to.contain('"errors"')
  })
})
