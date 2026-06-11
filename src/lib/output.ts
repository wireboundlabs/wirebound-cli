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

export function formatHumanResult(result: CommandResult): string {
  const lines: string[] = []

  if (result.dryRun) {
    lines.push(
      `Found ${result.eligible} google-only user(s) (dry run — use --confirm to delete)`,
    )
  } else {
    lines.push(`Deleted ${result.deleted.length} google-only user(s)`)
  }

  if (result.candidates.length > 0) {
    lines.push('')
    lines.push(
      padRow('EMAIL', 'USER_ID', 'CREATED'),
    )
    for (const user of result.candidates) {
      lines.push(
        padRow(
          user.email ?? '',
          user.user_id,
          user.created_at ?? '',
        ),
      )
    }
  }

  lines.push('')
  if (result.dryRun) {
    lines.push(
      `Summary: found=${result.found}, eligible=${result.eligible}, would_delete=${result.eligible}`,
    )
  } else {
    lines.push(
      `Summary: found=${result.found}, eligible=${result.eligible}, deleted=${result.deleted.length}, errors=${result.errors.length}`,
    )
  }

  if (result.errors.length > 0) {
    lines.push('')
    lines.push('Errors:')
    for (const error of result.errors) {
      lines.push(`  ${error.user_id}: ${error.message}`)
    }
  }

  return lines.join('\n')
}

function padRow(email: string, userId: string, created: string): string {
  return `${email.padEnd(30)} ${userId.padEnd(28)} ${created}`
}
