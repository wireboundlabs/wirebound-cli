import {expect} from 'chai'

import {AUTH0_SEARCH_MAX_RESULTS} from '@/lib/auth0/pagination'
import {computeFetchProgressTotal} from '@/lib/progress'

describe('computeFetchProgressTotal', () => {
  it('caps totals at the Auth0 search limit', () => {
    expect(
      computeFetchProgressTotal(
        {collected: 500, page: 0, rawCount: 100, total: 5000},
        undefined,
      ),
    ).to.deep.equal({
      total: AUTH0_SEARCH_MAX_RESULTS,
      value: 500,
    })
  })

  it('respects an explicit fetch limit', () => {
    expect(
      computeFetchProgressTotal(
        {collected: 40, page: 0, rawCount: 20, total: 200},
        50,
      ),
    ).to.deep.equal({total: 50, value: 40})
  })

  it('never reports zero total or value above total', () => {
    expect(
      computeFetchProgressTotal({collected: 0, page: 0, rawCount: 0, total: 0}, undefined),
    ).to.deep.equal({total: 1, value: 0})

    expect(
      computeFetchProgressTotal({collected: 999, page: 0, rawCount: 100, total: 10}, 5),
    ).to.deep.equal({total: 5, value: 5})
  })

  it('uses the smaller of fetch limit and Auth0 cap', () => {
    expect(
      computeFetchProgressTotal(
        {collected: 100, page: 0, rawCount: 100, total: AUTH0_SEARCH_MAX_RESULTS + 100},
        AUTH0_SEARCH_MAX_RESULTS + 500,
      ),
    ).to.deep.equal({
      total: AUTH0_SEARCH_MAX_RESULTS,
      value: 100,
    })
  })
})
