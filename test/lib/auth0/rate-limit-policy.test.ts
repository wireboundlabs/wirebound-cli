import {expect} from 'chai'

import {
  parseAuth0Plan,
  parseAuth0TenantEnvironment,
  resolveDefaultGlobalRps,
  resolveEffectiveMinTimeMs,
  resolveEndpointMinTimeMs,
  resolveGlobalRps,
} from '@/lib/auth0/rate-limit-policy'

describe('rate-limit-policy', () => {
  it('parseAuth0Plan accepts documented values and aliases', () => {
    expect(parseAuth0Plan(undefined)).to.equal('free')
    expect(parseAuth0Plan('  free  ')).to.equal('free')
    expect(parseAuth0Plan('essentials')).to.equal('essentials-professional')
    expect(parseAuth0Plan('professional')).to.equal('essentials-professional')
    expect(parseAuth0Plan('enterprise')).to.equal('enterprise')
  })

  it('parseAuth0Plan rejects unknown values', () => {
    expect(() => parseAuth0Plan('startup')).to.throw(/Invalid AUTH0_PLAN/)
  })

  it('parseAuth0TenantEnvironment accepts documented values and aliases', () => {
    expect(parseAuth0TenantEnvironment(undefined)).to.equal('production')
    expect(parseAuth0TenantEnvironment('prod')).to.equal('production')
    expect(parseAuth0TenantEnvironment('non-prod')).to.equal('non-production')
    expect(parseAuth0TenantEnvironment('staging')).to.equal('non-production')
  })

  it('parseAuth0TenantEnvironment rejects unknown values', () => {
    expect(() => parseAuth0TenantEnvironment('qa')).to.throw(/Invalid AUTH0_TENANT_ENV/)
  })

  it('resolveEndpointMinTimeMs uses enterprise endpoint tables', () => {
    expect(
      resolveEndpointMinTimeMs('enterprise', 'production', 'read-organization-members'),
    ).to.equal(120)
    expect(
      resolveEndpointMinTimeMs('enterprise', 'production', 'read-users-by-email'),
    ).to.equal(400)
    expect(
      resolveEndpointMinTimeMs('essentials-professional', 'production', 'read-organizations'),
    ).to.equal(1200)
  })

  it('resolveEndpointMinTimeMs configures oauth-token spacing', () => {
    expect(resolveEndpointMinTimeMs('free', 'production', 'oauth-token')).to.equal(34)
  })

  it('resolveEndpointMinTimeMs uses the essentials fallback for unlisted endpoints', () => {
    expect(
      resolveEndpointMinTimeMs(
        'essentials-professional',
        'production',
        'missing-endpoint' as never,
      ),
    ).to.equal(400)
  })

  it('resolveDefaultGlobalRps follows Auth0 plan tables', () => {
    expect(resolveDefaultGlobalRps('free', 'production')).to.equal(2)
    expect(resolveDefaultGlobalRps('essentials-professional', 'production')).to.equal(3)
    expect(resolveDefaultGlobalRps('enterprise', 'production')).to.equal(16)
    expect(resolveDefaultGlobalRps('enterprise', 'non-production')).to.equal(2)
  })

  it('resolveGlobalRps uses explicit override when provided', () => {
    expect(resolveGlobalRps('free', 'production', 5)).to.equal(5)
    expect(resolveGlobalRps('enterprise', 'production')).to.equal(16)
  })

  it('resolveEndpointMinTimeMs applies paid-tier endpoint limits', () => {
    expect(resolveEndpointMinTimeMs('free', 'production', 'read-logs')).to.equal(undefined)
    expect(resolveEndpointMinTimeMs('essentials-professional', 'production', 'read-logs')).to.equal(
      600,
    )
    expect(resolveEndpointMinTimeMs('essentials-professional', 'production', 'read-users')).to.equal(
      120,
    )
    expect(
      resolveEndpointMinTimeMs('essentials-professional', 'production', 'oauth-token'),
    ).to.equal(34)
    expect(resolveEndpointMinTimeMs('enterprise', 'production', 'read-users')).to.equal(undefined)
  })

  it('resolveEffectiveMinTimeMs falls back to global when endpoint limit is absent', () => {
    expect(
      resolveEffectiveMinTimeMs('enterprise', 'production', 16, 'read-users'),
    ).to.equal(63)
    expect(
      resolveEffectiveMinTimeMs('free', 'production', 2, 'oauth-token'),
    ).to.equal(500)
  })

  it('resolveEffectiveMinTimeMs uses the stricter of global and endpoint limits', () => {
    expect(
      resolveEffectiveMinTimeMs('essentials-professional', 'production', 3, 'read-logs'),
    ).to.equal(600)
    expect(
      resolveEffectiveMinTimeMs('essentials-professional', 'production', 3, 'read-users'),
    ).to.equal(334)
    expect(resolveEffectiveMinTimeMs('free', 'production', 2, 'read-users')).to.equal(500)
  })
})
