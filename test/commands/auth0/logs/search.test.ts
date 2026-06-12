import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

const authFlags = ['--domain', DOMAIN, '--client-id', 'cid', '--client-secret', 'secret']

describe('auth0 logs search', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('returns log entries in human output', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/logs')
      .query(true)
      .reply(200, [
        {
          date: '2026-06-01T00:00:00.000Z',
          description: 'Failed login',
          ip: '1.2.3.4',
          log_id: 'log1',
          type: 'f',
          user_name: 'user@example.com',
        },
      ])

    const {stdout} = await runCommand([
      'auth0:logs:search',
      ...authFlags,
      '--query',
      'type:f',
    ])

    expect(stdout).to.contain('Failed login')
    expect(stdout).to.contain('user@example.com')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('appends date range to query', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/logs')
      .query((query) => {
        return (
          query.q === '(type:f) AND date:[2026-06-01 TO 2026-06-12]' &&
          query.page === '0' &&
          query.sort === 'date:-1'
        )
      })
      .reply(200, [])

    const {stdout} = await runCommand([
      'auth0:logs:search',
      ...authFlags,
      '--query',
      'type:f',
      '--from',
      '2026-06-01',
      '--to',
      '2026-06-12',
      '--json',
    ])

    const result = JSON.parse(stdout) as {logs: unknown[]}
    expect(result.logs).to.have.length(0)
    expect(nock.pendingMocks()).to.have.length(0)
  })
})
