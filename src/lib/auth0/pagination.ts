export const AUTH0_SEARCH_MAX_RESULTS = 1000

export interface PaginatedPage<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

export interface PaginateOptions<T> {
  perPage?: number
  limit?: number
  onPage?: (info: {page: number; total: number; rawCount: number}) => void
  fetchPage: (page: number, perPage: number) => Promise<PaginatedPage<T>>
}

export interface PaginateResult<T> {
  items: T[]
  total: number
  truncated: boolean
}

function isLastPage<T>(page: PaginatedPage<T>, pageIndex: number): boolean {
  if (page.items.length === 0) {
    return true
  }

  if (page.items.length < page.perPage) {
    return true
  }

  const fetched = (pageIndex + 1) * page.perPage
  return fetched >= page.total || fetched >= AUTH0_SEARCH_MAX_RESULTS
}

export async function paginate<T>(options: PaginateOptions<T>): Promise<PaginateResult<T>> {
  const perPage = options.perPage ?? 100
  const collected: T[] = []
  let total = 0
  let page = 0
  let truncated = false

  for (page = 0; ; page += 1) {
    const data = await options.fetchPage(page, perPage)
    total = data.total
    options.onPage?.({page, rawCount: data.items.length, total: data.total})

    const remaining =
      options.limit === undefined
        ? data.items.length
        : Math.max(0, options.limit - collected.length)
    collected.push(...data.items.slice(0, remaining))

    if (options.limit !== undefined && collected.length >= options.limit) {
      break
    }

    if (isLastPage(data, page)) {
      truncated = data.total > AUTH0_SEARCH_MAX_RESULTS
      break
    }
  }

  return {items: collected, total, truncated}
}
