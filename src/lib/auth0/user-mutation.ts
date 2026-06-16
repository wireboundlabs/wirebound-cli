import {Auth0Client} from './client'
import {type Auth0User} from './types'
import {toCandidateUser, type UserMutationResult} from '@/lib/output'
import {type ProgressReporter} from '@/lib/progress'
import {resolveUsers, validateTargetFlags} from './resolve-users'

export async function runUserBlockMutation(
  client: Auth0Client,
  options: {
    email?: string
    id?: string
    query?: string
    limit?: number
    confirm: boolean
    blocked: boolean
    logVerbose: (message: string) => void
    progress?: ProgressReporter
  },
): Promise<UserMutationResult> {
  validateTargetFlags(options)

  const progress = options.progress
  progress?.fetchStart('Finding users', options.limit)

  const users = await resolveUsers(client, {
    email: options.email,
    id: options.id,
    limit: options.limit,
    onPage: ({collected, page, rawCount, total}) => {
      options.logVerbose(
        `Page ${page}: ${rawCount} result(s), ${total} total match(es) in search`,
      )
      progress?.fetchPage({collected, page, rawCount, total})
    },
    query: options.query,
  })

  progress?.fetchStop()

  const candidates = users.filter((user) => shouldUpdate(user, options.blocked))

  const result: UserMutationResult = {
    candidates: candidates.map(toCandidateUser),
    dryRun: !options.confirm,
    errors: [],
    updated: [],
  }

  if (!options.confirm) {
    return result
  }

  progress?.taskStart(
    options.blocked ? 'Blocking users' : 'Unblocking users',
    candidates.length,
  )

  for (const user of candidates) {
    try {
      await client.updateUser(user.user_id, {blocked: options.blocked})
      result.updated.push(user.user_id)
      options.logVerbose(
        `${options.blocked ? 'Blocked' : 'Unblocked'} ${user.user_id}`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.errors.push({message, user_id: user.user_id})
    }

    progress?.taskAdvance()
  }

  progress?.taskStop()

  return result
}

function shouldUpdate(user: Auth0User, blocked: boolean): boolean {
  return Boolean(user.blocked) !== blocked
}
