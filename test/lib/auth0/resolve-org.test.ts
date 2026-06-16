import {expect} from 'chai'
import nock from 'nock'

import {Auth0Client} from '@/lib/auth0/client'
import {resolveOrganization, validateOrgFlags} from '@/lib/auth0/resolve-org'
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

describe('resolveOrganization', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('validateOrgFlags requires exactly one org target', () => {
    expect(() => validateOrgFlags({})).to.throw('One of --org-id or --org-name is required')
    expect(() => validateOrgFlags({orgId: 'org_1', orgName: 'acme'})).to.throw(
      'Only one of --org-id or --org-name may be specified',
    )
  })

  it('resolveOrganization fetches by org id', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations/org_1')
      .reply(200, {id: 'org_1', name: 'acme-corp'})

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const org = await resolveOrganization(client, {orgId: 'org_1'})

    expect(org.name).to.equal('acme-corp')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('resolveOrganization fetches by org name', async () => {
    mockToken()
    nock(BASE)
      .get('/api/v2/organizations/name/acme-corp')
      .reply(200, {id: 'org_1', name: 'acme-corp'})

    const client = new Auth0Client(config, new RateLimiter({rps: 10}))
    const org = await resolveOrganization(client, {orgName: 'acme-corp'})

    expect(org.name).to.equal('acme-corp')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('resolveOrganization throws when no target is provided', async () => {
    const client = new Auth0Client(config, new RateLimiter({rps: 10}))

    try {
      await resolveOrganization(client, {})
      expect.fail('expected resolveOrganization to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(Error)
      expect((error as Error).message).to.equal('One of --org-id or --org-name is required')
    }
  })
})
