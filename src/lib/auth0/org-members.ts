import {Flags} from '@oclif/core'

import {Auth0Command} from '@/lib/commands/auth0-command'

export const orgTargetFlags = {
  'org-id': Flags.string({
    description: 'Auth0 organization ID',
  }),
  'org-name': Flags.string({
    description: 'Auth0 organization name',
  }),
}

const orgMemberTargetFlags = {
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

export const orgMemberMutationFlags = {
  ...Auth0Command.baseFlags,
  confirm: Flags.boolean({
    default: false,
    description: 'Apply the change (default is dry-run)',
  }),
  ...orgTargetFlags,
  ...orgMemberTargetFlags,
}
