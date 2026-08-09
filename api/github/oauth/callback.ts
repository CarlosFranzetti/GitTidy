import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readEnvValue } from '../../_lib/env'
import {
  isHttps,
  readCookie,
  resolveBaseUrl,
  safeEqual,
  stateCookieName,
} from '../../_lib/oauth'

type GitHubTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Cache-Control', 'no-store')

  const secure = isHttps(request)
  const cookieName = stateCookieName(secure)
  const code = stringParam(request.query.code)
  const state = stringParam(request.query.state)
  const expectedState = readCookie(request.headers.cookie ?? '', cookieName)
  const clientId = readEnvValue('GITHUB_CLIENT_ID')
  const clientSecret = readEnvValue('GITHUB_CLIENT_SECRET')

  clearStateCookie(response, cookieName, secure)

  if (!clientId || !clientSecret) {
    return redirectHome(response, 'GitHub OAuth is not configured.')
  }

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return redirectHome(response, 'GitHub sign-in expired. Please try again.')
  }

  let payload: GitHubTokenResponse
  try {
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${resolveBaseUrl(request)}/api/github/oauth/callback`,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    )
    payload = (await tokenResponse.json()) as GitHubTokenResponse

    if (!tokenResponse.ok || !payload.access_token) {
      return redirectHome(
        response,
        payload.error_description ?? payload.error ?? 'GitHub sign-in failed.',
      )
    }
  } catch {
    return redirectHome(response, 'Could not reach GitHub. Please try again.')
  }

  // The token goes in the URL fragment, not the query string. Fragments are
  // never sent to a server, so the token stays out of access logs, out of the
  // Referer header, and out of any analytics pageview.
  return response.redirect(
    `/#github_token=${encodeURIComponent(payload.access_token)}`,
  )
}

function clearStateCookie(
  response: VercelResponse,
  cookieName: string,
  secure: boolean,
) {
  response.setHeader(
    'Set-Cookie',
    [
      `${cookieName}=`,
      'HttpOnly',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=0',
      ...(secure ? ['Secure'] : []),
    ].join('; '),
  )
}

function redirectHome(response: VercelResponse, message: string) {
  return response.redirect(`/#error=${encodeURIComponent(message)}`)
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
