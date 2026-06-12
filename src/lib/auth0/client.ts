import {type Auth0Config} from '../config/auth0.js'
import {assertOk} from '../http-error.js'
import {RateLimiter} from '../rate-limiter.js'
import {isGoogleOnlyUser} from './filters.js'
import {
  type Auth0TokenResponse,
  type Auth0User,
  type Auth0UsersSearchResponse,
} from './types.js'

export interface ListGoogleOnlyUsersOptions {
  limit?: number
  onPage?: (info: {page: number; total: number; rawCount: number}) => void
}

function addEligibleUsers(
  users: Auth0User[],
  eligible: Auth0User[],
  limit?: number,
): boolean {
  const remaining =
    limit === undefined ? users.length : Math.max(0, limit - eligible.length)
  const toAdd = users.filter(isGoogleOnlyUser).slice(0, remaining)
  eligible.push(...toAdd)

  return limit !== undefined && eligible.length >= limit
}

function isLastUserPage(
  data: Auth0UsersSearchResponse,
  page: number,
  perPage: number,
): boolean {
  if (data.users.length === 0) {
    return true
  }

  const fetched = (page + 1) * perPage
  return fetched >= data.total || fetched >= 1000
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

  async listGoogleOnlyUsers(
    options: ListGoogleOnlyUsersOptions = {},
  ): Promise<{users: Auth0User[]; totalRaw: number}> {
    const eligible: Auth0User[] = []
    let totalRaw = 0
    let page = 0
    let done = false
    const perPage = 100

    do {
      const data = await this.fetchUserSearchPage(page, perPage)
      totalRaw += data.users.length
      options.onPage?.({page, rawCount: data.users.length, total: data.total})
      done =
        addEligibleUsers(data.users, eligible, options.limit) ||
        isLastUserPage(data, page, perPage)
      page += 1
    } while (!done)

    return {totalRaw, users: eligible}
  }

  private async fetchUserSearchPage(
    page: number,
    perPage: number,
  ): Promise<Auth0UsersSearchResponse> {
    const params = new URLSearchParams({
      include_totals: 'true',
      page: String(page),
      per_page: String(perPage),
      q: 'identities.provider:"google-oauth2"',
      search_engine: 'v3',
    })

    const response = await this.fetch(
      `/api/v2/users?${params.toString()}`,
      await this.withAuth({method: 'GET'}),
    )

    return (await response.json()) as Auth0UsersSearchResponse
  }

  async deleteUser(userId: string): Promise<void> {
    const encodedId = encodeURIComponent(userId)
    await this.fetch(
      `/api/v2/users/${encodedId}`,
      await this.withAuth({method: 'DELETE'}),
    )
  }
}
