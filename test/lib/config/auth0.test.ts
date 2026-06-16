import {expect} from 'chai'
import {CLIError} from '@oclif/core/errors'

import {formatRateLimitSummary, resolveAuth0Config} from '@/lib/config/auth0'

describe('resolveAuth0Config', () => {
  const originalEnv = {...process.env}

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key]
      }
    }

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('returns config from explicit input', () => {
    expect(
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        plan: 'enterprise',
        rps: 5,
        tenantEnvironment: 'non-production',
      }),
    ).to.deep.equal({
      clientId: 'cid',
      clientSecret: 'secret',
      domain: 'tenant.example.com',
      plan: 'enterprise',
      rps: 5,
      tenantEnvironment: 'non-production',
    })
  })

  it('defaults plan, tenant environment, and rps for free tenants', () => {
    expect(
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      }),
    ).to.deep.equal({
      clientId: 'cid',
      clientSecret: 'secret',
      domain: 'tenant.example.com',
      plan: 'free',
      rps: 2,
      tenantEnvironment: 'production',
    })
  })

  it('derives enterprise production rps from plan', () => {
    expect(
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        plan: 'enterprise',
      }).rps,
    ).to.equal(16)
  })

  it('reads plan, tenant env, and rps from profile vars and env', () => {
    process.env.AUTH0_DOMAIN = 'env.example.com'
    process.env.AUTH0_MGMT_CLIENT_ID = 'env-cid'
    process.env.AUTH0_MGMT_CLIENT_SECRET = 'env-secret'
    process.env.AUTH0_PLAN = 'essentials-professional'
    process.env.AUTH0_TENANT_ENV = 'non-production'
    process.env.AUTH0_RPS = '4'

    expect(
      resolveAuth0Config({
        profileVars: {
          AUTH0_DOMAIN: 'profile.example.com',
          AUTH0_MGMT_CLIENT_ID: 'profile-cid',
        },
      }),
    ).to.deep.equal({
      clientId: 'profile-cid',
      clientSecret: 'env-secret',
      domain: 'profile.example.com',
      plan: 'essentials-professional',
      rps: 4,
      tenantEnvironment: 'non-production',
    })
  })

  it('ignores empty profile and env values', () => {
    process.env.AUTH0_DOMAIN = ''
    process.env.AUTH0_MGMT_CLIENT_ID = ''
    process.env.AUTH0_MGMT_CLIENT_SECRET = ''

    expect(() =>
      resolveAuth0Config({
        profileVars: {
          AUTH0_DOMAIN: '',
          AUTH0_MGMT_CLIENT_ID: '',
          AUTH0_MGMT_CLIENT_SECRET: '',
        },
      }),
    ).to.throw(CLIError, /Missing required Auth0 configuration/)
  })

  it('reports each missing credential field', () => {
    expect(() => resolveAuth0Config({})).to.throw(CLIError, /domain/)
    expect(() =>
      resolveAuth0Config({
        domain: 'tenant.example.com',
        clientId: 'cid',
      }),
    ).to.throw(CLIError, /client secret/)
    expect(() =>
      resolveAuth0Config({
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      }),
    ).to.throw(CLIError, /client ID/)
    expect(() =>
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
      }),
    ).to.throw(CLIError, /domain/)
  })

  it('throws when required fields are missing', () => {
    try {
      resolveAuth0Config({domain: 'tenant.example.com'})
      expect.fail('Expected resolveAuth0Config to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(CLIError)
      expect(String(error)).to.contain('client ID')
      expect(String(error)).to.contain('client secret')
    }
  })

  it('reads credentials from environment variables', () => {
    process.env.AUTH0_DOMAIN = 'env.example.com'
    process.env.AUTH0_MGMT_CLIENT_ID = 'env-cid'
    process.env.AUTH0_MGMT_CLIENT_SECRET = 'env-secret'

    expect(resolveAuth0Config({})).to.deep.equal({
      clientId: 'env-cid',
      clientSecret: 'env-secret',
      domain: 'env.example.com',
      plan: 'free',
      rps: 2,
      tenantEnvironment: 'production',
    })
  })

  it('prefers explicit input over profile vars and env', () => {
    process.env.AUTH0_MGMT_CLIENT_ID = 'env-cid'
    process.env.AUTH0_PLAN = 'free'

    expect(
      resolveAuth0Config({
        clientId: 'explicit-cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        plan: 'enterprise',
        profileVars: {
          AUTH0_MGMT_CLIENT_ID: 'profile-cid',
          AUTH0_PLAN: 'free',
        },
      }).clientId,
    ).to.equal('explicit-cid')
  })

  it('reads explicit rps without env or profile vars', () => {
    expect(
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        plan: 'essentials-professional',
        rps: 1,
      }).rps,
    ).to.equal(1)
  })

  it('reads plan from profile vars', () => {
    expect(
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        profileVars: {AUTH0_PLAN: 'enterprise', AUTH0_TENANT_ENV: 'non-production'},
      }),
    ).to.deep.include({
      plan: 'enterprise',
      rps: 2,
      tenantEnvironment: 'non-production',
    })
  })

  it('prefers explicit rps over profile and env values', () => {
    process.env.AUTH0_RPS = '4'

    expect(
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        profileVars: {AUTH0_RPS: '6'},
        rps: 8,
      }).rps,
    ).to.equal(8)
  })

  it('reads tenant environment from explicit input', () => {
    expect(
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        tenantEnvironment: 'non-production',
      }).tenantEnvironment,
    ).to.equal('non-production')
  })

  it('reads plan from environment when profile omits it', () => {
    process.env.AUTH0_PLAN = 'enterprise'
    process.env.AUTH0_DOMAIN = 'env.example.com'
    process.env.AUTH0_MGMT_CLIENT_ID = 'env-cid'
    process.env.AUTH0_MGMT_CLIENT_SECRET = 'env-secret'

    expect(resolveAuth0Config({}).plan).to.equal('enterprise')
  })

  it('throws for invalid rps values from flags or profile', () => {
    expect(() =>
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        rps: 0,
      }),
    ).to.throw(CLIError, /Invalid AUTH0_RPS/)

    expect(() =>
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        profileVars: {AUTH0_RPS: '0'},
      }),
    ).to.throw(CLIError, /Invalid AUTH0_RPS/)
  })

  it('formatRateLimitSummary describes plan and global rate', () => {
    expect(
      formatRateLimitSummary({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        plan: 'free',
        rps: 2,
        tenantEnvironment: 'production',
      }),
    ).to.equal('plan=free, 2 req/s global')

    expect(
      formatRateLimitSummary({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        plan: 'enterprise',
        rps: 2,
        tenantEnvironment: 'non-production',
      }),
    ).to.equal('plan=enterprise, tenant=non-production, 2 req/s global')
  })

  it('throws for invalid plan and rps values', () => {
    expect(() =>
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        plan: 'invalid',
      }),
    ).to.throw(CLIError, /Invalid AUTH0_PLAN/)

    expect(() =>
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        tenantEnvironment: 'qa',
      }),
    ).to.throw(CLIError, /Invalid AUTH0_TENANT_ENV/)

    expect(() =>
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        profileVars: {AUTH0_RPS: 'fast'},
      }),
    ).to.throw(CLIError, /Invalid AUTH0_RPS/)
  })
})
