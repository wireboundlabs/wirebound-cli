export class HttpError extends Error {
  readonly status: number
  readonly headers: Headers
  readonly body: string

  constructor(status: number, headers: Headers, body: string, message?: string) {
    super(message ?? `HTTP ${status}: ${body}`)
    this.name = 'HttpError'
    this.status = status
    this.headers = headers
    this.body = body
  }
}

export async function assertOk(response: Response): Promise<Response> {
  if (response.ok) return response

  const body = await response.text()
  throw new HttpError(response.status, response.headers, body)
}
