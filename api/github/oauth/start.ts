import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { readEnvValue } from '../../_lib/env.js'
import { isHttps, resolveBaseUrl, stateCookieName } from '../../_lib/oauth.js'

export default function handler(request: VercelRequest, response: VercelResponse) {
  const clientId = readEnvValue('GITHUB_CLIENT_ID')

  if (!clientId) {
    return response.status(500).send('GITHUB_CLIENT_ID is not configured.')
  }

  const secure = isHttps(request)
  const redirectUri = `${resolveBaseUrl(request)}/api/github/oauth/callback`
  const state = randomUUID()

  // `repo` covers private repositories. Deployments that only ever touch public
  // repos should set GITHUB_OAUTH_SCOPE=public_repo, which drops write access to
  // every private repo the user can see. See docs/SECURITY.md.
  const scope = readEnvValue('GITHUB_OAUTH_SCOPE') ?? 'repo'

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  })

  response.setHeader('Cache-Control', 'no-store')
  response.setHeader(
    'Set-Cookie',
    [
      `${stateCookieName(secure)}=${state}`,
      'HttpOnly',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=600',
      ...(secure ? ['Secure'] : []),
    ].join('; '),
  )
  response.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
  )
}
