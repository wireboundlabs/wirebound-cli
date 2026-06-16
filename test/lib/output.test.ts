import {expect} from 'chai'

import {
  buildLogQuery,
  formatDuplicateEmailsResult,
  formatHumanResult,
  formatLogSearchResult,
  formatOrgMemberMutationResult,
  formatOrganizationListResult,
  formatOrganizationMembersResult,
  formatUserGetResult,
  formatUserMutationResult,
  formatUserSearchResult,
  parseUserFields,
  toCandidateUser,
} from '@/lib/output'

describe('output formatters', () => {
  it('formatUserGetResult handles empty results', () => {
    expect(formatUserGetResult([])).to.equal('No user found')
  })

  it('formatUserGetResult renders user details and identities', () => {
    const output = formatUserGetResult([
      {
        blocked: true,
        created_at: '2024-01-01T00:00:00.000Z',
        email: 'user@example.com',
        identities: [
          {connection: 'Username-Password-Authentication', provider: 'auth0', user_id: '1'},
        ],
        last_login: '2024-06-01T00:00:00.000Z',
        logins_count: 2,
        name: 'Test User',
        user_id: 'auth0|1',
      },
    ])

    expect(output).to.contain('auth0|1')
    expect(output).to.contain('Test User')
    expect(output).to.contain('auth0 (Username-Password-Authentication)')
  })

  it('formatUserGetResult omits identities section when none exist', () => {
    const output = formatUserGetResult([
      {
        blocked: false,
        email: 'user@example.com',
        user_id: 'auth0|1',
      },
    ])

    expect(output).to.contain('auth0|1')
    expect(output).to.not.contain('identities:')
  })

  it('formatUserSearchResult notes truncation', () => {
    const output = formatUserSearchResult(
      {
        total: 2000,
        truncated: true,
        users: [{email: 'a@example.com', user_id: 'auth0|1'}],
      },
      'email:a@example.com',
    )

    expect(output).to.contain('truncated')
    expect(output).to.contain('a@example.com')
  })

  it('formatUserSearchResult omits truncation note for complete results', () => {
    const output = formatUserSearchResult(
      {
        total: 1,
        truncated: false,
        users: [{email: 'a@example.com', user_id: 'auth0|1'}],
      },
      'email:a@example.com',
    )

    expect(output).to.not.contain('(truncated')
    expect(output).to.contain('Found 1 user(s) matching query')
  })

  it('formatUserMutationResult renders block and unblock summaries', () => {
    const dryRun = formatUserMutationResult(
      {
        candidates: [{email: 'a@example.com', user_id: 'auth0|1'}],
        dryRun: true,
        errors: [],
        updated: [],
      },
      'block',
    )
    const confirmed = formatUserMutationResult(
      {
        candidates: [{email: 'a@example.com', user_id: 'auth0|1'}],
        dryRun: false,
        errors: [{message: 'failed', user_id: 'auth0|1'}],
        updated: [],
      },
      'unblock',
    )

    expect(dryRun).to.contain('Would block')
    expect(confirmed).to.contain('Unblocked 0 user(s)')
    expect(confirmed).to.contain('auth0|1: failed')

    const confirmedBlock = formatUserMutationResult(
      {
        candidates: [{email: 'a@example.com', user_id: 'auth0|1'}],
        dryRun: false,
        errors: [],
        updated: ['auth0|1'],
      },
      'block',
    )
    expect(confirmedBlock).to.contain('Blocked 1 user(s)')
  })

  it('formatLogSearchResult handles empty query', () => {
    const output = formatLogSearchResult({logs: [], total: 0, truncated: false}, '')

    expect(output).to.contain('Query: (none)')
  })

  it('formatLogSearchResult notes truncation and includes query text', () => {
    const output = formatLogSearchResult(
      {
        logs: [{date: '2024-01-01', log_id: 'log_1', type: 's'}],
        total: 2,
        truncated: true,
      },
      'type:s',
    )

    expect(output).to.contain('more results may exist')
    expect(output).to.contain('Query: type:s')
  })

  it('formatLogSearchResult omits truncation note for complete results', () => {
    const output = formatLogSearchResult(
      {
        logs: [{date: '2024-01-01', log_id: 'log_1', type: 's'}],
        total: 1,
        truncated: false,
      },
      'type:s',
    )

    expect(output).to.not.contain('more results may exist')
  })

  it('formatDuplicateEmailsResult renders duplicate groups', () => {
    const output = formatDuplicateEmailsResult({
      duplicateCount: 1,
      duplicates: [
        {
          count: 2,
          email: 'shared@example.com',
          providers: ['google-oauth2', 'auth0'],
          user_ids: ['google-oauth2|1', 'auth0|2'],
        },
      ],
      scanned: 3,
      truncated: false,
    })

    expect(output).to.contain('shared@example.com')
    expect(output).to.contain('duplicates=1')
  })

  it('formatDuplicateEmailsResult notes truncation and empty duplicates', () => {
    const truncated = formatDuplicateEmailsResult({
      duplicateCount: 0,
      duplicates: [],
      scanned: 1000,
      truncated: true,
    })

    expect(truncated).to.contain('truncated')
    expect(truncated).to.contain('duplicates=0')
  })

  it('formatOrganizationListResult renders organizations', () => {
    const output = formatOrganizationListResult({
      organizations: [{display_name: 'Acme', id: 'org_1', name: 'acme-corp'}],
      total: 1,
      truncated: false,
    })

    expect(output).to.contain('acme-corp')
    expect(output).to.contain('org_1')

    const truncated = formatOrganizationListResult({
      organizations: [],
      total: 10,
      truncated: true,
    })
    expect(truncated).to.contain('more results may exist')
  })

  it('formatOrganizationListResult omits truncation note for complete results', () => {
    const output = formatOrganizationListResult({
      organizations: [{display_name: 'Acme', id: 'org_1', name: 'acme-corp'}],
      total: 1,
      truncated: false,
    })

    expect(output).to.not.contain('more results may exist')
  })

  it('formatOrganizationMembersResult renders members', () => {
    const output = formatOrganizationMembersResult({
      members: [{email: 'user@example.com', name: 'User', user_id: 'auth0|1'}],
      org: {id: 'org_1', name: 'acme-corp'},
      total: 1,
      truncated: false,
    })

    expect(output).to.contain('acme-corp')
    expect(output).to.contain('user@example.com')
    expect(output).to.contain('User')
  })

  it('formatOrganizationMembersResult notes truncated member lists', () => {
    const output = formatOrganizationMembersResult({
      members: [],
      org: {id: 'org_1', name: 'acme-corp'},
      total: 10,
      truncated: true,
    })

    expect(output).to.contain('more results may exist')
  })

  it('formatOrgMemberMutationResult renders add dry-run', () => {
    const output = formatOrgMemberMutationResult({
      action: 'add',
      candidates: [{email: 'user@example.com', user_id: 'auth0|1'}],
      dryRun: true,
      errors: [],
      org: {id: 'org_1', name: 'acme-corp'},
      updated: [],
    })

    expect(output).to.contain('Would add to org acme-corp')
  })

  it('formatOrgMemberMutationResult renders confirmed add summary', () => {
    const output = formatOrgMemberMutationResult({
      action: 'add',
      candidates: [{email: 'user@example.com', user_id: 'auth0|1'}],
      dryRun: false,
      errors: [],
      org: {id: 'org_1', name: 'acme-corp'},
      updated: ['auth0|1'],
    })

    expect(output).to.contain('Added 1 user(s) to org acme-corp')
  })

  it('formatOrgMemberMutationResult renders confirmed remove with errors', () => {
    const output = formatOrgMemberMutationResult({
      action: 'remove',
      candidates: [{email: 'user@example.com', user_id: 'auth0|1'}],
      dryRun: false,
      errors: [{message: 'failed', user_id: 'auth0|1'}],
      org: {id: 'org_1', name: 'acme-corp'},
      updated: [],
    })

    expect(output).to.contain('Removed 0 user(s) from org acme-corp')
    expect(output).to.contain('auth0|1: failed')
  })

  it('formatOrgMemberMutationResult renders remove dry-run', () => {
    const output = formatOrgMemberMutationResult({
      action: 'remove',
      candidates: [{email: 'user@example.com', user_id: 'auth0|1'}],
      dryRun: true,
      errors: [],
      org: {id: 'org_1', name: 'acme-corp'},
      updated: [],
    })

    expect(output).to.contain('Would remove from org acme-corp')
  })

  it('formatHumanResult renders delete dry-run output', () => {
    const output = formatHumanResult({
      candidates: [
        {
          created_at: '2024-01-01T00:00:00.000Z',
          email: 'solo@gmail.com',
          user_id: 'google-oauth2|123',
        },
      ],
      deleted: [],
      dryRun: true,
      eligible: 1,
      errors: [],
      found: 1,
    })

    expect(output).to.contain('dry run')
    expect(output).to.contain('solo@gmail.com')
  })

  it('formatHumanResult renders confirmed delete output with errors', () => {
    const output = formatHumanResult({
      candidates: [
        {
          created_at: '2024-01-01T00:00:00.000Z',
          email: 'solo@gmail.com',
          user_id: 'google-oauth2|123',
        },
      ],
      deleted: [],
      dryRun: false,
      eligible: 1,
      errors: [{message: 'failed', user_id: 'google-oauth2|123'}],
      found: 1,
    })

    expect(output).to.contain('Errors:')
    expect(output).to.contain('google-oauth2|123: failed')
  })

  it('formatHumanResult renders confirmed delete summary', () => {
    const output = formatHumanResult({
      candidates: [
        {
          created_at: '2024-01-01T00:00:00.000Z',
          email: 'solo@gmail.com',
          user_id: 'google-oauth2|123',
        },
      ],
      deleted: ['google-oauth2|123'],
      dryRun: false,
      eligible: 1,
      errors: [],
      found: 1,
    })

    expect(output).to.contain('Deleted 1 google-only user(s)')
    expect(output).to.contain('deleted=1')
  })

  it('buildLogQuery combines query and date filters', () => {
    expect(buildLogQuery({from: '2026-06-01', query: 'type:f', to: '2026-06-12'})).to.equal(
      '(type:f) AND date:[2026-06-01 TO 2026-06-12]',
    )
    expect(buildLogQuery({from: '2026-06-01'})).to.equal('date:[2026-06-01 TO *]')
    expect(buildLogQuery({to: '2026-06-12'})).to.equal('date:[* TO 2026-06-12]')
    expect(buildLogQuery({})).to.equal('')
    expect(buildLogQuery({query: 'type:f'})).to.equal('(type:f)')
    expect(buildLogQuery({from: '2026-06-01', to: '2026-06-12'})).to.equal(
      'date:[2026-06-01 TO 2026-06-12]',
    )
  })

  it('parseUserFields splits custom columns', () => {
    expect(parseUserFields('email,user_id')).to.deep.equal(['email', 'user_id'])
    expect(parseUserFields(undefined)).to.deep.equal([
      'email',
      'user_id',
      'created_at',
      'blocked',
      'last_login',
    ])
  })

  it('toCandidateUser projects user fields', () => {
    expect(
      toCandidateUser({
        blocked: false,
        created_at: '2024-01-01T00:00:00.000Z',
        email: 'a@example.com',
        last_login: '2024-06-01T00:00:00.000Z',
        user_id: 'auth0|1',
      }),
    ).to.deep.equal({
      blocked: false,
      created_at: '2024-01-01T00:00:00.000Z',
      email: 'a@example.com',
      last_login: '2024-06-01T00:00:00.000Z',
      user_id: 'auth0|1',
    })
  })
})
