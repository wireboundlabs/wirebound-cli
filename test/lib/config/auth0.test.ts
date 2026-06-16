import {expect} from 'chai'
import {CLIError} from '@oclif/core/errors'

import {resolveAuth0Config} from '@/lib/config/auth0'

describe('resolveAuth0Config', () => {
  const originalEnv = {...process.env}

  afterEach(() => {
    process.env = {...originalEnv}
  })

  it('returns config from explicit input', () => {
    expect(
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        rps: 5,
      }),
    ).to.deep.equal({
      clientId: 'cid',
      clientSecret: 'secret',
      domain: 'tenant.example.com',
      rps: 5,
    })
  })

  it('defaults rps to 2', () => {
    expect(
      resolveAuth0Config({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      }).rps,
    ).to.equal(2)
  })

  it('reads values from profile vars and env', () => {
    process.env.AUTH0_DOMAIN = 'env.example.com'
    process.env.AUTH0_MGMT_CLIENT_ID = 'env-cid'
    process.env.AUTH0_MGMT_CLIENT_SECRET = 'env-secret'

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
      rps: 2,
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
      rps: 2,
    })
  })

  it('prefers explicit input over profile vars and env', () => {
    process.env.AUTH0_MGMT_CLIENT_ID = 'env-cid'

    expect(
      resolveAuth0Config({
        clientId: 'explicit-cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        profileVars: {
          AUTH0_MGMT_CLIENT_ID: 'profile-cid',
        },
      }).clientId,
    ).to.equal('explicit-cid')
  })
})
