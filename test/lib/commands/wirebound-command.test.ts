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

class VerboseHarness extends WireboundCommand {
  async run(): Promise<void> {}

  testLogging(): string[] {
    const logs: string[] = []
    this.log = (message: string) => {
      logs.push(message)
    }
    this.logVerbose('hidden', false)
    this.logVerbose('visible', true)
    return logs
  }

  testPageProgress(): string[] {
    const logs: string[] = []
    this.log = (message: string) => {
      logs.push(message)
    }
    const progress = this.createProgress({json: false, verbose: false})
    const handler = this.pageProgressHandler(progress, true, (info) => `page ${info.page}`)
    handler({collected: 1, page: 0, rawCount: 1, total: 1})
    return logs
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

  it('logs verbose output and forwards page progress when enabled', () => {
    const command = new VerboseHarness([], {} as ConstructorParameters<typeof WireboundCommand>[1])

    expect(command.testLogging()).to.deep.equal(['visible'])
    expect(command.testPageProgress()).to.deep.equal(['page 0'])
  })
})
