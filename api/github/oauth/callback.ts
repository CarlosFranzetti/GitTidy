import type { VercelRequest, VercelResponse } from '@vercel/node'

type GitHubTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const code = stringParam(request.query.code)
  const state = stringParam(request.query.state)
  const expectedState = readCookie(request.headers.cookie ?? '', 'gittidy_oauth_state')
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return redirectHome(request, response, 'GitHub OAuth is not configured.')
  }

  if (!code || !state || state !== expectedState) {
    return redirectHome(request, response, 'GitHub OAuth state did not match.')
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${getBaseUrl(request)}/api/github/oauth/callback`,
    }),
  })
  const payload = (await tokenResponse.json()) as GitHubTokenResponse

  if (!tokenResponse.ok || !payload.access_token) {
    return redirectHome(
      request,
      response,
      payload.error_description ?? payload.error ?? 'GitHub OAuth failed.',
    )
  }

  response.setHeader(
    'Set-Cookie',
    `gittidy_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isHttps(request) ? '; Secure' : ''}`,
  )
  response.redirect(`/?github_token=${encodeURIComponent(payload.access_token)}`)
}

function redirectHome(
  request: VercelRequest,
  response: VercelResponse,
  message: string,
) {
  response.redirect(`/?error=${encodeURIComponent(message)}`)
}

function getBaseUrl(request: VercelRequest) {
  const proto = request.headers['x-forwarded-proto'] ?? 'https'
  const host = request.headers['x-forwarded-host'] ?? request.headers.host

  return `${proto}://${host}`
}

function isHttps(request: VercelRequest) {
  return (request.headers['x-forwarded-proto'] ?? 'https') === 'https'
}

function readCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
