import {Auth0Client} from './client'
import {resolveOrganization, validateOrgFlags} from './resolve-org'
import {resolveUsers, validateTargetFlags} from './resolve-users'
import {type Auth0User} from './types'
import {toCandidateUser, type OrgMemberMutationResult} from '@/lib/output'
import {type ProgressReporter} from '@/lib/progress'

export async function runOrgMemberMutation(
  client: Auth0Client,
  options: {
    orgId?: string
    orgName?: string
    email?: string
    id?: string
    query?: string
    limit?: number
    confirm: boolean
    action: 'add' | 'remove'
    logVerbose: (message: string) => void
    progress?: ProgressReporter
  },
): Promise<OrgMemberMutationResult> {
  validateOrgFlags({orgId: options.orgId, orgName: options.orgName})
  validateTargetFlags(options)

  const progress = options.progress

  const org = progress
    ? await progress.spinAsync('Resolving organization', () =>
        resolveOrganization(client, {
          orgId: options.orgId,
          orgName: options.orgName,
        }),
      )
    : await resolveOrganization(client, {
        orgId: options.orgId,
        orgName: options.orgName,
      })

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
  progress?.fetchStart('Loading org members')

  const existingMembers = await client.listAllOrganizationMembers(org.id, {
    onPage: ({collected, page, rawCount, total}) => {
      options.logVerbose(
        `Members page ${page}: ${rawCount} result(s), ${total} total member(s)`,
      )
      progress?.fetchPage({collected, page, rawCount, total})
    },
  })

  progress?.fetchStop()
  const existingIds = new Set(existingMembers.map((member) => member.user_id))

  const candidates = users.filter((user) =>
    shouldMutate(user, options.action, existingIds),
  )

  const result: OrgMemberMutationResult = {
    action: options.action,
    candidates: candidates.map(toCandidateUser),
    dryRun: !options.confirm,
    errors: [],
    org: {id: org.id, name: org.name},
    updated: [],
  }

  if (!options.confirm) {
    return result
  }

  progress?.taskStart(
    options.action === 'add' ? 'Adding org members' : 'Removing org members',
    candidates.length,
  )

  for (const user of candidates) {
    try {
      if (options.action === 'add') {
        await client.addOrganizationMembers(org.id, [user.user_id])
      } else {
        await client.removeOrganizationMembers(org.id, [user.user_id])
      }
      result.updated.push(user.user_id)
      options.logVerbose(
        `${options.action === 'add' ? 'Added' : 'Removed'} ${user.user_id} ${options.action === 'add' ? 'to' : 'from'} org ${org.name}`,
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

function shouldMutate(
  user: Auth0User,
  action: 'add' | 'remove',
  existingIds: Set<string>,
): boolean {
  if (action === 'add') {
    return !existingIds.has(user.user_id)
  }

  return existingIds.has(user.user_id)
}
