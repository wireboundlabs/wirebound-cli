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
  readRepoDefaultProfile,
  repoProfilePath,
  resolveProfileVars,
  writeRepoDefaultProfile,
  writeRepoProfile,
} from '../../../src/lib/config/profile.js'
import {listSetupProfiles, runSetup} from '../../../src/lib/setup/run-setup.js'

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
})
