export interface CandidateUser {
  user_id: string
  email?: string
  created_at?: string
}

export interface CommandResult {
  dryRun: boolean
  found: number
  eligible: number
  candidates: CandidateUser[]
  deleted: string[]
  errors: Array<{user_id: string; message: string}>
}

function formatHeader(result: CommandResult): string {
  if (result.dryRun) {
    return `Found ${result.eligible} google-only user(s) (dry run — use --confirm to delete)`
  }

  return `Deleted ${result.deleted.length} google-only user(s)`
}

function formatCandidateTable(candidates: CandidateUser[]): string[] {
  if (candidates.length === 0) {
    return []
  }

  return [
    '',
    padRow('EMAIL', 'USER_ID', 'CREATED'),
    ...candidates.map((user) =>
      padRow(user.email ?? '', user.user_id, user.created_at ?? ''),
    ),
  ]
}

function formatSummary(result: CommandResult): string {
  if (result.dryRun) {
    return `Summary: found=${result.found}, eligible=${result.eligible}, would_delete=${result.eligible}`
  }

  return `Summary: found=${result.found}, eligible=${result.eligible}, deleted=${result.deleted.length}, errors=${result.errors.length}`
}

function formatErrors(errors: CommandResult['errors']): string[] {
  if (errors.length === 0) {
    return []
  }

  const lines = ['', 'Errors:']
  for (const error of errors) {
    lines.push(`  ${error.user_id}: ${error.message}`)
  }

  return lines
}

export function formatHumanResult(result: CommandResult): string {
  return [
    formatHeader(result),
    ...formatCandidateTable(result.candidates),
    '',
    formatSummary(result),
    ...formatErrors(result.errors),
  ].join('\n')
}

function padRow(email: string, userId: string, created: string): string {
  return `${email.padEnd(30)} ${userId.padEnd(28)} ${created}`
}
