import {expect} from 'chai'

import {Auth0Client} from '@/lib/auth0/client'
import {resolveUsers, validateTargetFlags} from '@/lib/auth0/resolve-users'
import {RateLimiter} from '@/lib/rate-limiter'

const config = {
  clientId: 'cid',
  clientSecret: 'secret',
  domain: 'tenant.example.com',
  rps: 10,
}

describe('resolveUsers', () => {
  it('validateTargetFlags requires exactly one target', () => {
    expect(() => validateTargetFlags({})).to.throw(
      'One of --email, --id, or --query is required',
    )
    expect(() => validateTargetFlags({email: 'a@b.com', id: 'auth0|1'})).to.throw(
      'Only one of --email, --id, or --query may be specified',
    )
    expect(() => validateTargetFlags({query: 'email:a@b.com'})).to.not.throw()
  })

  it('resolveUsers throws when no target is provided', async () => {
    const client = new Auth0Client(config, new RateLimiter({rps: 10}))

    try {
      await resolveUsers(client, {})
      expect.fail('expected resolveUsers to throw')
    } catch (error) {
      expect((error as Error).message).to.contain('One of --email, --id, or --query is required')
    }
  })
})
