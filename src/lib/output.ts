import {type Auth0Log, type Auth0User} from './auth0/types.js'

export interface CandidateUser {
  user_id: string
  email?: string
  created_at?: string
  blocked?: boolean
  last_login?: string
}

export interface DeleteCommandResult {
  dryRun: boolean
  found: number
  eligible: number
  candidates: CandidateUser[]
  deleted: string[]
  errors: Array<{user_id: string; message: string}>
}

export interface UserSearchResult {
  total: number
  truncated: boolean
  users: Auth0User[]
}

export interface UserMutationResult {
  dryRun: boolean
  candidates: CandidateUser[]
  updated: string[]
  errors: Array<{user_id: string; message: string}>
}

export interface LogSearchResult {
  total: number
  truncated: boolean
  logs: Auth0Log[]
}

export type UserTableColumn = keyof CandidateUser | 'name'

const DEFAULT_USER_COLUMNS: UserTableColumn[] = [
  'email',
  'user_id',
  'created_at',
  'blocked',
  'last_login',
]

function pickUserField(user: Auth0User, field: UserTableColumn): string {
  if (field === 'name') return user.name ?? ''
  const value = user[field as keyof CandidateUser]
  if (value === undefined || value === null) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function projectUser(user: Auth0User, fields: UserTableColumn[]): Record<string, string> {
  const projected: Record<string, string> = {}
  for (const field of fields) {
    projected[field] = pickUserField(user, field)
  }
  return projected
}

function formatUserTable(
  users: Auth0User[],
  columns: UserTableColumn[] = DEFAULT_USER_COLUMNS,
): string[] {
  if (users.length === 0) return []

  const headers = columns.map((col) => col.toUpperCase().replace('_', ' '))
  const widths = headers.map((header, index) => {
    const col = columns[index]
    const maxValue = users.reduce((max, user) => {
      return Math.max(max, pickUserField(user, col).length)
    }, 0)
    return Math.max(header.length, maxValue, 8)
  })

  const pad = (value: string, width: number) => value.padEnd(width)

  return [
    '',
    headers.map((header, index) => pad(header, widths[index])).join(' '),
    ...users.map((user) =>
      columns
        .map((col, index) => pad(pickUserField(user, col), widths[index]))
        .join(' '),
    ),
  ]
}

function formatLogTable(logs: Auth0Log[]): string[] {
  if (logs.length === 0) return []

  const rows = logs.map((log) => ({
    date: log.date ?? '',
    description: log.description ?? '',
    ip: log.ip ?? '',
    type: log.type ?? '',
    user: log.user_name ?? log.user_id ?? '',
  }))

  const widths = {
    date: Math.max(4, ...rows.map((row) => row.date.length), 'DATE'.length),
    description: Math.max(
      11,
      ...rows.map((row) => row.description.length),
      'DESCRIPTION'.length,
    ),
    ip: Math.max(2, ...rows.map((row) => row.ip.length), 'IP'.length),
    type: Math.max(4, ...rows.map((row) => row.type.length), 'TYPE'.length),
    user: Math.max(4, ...rows.map((row) => row.user.length), 'USER'.length),
  }

  const pad = (value: string, width: number) => value.padEnd(width)

  return [
    '',
    [
      pad('DATE', widths.date),
      pad('TYPE', widths.type),
      pad('DESCRIPTION', widths.description),
      pad('USER', widths.user),
      pad('IP', widths.ip),
    ].join(' '),
    ...rows.map((row) =>
      [
        pad(row.date, widths.date),
        pad(row.type, widths.type),
        pad(row.description, widths.description),
        pad(row.user, widths.user),
        pad(row.ip, widths.ip),
      ].join(' '),
    ),
  ]
}

function formatHeader(result: DeleteCommandResult): string {
  if (result.dryRun) {
    return `Found ${result.eligible} google-only user(s) (dry run — use --confirm to delete)`
  }

  return `Deleted ${result.deleted.length} google-only user(s)`
}

function formatSummary(result: DeleteCommandResult): string {
  if (result.dryRun) {
    return `Summary: found=${result.found}, eligible=${result.eligible}, would_delete=${result.eligible}`
  }

  return `Summary: found=${result.found}, eligible=${result.eligible}, deleted=${result.deleted.length}, errors=${result.errors.length}`
}

function formatErrors(errors: DeleteCommandResult['errors']): string[] {
  if (errors.length === 0) return []

  const lines = ['', 'Errors:']
  for (const error of errors) {
    lines.push(`  ${error.user_id}: ${error.message}`)
  }

  return lines
}

export function formatHumanResult(result: DeleteCommandResult): string {
  const candidates: Auth0User[] = result.candidates.map((user) => ({
    created_at: user.created_at,
    email: user.email,
    user_id: user.user_id,
  }))

  return [
    formatHeader(result),
    ...formatUserTable(candidates, ['email', 'user_id', 'created_at']),
    '',
    formatSummary(result),
    ...formatErrors(result.errors),
  ].join('\n')
}

export function formatUserSearchResult(result: UserSearchResult, query: string): string {
  const truncatedNote = result.truncated
    ? ' (truncated — Auth0 search returns at most 1000 results)'
    : ''

  return [
    `Found ${result.users.length} user(s) matching query${truncatedNote}`,
    `Query: ${query}`,
    ...formatUserTable(result.users),
    '',
    `Summary: total=${result.total}, returned=${result.users.length}, truncated=${result.truncated}`,
  ].join('\n')
}

export function formatUserGetResult(users: Auth0User[]): string {
  if (users.length === 0) {
    return 'No user found'
  }

  const lines: string[] = []

  for (const user of users) {
    lines.push(`User: ${user.user_id}`)
    lines.push(`  email:       ${user.email ?? ''}`)
    lines.push(`  name:        ${user.name ?? ''}`)
    lines.push(`  blocked:     ${user.blocked ?? false}`)
    lines.push(`  created_at:  ${user.created_at ?? ''}`)
    lines.push(`  last_login:  ${user.last_login ?? ''}`)
    lines.push(`  logins:      ${user.logins_count ?? 0}`)

    if (user.identities && user.identities.length > 0) {
      lines.push('  identities:')
      for (const identity of user.identities) {
        lines.push(
          `    - ${identity.provider} (${identity.connection}) ${identity.user_id}`,
        )
      }
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

export function formatUserMutationResult(
  result: UserMutationResult,
  action: 'block' | 'unblock',
): string {
  const verb = action === 'block' ? 'block' : 'unblock'

  const header = result.dryRun
    ? `Would ${verb} ${result.candidates.length} user(s) (dry run — use --confirm to apply)`
    : `${action === 'block' ? 'Blocked' : 'Unblocked'} ${result.updated.length} user(s)`

  const summary = result.dryRun
    ? `Summary: candidates=${result.candidates.length}, would_update=${result.candidates.length}`
    : `Summary: updated=${result.updated.length}, errors=${result.errors.length}`

  const candidates: Auth0User[] = result.candidates.map((user) => ({
    blocked: user.blocked,
    created_at: user.created_at,
    email: user.email,
    user_id: user.user_id,
  }))

  return [
    header,
    ...formatUserTable(candidates, ['email', 'user_id', 'blocked']),
    '',
    summary,
    ...formatErrors(result.errors),
  ].join('\n')
}

export function formatLogSearchResult(result: LogSearchResult, query: string): string {
  const truncatedNote = result.truncated ? ' (more results may exist)' : ''

  return [
    `Found ${result.logs.length} log entries${truncatedNote}`,
    query ? `Query: ${query}` : 'Query: (none)',
    ...formatLogTable(result.logs),
    '',
    `Summary: returned=${result.logs.length}, truncated=${result.truncated}`,
  ].join('\n')
}

export function parseUserFields(fields: string | undefined): UserTableColumn[] {
  if (!fields) return DEFAULT_USER_COLUMNS

  return fields.split(',').map((field) => field.trim()) as UserTableColumn[]
}

export function buildLogQuery(options: {
  query?: string
  from?: string
  to?: string
}): string {
  const parts: string[] = []

  if (options.query) {
    parts.push(`(${options.query})`)
  }

  if (options.from && options.to) {
    parts.push(`date:[${options.from} TO ${options.to}]`)
  } else if (options.from) {
    parts.push(`date:[${options.from} TO *]`)
  } else if (options.to) {
    parts.push(`date:[* TO ${options.to}]`)
  }

  return parts.join(' AND ')
}

export function toCandidateUser(user: Auth0User): CandidateUser {
  return {
    blocked: user.blocked,
    created_at: user.created_at,
    email: user.email,
    last_login: user.last_login,
    user_id: user.user_id,
  }
}
