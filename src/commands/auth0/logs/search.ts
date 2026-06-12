import {Flags} from '@oclif/core'

import {Auth0Client} from '../../../lib/auth0/client.js'
import {
  buildLogQuery,
  formatLogSearchResult,
  type LogSearchResult,
} from '../../../lib/output.js'
import {Auth0Command} from '../../../lib/commands/auth0-command.js'
import {RateLimiter} from '../../../lib/rate-limiter.js'

export default class Auth0LogsSearch extends Auth0Command {
  static override description = 'Search Auth0 tenant logs with Lucene query syntax'

  static override examples = [
    '<%= config.bin %> auth0 logs search --query \'type:failed_login\'',
    '<%= config.bin %> auth0 logs search --query \'type:seccft\' --limit 20 --json',
    '<%= config.bin %> auth0 logs search --from 2026-06-01 --to 2026-06-12 --query \'type:f\'',
  ]

  static override flags = {
    ...Auth0Command.baseFlags,
    from: Flags.string({
      description: 'Start date (ISO 8601); appended to query as date:[from TO *]',
    }),
    limit: Flags.integer({
      default: 50,
      description: 'Maximum number of log entries to return',
    }),
    query: Flags.string({
      char: 'q',
      description: 'Lucene query (Auth0 logs search syntax)',
    }),
    to: Flags.string({
      description: 'End date (ISO 8601); appended to query as date:[* TO to]',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Auth0LogsSearch)
    const config = await this.resolveConfig(flags)

    const limiter = new RateLimiter({
      onRetry: (message) => this.logVerbose(message, flags.verbose),
      rps: config.rps,
    })
    const client = new Auth0Client(config, limiter)

    const query = buildLogQuery({
      from: flags.from,
      query: flags.query,
      to: flags.to,
    })

    this.logVerbose(`Searching logs on ${config.domain}`, flags.verbose)

    const {logs, truncated} = await client.searchLogs(query, {
      limit: flags.limit,
      onPage: ({page, rawCount}) => {
        this.logVerbose(`Page ${page}: ${rawCount} log(s)`, flags.verbose)
      },
    })

    const result: LogSearchResult = {
      logs,
      total: logs.length,
      truncated,
    }

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
      return
    }

    this.log(formatLogSearchResult(result, query))
  }
}
