import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {expect} from 'chai'
import nock from 'nock'

import {writeRepoDefaultProfile, writeRepoProfile} from '@/lib/config/profile'

const DOMAIN = 'tenant.example.com'
const BASE = `https://${DOMAIN}`

const googleOnlyUser = {
  created_at: '2024-01-01T00:00:00.000Z',
  email: 'solo@gmail.com',
  identities: [{connection: 'google-oauth2', provider: 'google-oauth2', user_id: '123'}],
  user_id: 'google-oauth2|123',
}

const linkedUser = {
  email: 'linked@gmail.com',
  identities: [
    {connection: 'google-oauth2', provider: 'google-oauth2', user_id: '456'},
    {connection: 'Username-Password-Authentication', provider: 'auth0', user_id: 'abc'},
  ],
  user_id: 'auth0|abc',
}

const databaseOnlyUser = {
  email: 'db@example.com',
  identities: [
    {connection: 'Username-Password-Authentication', provider: 'auth0', user_id: 'def'},
  ],
  user_id: 'auth0|def',
}

const authFlags = ['--domain', DOMAIN, '--client-id', 'cid', '--client-secret', 'secret']

function mockToken(): void {
  nock(BASE)
    .post('/oauth/token')
    .reply(200, {access_token: 'token', expires_in: 86400, token_type: 'Bearer'})
}

function mockUserSearch(users: unknown[]): void {
  nock(BASE)
    .get('/api/v2/users')
    .query(true)
    .reply(200, {
      length: users.length,
      limit: 100,
      start: 0,
      total: users.length,
      users,
    })
}

async function runWithRepoProfile(
  tempRoot: string,
  args: string[],
  setup: () => void,
): Promise<{eligible: number}> {
  setup()
  process.chdir(tempRoot)
  mockToken()
  mockUserSearch([googleOnlyUser])

  try {
    const {stdout} = await runCommand(args)
    return JSON.parse(stdout) as {eligible: number}
  } finally {
    rmSync(tempRoot, {force: true, recursive: true})
  }
}

describe('auth0 users cleanup-google-orphans', () => {
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
  })

  afterEach(() => {
    process.chdir(originalCwd)
    nock.cleanAll()
  })

  it('dry-run lists only google-only users and performs no deletes', async () => {
    mockToken()
    mockUserSearch([googleOnlyUser, linkedUser, databaseOnlyUser])

    const {stdout} = await runCommand([
      'auth0:users:cleanup-google-orphans',
      ...authFlags,
    ])

    expect(stdout).to.contain('solo@gmail.com')
    expect(stdout).to.contain('google-oauth2|123')
    expect(stdout).to.contain('dry run')
    expect(stdout).not.to.contain('linked@gmail.com')
    expect(stdout).not.to.contain('db@example.com')
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('json dry-run returns only eligible candidates', async () => {
    mockToken()
    mockUserSearch([googleOnlyUser, linkedUser, databaseOnlyUser])

    const {stdout} = await runCommand([
      'auth0:users:cleanup-google-orphans',
      ...authFlags,
      '--json',
    ])

    const result = JSON.parse(stdout) as {
      dryRun: boolean
      eligible: number
      candidates: Array<{user_id: string}>
      deleted: string[]
    }

    expect(result.dryRun).to.equal(true)
    expect(result.eligible).to.equal(1)
    expect(result.candidates).to.have.length(1)
    expect(result.candidates[0].user_id).to.equal('google-oauth2|123')
    expect(result.deleted).to.have.length(0)
  })

  it('loads credentials from default repo profile', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'wirebound-auth0-'))
    const result = await runWithRepoProfile(
      tempRoot,
      ['auth0:users:cleanup-google-orphans', '--json'],
      () => {
        writeRepoProfile(tempRoot, 'dev', {
          AUTH0_DOMAIN: DOMAIN,
          AUTH0_MGMT_CLIENT_ID: 'cid',
          AUTH0_MGMT_CLIENT_SECRET: 'secret',
        })
        writeRepoDefaultProfile(tempRoot, 'dev')
      },
    )

    expect(result.eligible).to.equal(1)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('loads credentials from a named repo profile via --profile', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'wirebound-auth0-'))
    const result = await runWithRepoProfile(
      tempRoot,
      ['auth0:users:cleanup-google-orphans', '--profile', 'production', '--json'],
      () => {
        writeRepoProfile(tempRoot, 'production', {
          AUTH0_DOMAIN: DOMAIN,
          AUTH0_MGMT_CLIENT_ID: 'cid',
          AUTH0_MGMT_CLIENT_SECRET: 'secret',
        })
      },
    )

    expect(result.eligible).to.equal(1)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('confirm deletes only eligible google-only users', async () => {
    mockToken()
    mockUserSearch([googleOnlyUser, linkedUser])

    nock(BASE)
      .delete('/api/v2/users/google-oauth2%7C123')
      .reply(204)

    const {stdout} = await runCommand([
      'auth0:users:cleanup-google-orphans',
      ...authFlags,
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {deleted: string[]; errors: unknown[]}
    expect(result.deleted).to.deep.equal(['google-oauth2|123'])
    expect(result.errors).to.have.length(0)
    expect(nock.pendingMocks()).to.have.length(0)
  })

  it('records delete errors and exits non-zero', async () => {
    mockToken()
    mockUserSearch([googleOnlyUser])

    nock(BASE).delete('/api/v2/users/google-oauth2%7C123').reply(500, 'fail')

    const {stdout, error} = await runCommand([
      'auth0:users:cleanup-google-orphans',
      ...authFlags,
      '--confirm',
      '--json',
    ])

    const result = JSON.parse(stdout) as {deleted: string[]; errors: Array<{user_id: string}>}
    expect(result.deleted).to.have.length(0)
    expect(result.errors).to.have.length(1)
    expect(result.errors[0].user_id).to.equal('google-oauth2|123')
    expect(error).to.not.equal(undefined)
  })

  it('primary command does not emit alias deprecation warning', async () => {
    mockToken()
    mockUserSearch([googleOnlyUser])

    const {stderr} = await runCommand([
      'auth0:users:cleanup-google-orphans',
      ...authFlags,
      '--json',
    ])

    expect(stderr).not.to.contain('deprecated')
  })

  it('auth0 delete-google-users alias runs the same command', async () => {
    mockToken()
    mockUserSearch([googleOnlyUser, linkedUser, databaseOnlyUser])

    const originalArgv = process.argv
    process.argv = ['node', 'wirebound', 'auth0', 'delete-google-users', ...authFlags, '--json']

    try {
      const {stdout, stderr} = await runCommand([
        'auth0:delete-google-users',
        ...authFlags,
        '--json',
      ])

      const result = JSON.parse(stdout) as {eligible: number; dryRun: boolean}
      expect(result.dryRun).to.equal(true)
      expect(result.eligible).to.equal(1)
      expect(stderr).to.contain('auth0 delete-google-users')
      expect(stderr).to.contain('deprecated')
      expect(stderr).to.contain('auth0 users cleanup-google-orphans')
      expect(nock.pendingMocks()).to.have.length(0)
    } finally {
      process.argv = originalArgv
    }
  })
})
