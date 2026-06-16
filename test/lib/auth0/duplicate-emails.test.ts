import {expect} from 'chai'

import {groupUsersByEmail} from '@/lib/auth0/duplicate-emails'

describe('groupUsersByEmail', () => {
  it('returns groups with more than one user per email', () => {
    const groups = groupUsersByEmail([
      {
        email: 'shared@example.com',
        identities: [{connection: 'google-oauth2', provider: 'google-oauth2', user_id: '1'}],
        user_id: 'google-oauth2|1',
      },
      {
        email: 'shared@example.com',
        identities: [
          {connection: 'Username-Password-Authentication', provider: 'auth0', user_id: '2'},
        ],
        user_id: 'auth0|2',
      },
      {
        email: 'solo@example.com',
        identities: [{connection: 'auth0', provider: 'auth0', user_id: '3'}],
        user_id: 'auth0|3',
      },
    ])

    expect(groups).to.have.length(1)
    expect(groups[0].email).to.equal('shared@example.com')
    expect(groups[0].count).to.equal(2)
    expect(groups[0].user_ids).to.deep.equal(['google-oauth2|1', 'auth0|2'])
    expect(groups[0].providers).to.deep.equal(['google-oauth2', 'auth0'])
  })

  it('ignores users without email and normalizes case', () => {
    const groups = groupUsersByEmail([
      {email: 'A@Example.com', user_id: 'auth0|1'},
      {email: 'a@example.com', user_id: 'auth0|2'},
      {user_id: 'auth0|3'},
    ])

    expect(groups).to.have.length(1)
    expect(groups[0].email).to.equal('a@example.com')
  })

  it('returns no groups when each email appears only once', () => {
    expect(
      groupUsersByEmail([
        {email: 'solo@example.com', user_id: 'auth0|1'},
        {email: 'other@example.com', user_id: 'auth0|2'},
      ]),
    ).to.deep.equal([])
  })

  it('sorts duplicate groups by count then email', () => {
    const groups = groupUsersByEmail([
      {email: 'b@example.com', user_id: 'auth0|1'},
      {email: 'b@example.com', user_id: 'auth0|2'},
      {email: 'a@example.com', user_id: 'auth0|3'},
      {email: 'a@example.com', user_id: 'auth0|4'},
    ])

    expect(groups.map((group) => group.email)).to.deep.equal(['a@example.com', 'b@example.com'])
  })
})
