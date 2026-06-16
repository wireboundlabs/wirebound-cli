import {type Auth0User} from './types'

export interface DuplicateEmailGroup {
  email: string
  count: number
  user_ids: string[]
  providers: string[]
}

export function groupUsersByEmail(users: Auth0User[]): DuplicateEmailGroup[] {
  const byEmail = new Map<string, Auth0User[]>()

  for (const user of users) {
    const email = user.email?.trim().toLowerCase()
    if (!email) continue

    const group = byEmail.get(email) ?? []
    group.push(user)
    byEmail.set(email, group)
  }

  const duplicates: DuplicateEmailGroup[] = []

  for (const [email, group] of byEmail) {
    if (group.length < 2) continue

    duplicates.push({
      count: group.length,
      email,
      providers: group.flatMap((user) =>
        (user.identities ?? []).map((identity) => identity.provider),
      ),
      user_ids: group.map((user) => user.user_id),
    })
  }

  duplicates.sort((a, b) => b.count - a.count || a.email.localeCompare(b.email))
  return duplicates
}
