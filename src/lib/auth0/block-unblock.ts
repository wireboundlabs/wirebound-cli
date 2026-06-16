import {Flags} from '@oclif/core'

import {Auth0Command} from '@/lib/commands/auth0-command'
import {type Auth0Config, formatRateLimitSummary} from '@/lib/config/auth0'
import {createAuth0Client} from '@/lib/auth0/create-client'
import {formatUserMutationResult} from '@/lib/output'
import {type ProgressReporter} from '@/lib/progress'
import {runUserBlockMutation} from './user-mutation'

const targetFlags = {
  email: Flags.string({
    description: 'User email address',
  }),
  id: Flags.string({
    description: 'Auth0 user ID',
  }),
  limit: Flags.integer({
    description: 'Maximum number of users to process when using --query',
  }),
  query: Flags.string({
    char: 'q',
    description: 'Lucene v3 search query',
  }),
}

export const blockUnblockBaseFlags = {
  ...Auth0Command.baseFlags,
  confirm: Flags.boolean({
    default: false,
    description: 'Apply the change (default is dry-run)',
  }),
  ...targetFlags,
}

export async function runBlockUnblockCommand(
  host: {
    exit: (code: number) => void
    log: (message: string) => void
    logVerbose: (message: string, verbose: boolean) => void
  },
  options: {
    blocked: boolean
    action: 'block' | 'unblock'
    flags: {
      confirm: boolean
      email?: string
      id?: string
      limit?: number
      query?: string
      json?: boolean
      verbose?: boolean
      domain?: string
      'client-id'?: string
      'client-secret'?: string
      rps?: number
      profile?: string
    }
    resolveConfig: (flags: {
      domain?: string
      'client-id'?: string
      'client-secret'?: string
      rps?: number
      profile?: string
      verbose?: boolean
    }) => Promise<Auth0Config>
    progress?: ProgressReporter
  },
): Promise<void> {
    const config = await options.resolveConfig(options.flags)

    const client = createAuth0Client(config, {
      onRetry: (message) => host.logVerbose(message, options.flags.verbose ?? false),
    })

    if (options.flags.verbose) {
      host.logVerbose(`Auth0 tenant: ${config.domain}`, true)
      host.logVerbose(`Rate limits: ${formatRateLimitSummary(config)}`, true)
    }

  const result = await runUserBlockMutation(client, {
    blocked: options.blocked,
    confirm: options.flags.confirm,
    email: options.flags.email,
    id: options.flags.id,
    limit: options.flags.limit,
    logVerbose: (message) => host.logVerbose(message, options.flags.verbose ?? false),
    progress: options.progress,
    query: options.flags.query,
  })

  if (options.flags.json) {
    host.log(JSON.stringify(result, null, 2))
  } else {
    host.log(formatUserMutationResult(result, options.action))
  }

  if (result.errors.length > 0) {
    host.exit(1)
  }
}
