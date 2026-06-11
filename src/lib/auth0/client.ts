import {type Auth0Config} from '../config/auth0.js'
import {assertOk, HttpError} from '../http-error.js'
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

export class Auth0Client {
  private token?: string

  constructor(
    private readonly config: Auth0Config,
    private readonly limiter: RateLimiter,
  ) {}

  private get baseUrl(): string {
    return `https://${this.config.domain}`
  }

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    return this.limiter.schedule(async () => {
      const authedInit = await this.withAuth(init ?? {})
      let response = await fetch(`${this.baseUrl}${path}`, authedInit)

      if (response.status === 401 && this.token) {
        this.token = undefined
        const retryInit = await this.withAuth(init ?? {})
        response = await fetch(`${this.baseUrl}${path}`, retryInit)
      }

      return assertOk(response)
    })
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
    const perPage = 100
    const query = 'identities.provider:"google-oauth2"'

    while (true) {
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
      const data = (await response.json()) as Auth0UsersSearchResponse
      totalRaw += data.users.length
      options.onPage?.({page, rawCount: data.users.length, total: data.total})

      for (const user of data.users) {
        if (isGoogleOnlyUser(user)) {
          eligible.push(user)
          if (options.limit !== undefined && eligible.length >= options.limit) {
            return {totalRaw, users: eligible}
          }
        }
      }

      const fetched = (page + 1) * perPage
      if (data.users.length === 0 || fetched >= data.total || fetched >= 1000) {
        break
      }

      page += 1
    }

    return {totalRaw, users: eligible}
  }

  async deleteUser(userId: string): Promise<void> {
    const encodedId = encodeURIComponent(userId)
    await this.fetch(
      `/api/v2/users/${encodedId}`,
      await this.withAuth({method: 'DELETE'}),
    )
  }

  static isForbidden(error: unknown): boolean {
    return error instanceof HttpError && error.status === 403
  }
}
