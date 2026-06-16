import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const authFlags = ['--domain', DOMAIN, '--client-id', 'cid', '--client-secret', 'secret']

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

describe('auth0 orgs list', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('lists organizations', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations')
      .query(true)
      .reply(200, {
        length: 1,
        limit: 100,
        organizations: [{display_name: 'Acme Corp', id: 'org_1', name: 'acme-corp'}],
        start: 0,
        total: 1,
      })

    const {stdout} = await runCommand(['auth0:orgs:list', ...authFlags, '--json'])

    const result = JSON.parse(stdout) as {
      organizations: Array<{id: string; name: string}>
    }

    expect(result.organizations).to.have.length(1)
    expect(result.organizations[0].name).to.equal('acme-corp')
    expect(nock.pendingMocks()).to.have.length(0)
  })
})
