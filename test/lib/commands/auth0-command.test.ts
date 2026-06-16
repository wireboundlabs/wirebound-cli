import {expect} from 'chai'
import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {Auth0Command} from '@/lib/commands/auth0-command'
import {writeRepoProfile} from '@/lib/config/profile'
import {type Auth0Config} from '@/lib/config/auth0'

class TestAuth0Command extends Auth0Command {
  async resolveForProfile(
    profile: string,
    flags: {
      'auth0-plan'?: string
      'auth0-tenant-env'?: string
      domain?: string
      'client-id'?: string
      'client-secret'?: string
      rps?: number
    } = {},
  ) {
    await this.loadConfigVars(profile)
    return this.resolveConfig({profile, ...flags})
  }

  logResolvedConfigForTest(config: Auth0Config, verbose: boolean) {
    this.logResolvedConfig(config, verbose)
  }
}

describe('Auth0Command', () => {
  let tempRoot: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempRoot = mkdtempSync(join(tmpdir(), 'wirebound-auth0-command-'))
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'profile.example.com',
      AUTH0_MGMT_CLIENT_ID: 'profile-cid',
      AUTH0_MGMT_CLIENT_SECRET: 'profile-secret',
    })
    process.chdir(tempRoot)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tempRoot, {force: true, recursive: true})
  })

  it('resolveConfig merges CLI flags with repo profile vars', async () => {
    const command = new TestAuth0Command([], {} as ConstructorParameters<typeof Auth0Command>[1])

    const config = await command.resolveForProfile('dev', {
      'auth0-plan': 'enterprise',
      'auth0-tenant-env': 'non-production',
      domain: 'cli.example.com',
      rps: 4,
    })

    expect(config).to.deep.equal({
      clientId: 'profile-cid',
      clientSecret: 'profile-secret',
      domain: 'cli.example.com',
      plan: 'enterprise',
      rps: 4,
      tenantEnvironment: 'non-production',
    })
  })

  it('logResolvedConfig logs tenant and rate limits when verbose', () => {
    const command = new TestAuth0Command([], {} as ConstructorParameters<typeof Auth0Command>[1])
    const logs: string[] = []
    command.log = (message: string) => logs.push(message)

    command.logResolvedConfigForTest(
      {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        plan: 'enterprise',
        rps: 2,
        tenantEnvironment: 'non-production',
      },
      true,
    )

    expect(logs).to.deep.equal([
      'Auth0 tenant: tenant.example.com',
      'Rate limits: plan=enterprise, tenant=non-production, 2 req/s global',
    ])
  })

  it('logResolvedConfig stays quiet when verbose is false', () => {
    const command = new TestAuth0Command([], {} as ConstructorParameters<typeof Auth0Command>[1])
    const logs: string[] = []
    command.log = (message: string) => logs.push(message)

    command.logResolvedConfigForTest(
      {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
        plan: 'free',
        rps: 2,
        tenantEnvironment: 'production',
      },
      false,
    )

    expect(logs).to.deep.equal([])
  })
})
