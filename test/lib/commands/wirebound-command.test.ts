import {expect} from 'chai'
import {CLIError} from '@oclif/core/errors'
import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {WireboundCommand} from '@/lib/commands/wirebound-command'

class TestCommand extends WireboundCommand {
  async run(): Promise<void> {
    await this.loadConfigVars('missing')
  }
}

describe('WireboundCommand', () => {
  let tempRoot: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempRoot = mkdtempSync(join(tmpdir(), 'wirebound-command-'))
    process.chdir(tempRoot)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tempRoot, {force: true, recursive: true})
  })

  it('wraps profile resolution errors in CLIError', async () => {
    try {
      await TestCommand.run([], import.meta.url)
      expect.fail('Expected command to throw')
    } catch (error) {
      expect(error).to.be.instanceOf(CLIError)
      expect(String(error)).to.contain('Profile not found: missing')
    }
  })
})
