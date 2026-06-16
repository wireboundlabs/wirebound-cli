import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {expect} from 'chai'
import nock from 'nock'

import {
  ensureGitignore,
  findRepoConfig,
  findRepoProfilePath,
  formatConfigFile,
  formatProfileList,
  GITIGNORE_ENTRY,
  listRepoProfiles,
  loadConfigFile,
  normalizeAuth0Domain,
  normalizeProfileName,
  readRepoDefaultProfile,
  repoProfilePath,
  resolveProfileVars,
  validateProfileName,
  writeRepoDefaultProfile,
  writeRepoProfile,
} from '@/lib/config/profile'
import {listSetupProfiles, runSetup} from '@/lib/setup/run-setup'

describe('config profile', () => {
  let tempRoot: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempRoot = mkdtempSync(join(tmpdir(), 'wirebound-profile-'))
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tempRoot, {force: true, recursive: true})
  })

  it('findRepoProfilePath walks up parent directories', () => {
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'tenant.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })

    const nestedDir = join(tempRoot, 'apps', 'api')
    mkdirSync(nestedDir, {recursive: true})

    expect(findRepoProfilePath('dev', nestedDir)).to.equal(
      repoProfilePath(tempRoot, 'dev'),
    )
  })

  it('findRepoProfilePath returns undefined when profile does not exist', () => {
    expect(findRepoProfilePath('dev', tempRoot)).to.equal(undefined)
  })

  it('loadConfigFile parses dotenv values', () => {
    const path = join(tempRoot, 'sample.env')
    writeFileSync(
      path,
      'AUTH0_DOMAIN=tenant.example.com\nAUTH0_MGMT_CLIENT_ID=cid\n',
      'utf8',
    )

    expect(loadConfigFile(path)).to.deep.equal({
      AUTH0_DOMAIN: 'tenant.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
    })
  })

  it('loadConfigFile skips undefined parsed values', () => {
    const path = join(tempRoot, 'empty-value.env')
    writeFileSync(path, 'EMPTY=\nPRESENT=ok\n', 'utf8')

    expect(loadConfigFile(path)).to.deep.equal({EMPTY: '', PRESENT: 'ok'})
  })

  it('resolveProfileVars loads named repo profile', () => {
    writeRepoProfile(tempRoot, 'test', {
      AUTH0_DOMAIN: 'test.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })

    const nestedDir = join(tempRoot, 'nested')
    mkdirSync(nestedDir, {recursive: true})
    process.chdir(nestedDir)

    expect(resolveProfileVars('test')).to.deep.equal({
      AUTH0_DOMAIN: 'test.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
  })

  it('resolveProfileVars uses default profile when no name is given', () => {
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'dev.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
    writeRepoProfile(tempRoot, 'production', {
      AUTH0_DOMAIN: 'prod.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid2',
      AUTH0_MGMT_CLIENT_SECRET: 'secret2',
    })
    writeRepoDefaultProfile(tempRoot, 'dev')

    process.chdir(tempRoot)

    expect(resolveProfileVars()).to.deep.equal({
      AUTH0_DOMAIN: 'dev.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
  })

  it('resolveProfileVars falls back to legacy config.env', () => {
    const legacyDir = join(tempRoot, '.wirebound')
    mkdirSync(legacyDir, {recursive: true})
    writeFileSync(
      join(legacyDir, 'config.env'),
      'AUTH0_DOMAIN=legacy.example.com\nAUTH0_MGMT_CLIENT_ID=cid\nAUTH0_MGMT_CLIENT_SECRET=secret\n',
      'utf8',
    )

    process.chdir(tempRoot)

    expect(resolveProfileVars()).to.deep.equal({
      AUTH0_DOMAIN: 'legacy.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
  })

  it('listRepoProfiles returns sorted profile names', () => {
    writeRepoProfile(tempRoot, 'production', {
      AUTH0_DOMAIN: 'prod.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'dev.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })

    expect(listRepoProfiles(tempRoot)).to.deep.equal(['dev', 'production'])
  })

  it('writeRepoProfile creates mode-600 profile file', () => {
    const path = writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'tenant.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })

    expect(existsSync(path)).to.equal(true)
    expect(readFileSync(path, 'utf8')).to.equal(
      formatConfigFile(
        {
          AUTH0_DOMAIN: 'tenant.example.com',
          AUTH0_MGMT_CLIENT_ID: 'cid',
          AUTH0_MGMT_CLIENT_SECRET: 'secret',
        },
        'dev',
      ),
    )

    const mode = process.platform === 'win32' ? 0o666 : 0o600
    chmodSync(path, mode)
  })

  it('ensureGitignore appends .wirebound/ when missing', () => {
    const gitignorePath = join(tempRoot, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules\n', 'utf8')

    expect(ensureGitignore(tempRoot)).to.equal(true)
    expect(readFileSync(gitignorePath, 'utf8')).to.contain(GITIGNORE_ENTRY)
  })

  it('formatProfileList marks the default profile', () => {
    expect(formatProfileList(['dev', 'production'], 'dev')).to.equal(
      '  dev (default)\n  production',
    )
  })

  it('readRepoDefaultProfile reads .wirebound/default', () => {
    writeRepoDefaultProfile(tempRoot, 'test')
    expect(readRepoDefaultProfile(tempRoot)).to.equal('test')
  })

  it('findRepoConfig still resolves legacy config.env', () => {
    const legacyDir = join(tempRoot, '.wirebound')
    mkdirSync(legacyDir, {recursive: true})
    const legacyPath = join(legacyDir, 'config.env')
    writeFileSync(legacyPath, 'AUTH0_DOMAIN=legacy.example.com\n', 'utf8')

    expect(findRepoConfig(tempRoot)).to.equal(legacyPath)
  })

  it('validateProfileName rejects empty and invalid names', () => {
    expect(validateProfileName('')).to.equal('Profile name is required')
    expect(validateProfileName('  ')).to.equal('Profile name is required')
    expect(validateProfileName('../bad')).to.contain('letters, numbers')
    expect(validateProfileName('dev')).to.equal(true)
  })

  it('normalizeProfileName trims whitespace', () => {
    expect(normalizeProfileName('  dev  ')).to.equal('dev')
  })

  it('normalizeAuth0Domain strips protocol and trailing slash', () => {
    expect(normalizeAuth0Domain(' https://tenant.example.com/ ')).to.equal('tenant.example.com')
  })

  it('formatProfileList handles empty profile lists', () => {
    expect(formatProfileList([])).to.contain('No repo profiles found')
  })

  it('listRepoProfiles returns empty when repo root is missing', () => {
    expect(listRepoProfiles(join(tempRoot, 'missing'))).to.deep.equal([])
  })

  it('readRepoDefaultProfile ignores blank default file', () => {
    const defaultDir = join(tempRoot, '.wirebound')
    mkdirSync(defaultDir, {recursive: true})
    writeFileSync(join(defaultDir, 'default'), '   \n', 'utf8')

    expect(readRepoDefaultProfile(tempRoot)).to.equal(undefined)
  })

  it('resolveProfileVars throws when named profile is missing', () => {
    process.chdir(tempRoot)

    try {
      resolveProfileVars('missing')
      expect.fail('Expected resolveProfileVars to throw')
    } catch (error) {
      expect(String(error)).to.contain('Profile not found: missing')
      expect(String(error)).to.contain('wirebound setup --profile missing')
    }
  })

  it('resolveProfileVars skips missing default profile files', () => {
    writeRepoDefaultProfile(tempRoot, 'missing')
    process.chdir(tempRoot)

    expect(resolveProfileVars()).to.equal(undefined)
  })

  it('formatConfigFile renders legacy header without profile name', () => {
    expect(formatConfigFile({AUTH0_DOMAIN: 'tenant.example.com'})).to.contain(
      'repo-local config (do not commit)',
    )
    expect(
      formatConfigFile(
        {
          AUTH0_DOMAIN: 'tenant.example.com',
          AUTH0_MGMT_CLIENT_ID: 'cid',
          AUTH0_MGMT_CLIENT_SECRET: 'secret',
        },
        'dev',
      ),
    ).to.contain('# Profile: dev')
    expect(
      formatConfigFile(
        {
          AUTH0_DOMAIN: 'tenant.example.com',
          AUTH0_MGMT_CLIENT_ID: 'cid',
          AUTH0_MGMT_CLIENT_SECRET: 'secret',
        },
        'dev',
      ),
    ).to.contain('AUTH0_PLAN=free')
  })

  it('ensureGitignore returns false when gitignore is missing', () => {
    expect(ensureGitignore(tempRoot)).to.equal(false)
  })

  it('ensureGitignore returns false when entry already exists', () => {
    const gitignorePath = join(tempRoot, '.gitignore')
    writeFileSync(gitignorePath, '.wirebound\n', 'utf8')

    expect(ensureGitignore(tempRoot)).to.equal(false)
    writeFileSync(gitignorePath, '.wirebound/**\n', 'utf8')
    expect(ensureGitignore(tempRoot)).to.equal(false)
    writeFileSync(gitignorePath, '.wirebound/*\n', 'utf8')
    expect(ensureGitignore(tempRoot)).to.equal(false)
  })

  it('ensureGitignore appends entry without trailing newline in gitignore', () => {
    const gitignorePath = join(tempRoot, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules', 'utf8')

    expect(ensureGitignore(tempRoot)).to.equal(true)
    expect(readFileSync(gitignorePath, 'utf8')).to.contain(`${GITIGNORE_ENTRY}\n`)
  })

  it('resolveProfileVars lists available repo profiles in not-found errors', () => {
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'dev.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
    process.chdir(tempRoot)

    try {
      resolveProfileVars('missing')
      expect.fail('Expected resolveProfileVars to throw')
    } catch (error) {
      expect(String(error)).to.contain('Available repo profiles: dev')
    }
  })
})

describe('runSetup', () => {
  let tempRoot: string
  const logs: string[] = []

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'wirebound-setup-'))
    logs.length = 0
  })

  afterEach(() => {
    rmSync(tempRoot, {force: true, recursive: true})
    nock.cleanAll()
  })

  it('writes named repo profile and updates gitignore', async () => {
    writeFileSync(join(tempRoot, '.gitignore'), 'node_modules\n', 'utf8')

    await runSetup({
      check: false,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      },
      force: false,
      log: (message) => logs.push(message),
      profileName: 'dev',
      targetDir: tempRoot,
    })

    const configPath = repoProfilePath(tempRoot, 'dev')
    expect(existsSync(configPath)).to.equal(true)
    expect(loadConfigFile(configPath)).to.deep.equal({
      AUTH0_DOMAIN: 'tenant.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
    expect(readFileSync(join(tempRoot, '.gitignore'), 'utf8')).to.contain(GITIGNORE_ENTRY)
    expect(logs.some((line) => line.includes('Wrote'))).to.equal(true)
  })

  it('sets default profile when requested', async () => {
    await runSetup({
      check: false,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      },
      force: false,
      log: (message) => logs.push(message),
      profileName: 'production',
      setDefault: true,
      targetDir: tempRoot,
    })

    expect(readRepoDefaultProfile(tempRoot)).to.equal('production')
    expect(logs.some((line) => line.includes('Set default profile'))).to.equal(true)
  })

  it('refuses overwrite without force or confirm handler', async () => {
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'old.example.com',
      AUTH0_MGMT_CLIENT_ID: 'old',
      AUTH0_MGMT_CLIENT_SECRET: 'old',
    })

    try {
      await runSetup({
        check: false,
        credentials: {
          clientId: 'cid',
          clientSecret: 'secret',
          domain: 'tenant.example.com',
        },
        force: false,
        log: (message) => logs.push(message),
        profileName: 'dev',
        targetDir: tempRoot,
      })
      expect.fail('Expected runSetup to throw')
    } catch (error) {
      expect(String(error)).to.contain('Profile "dev" already exists')
    }
  })

  it('verifies credentials when --check is enabled', async () => {
    const domain = 'tenant.example.com'
    nock(`https://${domain}`)
      .post('/oauth/token')
      .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})

    await runSetup({
      check: true,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain,
      },
      force: true,
      log: (message) => logs.push(message),
      profileName: 'test',
      targetDir: tempRoot,
    })

    expect(logs).to.contain('Auth0 credentials verified.')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('verifies credentials through progress spinner when provided', async () => {
    const domain = 'tenant.example.com'
    const spinnerMessages: string[] = []

    nock(`https://${domain}`)
      .post('/oauth/token')
      .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})

    await runSetup({
      check: true,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain,
      },
      force: true,
      log: (message) => logs.push(message),
      profileName: 'test',
      progress: {
        fetchPage() {},
        fetchStart() {},
        fetchStop() {},
        taskAdvance() {},
        taskStart() {},
        taskStop() {},
        async spinAsync(message, fn, doneMessage) {
          spinnerMessages.push(message)
          const result = await fn()
          if (doneMessage) {
            spinnerMessages.push(doneMessage)
          }
          return result
        },
      },
      targetDir: tempRoot,
    })

    expect(spinnerMessages).to.deep.equal([
      'Verifying Auth0 credentials',
      'Auth0 credentials verified.',
    ])
    expect(logs.some((line) => line.includes('Auth0 credentials verified.'))).to.equal(false)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('cancels setup when overwrite is declined', async () => {
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'old.example.com',
      AUTH0_MGMT_CLIENT_ID: 'old',
      AUTH0_MGMT_CLIENT_SECRET: 'old',
    })

    await runSetup({
      check: false,
      confirmOverwrite: async () => false,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      },
      force: false,
      log: (message) => logs.push(message),
      profileName: 'dev',
      targetDir: tempRoot,
    })

    expect(logs).to.contain('Setup cancelled.')
    expect(loadConfigFile(repoProfilePath(tempRoot, 'dev')).AUTH0_DOMAIN).to.equal(
      'old.example.com',
    )
  })

  it('overwrites existing profile when confirm handler approves', async () => {
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'old.example.com',
      AUTH0_MGMT_CLIENT_ID: 'old',
      AUTH0_MGMT_CLIENT_SECRET: 'old',
    })

    await runSetup({
      check: false,
      confirmOverwrite: async () => true,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      },
      force: false,
      log: (message) => logs.push(message),
      profileName: 'dev',
      targetDir: tempRoot,
    })

    expect(loadConfigFile(repoProfilePath(tempRoot, 'dev')).AUTH0_DOMAIN).to.equal(
      'tenant.example.com',
    )
  })

  it('prompts to set default profile when confirm handler is provided', async () => {
    await runSetup({
      check: false,
      confirmSetDefault: async () => true,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      },
      force: false,
      log: (message) => logs.push(message),
      profileName: 'staging',
      targetDir: tempRoot,
    })

    expect(readRepoDefaultProfile(tempRoot)).to.equal('staging')
    expect(logs.some((line) => line.includes('Set default profile'))).to.equal(true)
  })

  it('skips gitignore message when entry already exists', async () => {
    writeFileSync(join(tempRoot, '.gitignore'), `${GITIGNORE_ENTRY}\n`, 'utf8')

    await runSetup({
      check: false,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      },
      force: false,
      log: (message) => logs.push(message),
      profileName: 'dev',
      targetDir: tempRoot,
    })

    expect(logs.some((line) => line.includes('Added .wirebound/'))).to.equal(false)
    expect(logs.some((line) => line.includes('Wrote'))).to.equal(true)
  })

  it('listSetupProfiles formats available profiles', () => {
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'dev.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
    writeRepoProfile(tempRoot, 'test', {
      AUTH0_DOMAIN: 'test.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
    writeRepoDefaultProfile(tempRoot, 'dev')

    expect(listSetupProfiles(tempRoot)).to.equal('  dev (default)\n  test')
  })

  it('logs export hint when default profile is not set', async () => {
    await runSetup({
      check: false,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      },
      force: false,
      log: (message) => logs.push(message),
      profileName: 'staging',
      setDefault: false,
      targetDir: tempRoot,
    })

    expect(logs.some((line) => line.includes('export WIREBOUND_PROFILE=staging'))).to.equal(true)
  })

  it('logs default-profile hint when default is set', async () => {
    await runSetup({
      check: false,
      credentials: {
        clientId: 'cid',
        clientSecret: 'secret',
        domain: 'tenant.example.com',
      },
      force: false,
      log: (message) => logs.push(message),
      profileName: 'production',
      setDefault: true,
      targetDir: tempRoot,
    })

    expect(logs.some((line) => line.includes('uses default profile'))).to.equal(true)
  })

  it('wraps credential verification failures in CLIError', async () => {
    nock('https://tenant.example.com').post('/oauth/token').reply(401, 'invalid_client')

    try {
      await runSetup({
        check: true,
        credentials: {
          clientId: 'bad',
          clientSecret: 'bad',
          domain: 'tenant.example.com',
        },
        force: true,
        log: (message) => logs.push(message),
        profileName: 'test',
        targetDir: tempRoot,
      })
      expect.fail('Expected runSetup to throw')
    } catch (error) {
      expect(String(error)).to.contain('Credential check failed')
      expect(String(error)).to.contain('401')
    }
  })
})
