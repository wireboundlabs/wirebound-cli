import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {expect} from 'chai'
import {CLIError} from '@oclif/core/errors'
import nock from 'nock'

import {repoProfilePath, writeRepoProfile} from '@/lib/config/profile'
import {
  confirmOverwriteIfNeeded,
  logNextSteps,
  resolveSetDefault,
  verifySetupCredentials,
  type RunSetupOptions,
} from '@/lib/setup/run-setup'

describe('runSetup steps', () => {
  let tempRoot: string

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'wirebound-setup-steps-'))
  })

  afterEach(() => {
    rmSync(tempRoot, {force: true, recursive: true})
    nock.cleanAll()
  })

  function baseOptions(overrides: Partial<RunSetupOptions> = {}): RunSetupOptions {
    return {
      check: false,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      },
      force: false,
      log: () => {},
      profileName: 'dev',
      targetDir: tempRoot,
      ...overrides,
    }
  }

  describe('confirmOverwriteIfNeeded', () => {
    it('allows setup when profile file does not exist', async () => {
      const configPath = repoProfilePath(tempRoot, 'dev')
      expect(await confirmOverwriteIfNeeded(baseOptions(), configPath)).to.equal(true)
    })

    it('allows setup when force is enabled', async () => {
      writeRepoProfile(tempRoot, 'dev', {
        AUTH0_DOMAIN: 'old.example.com',
        AUTH0_MGMT_CLIENT_ID: 'old',
        AUTH0_MGMT_CLIENT_SECRET: 'old',
      })

      expect(
        await confirmOverwriteIfNeeded(
          baseOptions({force: true}),
          repoProfilePath(tempRoot, 'dev'),
        ),
      ).to.equal(true)
    })

    it('throws when profile exists and no confirm handler is provided', async () => {
      writeRepoProfile(tempRoot, 'dev', {
        AUTH0_DOMAIN: 'old.example.com',
        AUTH0_MGMT_CLIENT_ID: 'old',
        AUTH0_MGMT_CLIENT_SECRET: 'old',
      })

      try {
        await confirmOverwriteIfNeeded(baseOptions(), repoProfilePath(tempRoot, 'dev'))
        expect.fail('Expected confirmOverwriteIfNeeded to throw')
      } catch (error) {
        expect(error).to.be.instanceOf(CLIError)
        expect(String(error)).to.contain('already exists')
      }
    })

    it('delegates to confirmOverwrite when profile exists', async () => {
      writeRepoProfile(tempRoot, 'dev', {
        AUTH0_DOMAIN: 'old.example.com',
        AUTH0_MGMT_CLIENT_ID: 'old',
        AUTH0_MGMT_CLIENT_SECRET: 'old',
      })

      const configPath = repoProfilePath(tempRoot, 'dev')
      let seenPath: string | undefined

      expect(
        await confirmOverwriteIfNeeded(
          baseOptions({
            confirmOverwrite: async (path) => {
              seenPath = path
              return true
            },
          }),
          configPath,
        ),
      ).to.equal(true)
      expect(seenPath).to.equal(configPath)
    })
  })

  describe('resolveSetDefault', () => {
    it('returns explicit setDefault when provided', async () => {
      expect(await resolveSetDefault(baseOptions({setDefault: true}), tempRoot)).to.equal(true)
      expect(await resolveSetDefault(baseOptions({setDefault: false}), tempRoot)).to.equal(false)
    })

    it('returns false when no confirm handler exists', async () => {
      expect(await resolveSetDefault(baseOptions(), tempRoot)).to.equal(false)
    })

    it('delegates to confirmSetDefault when provided', async () => {
      let seenProfile: string | undefined
      let seenDir: string | undefined

      expect(
        await resolveSetDefault(
          baseOptions({
            confirmSetDefault: async (profileName, targetDir) => {
              seenProfile = profileName
              seenDir = targetDir
              return true
            },
          }),
          tempRoot,
        ),
      ).to.equal(true)
      expect(seenProfile).to.equal('dev')
      expect(seenDir).to.equal(tempRoot)
    })

    it('returns false when confirmSetDefault declines', async () => {
      expect(
        await resolveSetDefault(
          baseOptions({
            confirmSetDefault: async () => false,
          }),
          tempRoot,
        ),
      ).to.equal(false)
    })
  })

  describe('verifySetupCredentials', () => {
    it('succeeds when Auth0 returns a token', async () => {
      nock('https://tenant.example.com')
        .post('/oauth/token')
        .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})

      await verifySetupCredentials({
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      })

      expect(nock.pendingMocks()).to.have.length(0)
    })

    it('wraps Auth0 failures in CLIError', async () => {
      nock('https://tenant.example.com').post('/oauth/token').reply(401, 'invalid_client')

      try {
        await verifySetupCredentials({
          clientId: 'bad',
          clientSecret: 'bad',
          domain: 'tenant.example.com',
        })
        expect.fail('Expected verifySetupCredentials to throw')
      } catch (error) {
        expect(error).to.be.instanceOf(CLIError)
        expect(String(error)).to.contain('Credential check failed')
      }
    })

    it('stringifies non-Error failures', async () => {
      nock('https://tenant.example.com').post('/oauth/token').replyWithError('network down')

      try {
        await verifySetupCredentials({
          clientId: 'cid',
          clientSecret: 'secret',
          domain: 'tenant.example.com',
        })
        expect.fail('Expected verifySetupCredentials to throw')
      } catch (error) {
        expect(error).to.be.instanceOf(CLIError)
        expect(String(error)).to.contain('Credential check failed')
      }
    })
  })

  describe('logNextSteps', () => {
    it('logs export hint when default profile is not set', () => {
      const logs: string[] = []
      logNextSteps((message) => logs.push(message), 'staging', false)

      expect(logs.some((line) => line.includes('export WIREBOUND_PROFILE=staging'))).to.equal(
        true,
      )
      expect(logs.some((line) => line.includes('docs/vendors/auth0.md'))).to.equal(true)
      expect(logs.some((line) => line.includes('AUTH0_PLAN'))).to.equal(true)
    })

    it('logs default-profile hint when default is set', () => {
      const logs: string[] = []
      logNextSteps((message) => logs.push(message), 'production', true)

      expect(logs.some((line) => line.includes('uses default profile'))).to.equal(true)
    })
  })
})
