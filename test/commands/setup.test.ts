import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {writeRepoDefaultProfile, writeRepoProfile} from '../../src/lib/config/profile.js'

describe('setup', () => {
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
  })

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it('lists repo-local profiles with --list', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'wirebound-setup-'))
    writeRepoProfile(tempRoot, 'dev', {
      AUTH0_DOMAIN: 'tenant.example.com',
      AUTH0_MGMT_CLIENT_ID: 'cid',
      AUTH0_MGMT_CLIENT_SECRET: 'secret',
    })
    writeRepoDefaultProfile(tempRoot, 'dev')

    process.chdir(tempRoot)

    try {
      const {stdout} = await runCommand(['setup', '--list'])
      expect(stdout).to.contain('dev')
      expect(stdout).to.contain('(default)')
    } finally {
      rmSync(tempRoot, {force: true, recursive: true})
    }
  })

  it('rejects invalid profile names', async () => {
    const {error} = await runCommand(['setup', '--profile', '../bad'])
    expect(error?.message).to.contain('letters, numbers')
  })
})
