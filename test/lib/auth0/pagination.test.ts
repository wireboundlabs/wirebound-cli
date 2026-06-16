import {expect} from 'chai'

import {AUTH0_SEARCH_MAX_RESULTS, paginate} from '@/lib/auth0/pagination'

describe('paginate', () => {
  it('collects all items when no limit is set', async () => {
    const result = await paginate({
      fetchPage: async (page) => ({
        items: [`item-${page}`],
        page,
        perPage: 1,
        total: 3,
      }),
    })

    expect(result.items).to.deep.equal(['item-0', 'item-1', 'item-2'])
    expect(result.total).to.equal(3)
    expect(result.truncated).to.equal(false)
  })

  it('respects limit before fetching all pages', async () => {
    let pagesFetched = 0

    const result = await paginate({
      fetchPage: async (page) => {
        pagesFetched += 1
        return {
          items: [`item-${page}a`, `item-${page}b`],
          page,
          perPage: 2,
          total: 10,
        }
      },
      limit: 3,
    })

    expect(result.items).to.have.length(3)
    expect(pagesFetched).to.equal(2)
  })

  it('marks truncated when total exceeds Auth0 search cap', async () => {
    const result = await paginate({
      fetchPage: async (page, perPage) => ({
        items: Array.from({length: perPage}, (_, index) => `item-${page}-${index}`),
        page,
        perPage,
        total: AUTH0_SEARCH_MAX_RESULTS + 500,
      }),
      perPage: 100,
    })

    expect(result.items).to.have.length(1000)
    expect(result.truncated).to.equal(true)
  })
})
