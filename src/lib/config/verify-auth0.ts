import {type Auth0Config} from './auth0'

export async function verifyAuth0Credentials(config: Auth0Config): Promise<void> {
  const baseUrl = `https://${config.domain}`
  const response = await fetch(`${baseUrl}/oauth/token`, {
    body: JSON.stringify({
      audience: `${baseUrl}/api/v2/`,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'client_credentials',
    }),
    headers: {'Content-Type': 'application/json'},
    method: 'POST',
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Auth0 credential check failed (HTTP ${response.status}): ${body || response.statusText}`,
    )
  }
}
