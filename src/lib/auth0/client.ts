import {type Auth0Config} from '../config/auth0.js'
import {assertOk} from '../http-error.js'
import {RateLimiter} from '../rate-limiter.js'
import {isGoogleOnlyUser} from './filters.js'
import {paginate} from './pagination.js'
import {
  type Auth0Log,
  type Auth0LogsResponse,
  type Auth0TokenResponse,
  type Auth0User,
  type Auth0UsersSearchResponse,
  type Auth0UserUpdate,
} from './types.js'

export interface ListGoogleOnlyUsersOptions {
  limit?: number
  onPage?: (info: {page: number; total: number; rawCount: number}) => void
}

export interface SearchUsersOptions {
  limit?: number
  onPage?: (info: {page: number; total: number; rawCount: number}) => void
}

export interface SearchLogsOptions {
  limit?: number
  onPage?: (info: {page: number; total: number; rawCount: number}) => void
}

export class Auth0Client {
  private token?: string

  constructor(
    private readonly config: Auth0Config,
    private readonly limiter: RateLimiter,
  ) {}

  private get baseUrl(): string {
    return `https://${this.config.domain}`
  }

  private async fetchOnce(path: string, init: RequestInit): Promise<Response> {
    const authedInit = await this.withAuth(init)
    let response = await fetch(`${this.baseUrl}${path}`, authedInit)

    if (response.status === 401 && this.token) {
      this.token = undefined
      const retryInit = await this.withAuth(init)
      response = await fetch(`${this.baseUrl}${path}`, retryInit)
    }

    return assertOk(response)
  }

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    return this.limiter.schedule(() => this.fetchOnce(path, init ?? {}))
  }

  private async withAuth(init: RequestInit): Promise<RequestInit> {
    const token = await this.getToken()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('Content-Type', 'application/json')
    return {...init, headers}
  }

  async getToken(): Promise<string> {
    if (this.token) return this.token

    const body = {
      audience: `${this.baseUrl}/api/v2/`,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'client_credentials',
    }

    const response = await this.limiter.schedule(async () => {
      const res = await fetch(`${this.baseUrl}/oauth/token`, {
        body: JSON.stringify(body),
        headers: {'Content-Type': 'application/json'},
        method: 'POST',
      })
      return assertOk(res)
    })

    const data = (await response.json()) as Auth0TokenResponse
    this.token = data.access_token
    return this.token
  }

  async searchUsers(
    query: string,
    options: SearchUsersOptions = {},
  ): Promise<{users: Auth0User[]; total: number; truncated: boolean}> {
    const result = await paginate<Auth0User>({
      fetchPage: async (page, perPage) => {
        const data = await this.fetchUserSearchPage(query, page, perPage)
        return {items: data.users, page, perPage, total: data.total}
      },
      limit: options.limit,
      onPage: options.onPage,
    })

    return {total: result.total, truncated: result.truncated, users: result.items}
  }

  async listGoogleOnlyUsers(
    options: ListGoogleOnlyUsersOptions = {},
  ): Promise<{users: Auth0User[]; totalRaw: number; truncated: boolean}> {
    const eligible: Auth0User[] = []
    let totalRaw = 0
    let page = 0
    let truncated = false
    const perPage = 100

    do {
      const data = await this.fetchUserSearchPage(
        'identities.provider:"google-oauth2"',
        page,
        perPage,
      )
      totalRaw += data.users.length
      options.onPage?.({page, rawCount: data.users.length, total: data.total})

      for (const user of data.users) {
        if (!isGoogleOnlyUser(user)) continue
        if (options.limit !== undefined && eligible.length >= options.limit) break
        eligible.push(user)
      }

      const hitLimit = options.limit !== undefined && eligible.length >= options.limit
      const lastPage =
        data.users.length === 0 ||
        (page + 1) * perPage >= data.total ||
        (page + 1) * perPage >= 1000

      if (lastPage) {
        truncated = data.total > 1000
      }

      if (hitLimit || lastPage) break
      page += 1
    } while (page < Number.MAX_SAFE_INTEGER)

    return {totalRaw, truncated, users: eligible}
  }

  async getUserById(userId: string): Promise<Auth0User> {
    const encodedId = encodeURIComponent(userId)
    const response = await this.fetch(
      `/api/v2/users/${encodedId}`,
      await this.withAuth({method: 'GET'}),
    )

    return (await response.json()) as Auth0User
  }

  async getUsersByEmail(email: string): Promise<Auth0User[]> {
    const params = new URLSearchParams({email})
    const response = await this.fetch(
      `/api/v2/users-by-email?${params.toString()}`,
      await this.withAuth({method: 'GET'}),
    )

    return (await response.json()) as Auth0User[]
  }

  async updateUser(userId: string, patch: Auth0UserUpdate): Promise<Auth0User> {
    const encodedId = encodeURIComponent(userId)
    const response = await this.fetch(
      `/api/v2/users/${encodedId}`,
      await this.withAuth({body: JSON.stringify(patch), method: 'PATCH'}),
    )

    return (await response.json()) as Auth0User
  }

  async searchLogs(
    query: string,
    options: SearchLogsOptions = {},
  ): Promise<{logs: Auth0Log[]; truncated: boolean}> {
    const logs: Auth0Log[] = []
    let page = 0
    const perPage = 50
    let truncated = false

    while (true) {
      const batch = await this.fetchLogsPage(query, page, perPage)
      options.onPage?.({page, rawCount: batch.length, total: batch.length})

      const remaining =
        options.limit === undefined
          ? batch.length
          : Math.max(0, options.limit - logs.length)
      logs.push(...batch.slice(0, remaining))

      if (options.limit !== undefined && logs.length >= options.limit) {
        truncated = batch.length === perPage
        break
      }

      if (batch.length < perPage) break
      page += 1
    }

    return {logs, truncated}
  }

  async deleteUser(userId: string): Promise<void> {
    const encodedId = encodeURIComponent(userId)
    await this.fetch(
      `/api/v2/users/${encodedId}`,
      await this.withAuth({method: 'DELETE'}),
    )
  }

  private async fetchUserSearchPage(
    query: string,
    page: number,
    perPage: number,
  ): Promise<Auth0UsersSearchResponse> {
    const params = new URLSearchParams({
      include_totals: 'true',
      page: String(page),
      per_page: String(perPage),
      q: query,
      search_engine: 'v3',
    })

    const response = await this.fetch(
      `/api/v2/users?${params.toString()}`,
      await this.withAuth({method: 'GET'}),
    )

    return (await response.json()) as Auth0UsersSearchResponse
  }

  private async fetchLogsPage(
    query: string,
    page: number,
    perPage: number,
  ): Promise<Auth0LogsResponse> {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      sort: 'date:-1',
    })

    if (query) {
      params.set('q', query)
    }

    const response = await this.fetch(
      `/api/v2/logs?${params.toString()}`,
      await this.withAuth({method: 'GET'}),
    )

    return (await response.json()) as Auth0LogsResponse
  }
}
