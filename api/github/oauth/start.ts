import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'

export default function handler(request: VercelRequest, response: VercelResponse) {
  const clientId = process.env.GITHUB_CLIENT_ID

  if (!clientId) {
    return response.status(500).send('GITHUB_CLIENT_ID is not configured.')
  }

  const redirectUri = `${getBaseUrl(request)}/api/github/oauth/callback`
  const state = randomUUID()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo',
    state,
  })

  response.setHeader(
    'Set-Cookie',
    `gittidy_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${isHttps(request) ? '; Secure' : ''}`,
  )
  response.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`)
}

function getBaseUrl(request: VercelRequest) {
  const proto = request.headers['x-forwarded-proto'] ?? 'https'
  const host = request.headers['x-forwarded-host'] ?? request.headers.host

  return `${proto}://${host}`
}

function isHttps(request: VercelRequest) {
  return (request.headers['x-forwarded-proto'] ?? 'https') === 'https'
}
