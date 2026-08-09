import type { VercelRequest } from '@vercel/node'
import { HttpError } from './http.js'

/**
 * Abuse guards for the AI endpoint.
 *
 * Without these, /api/generate is an open proxy: anyone who knows the URL can
 * spend the deployment's OpenRouter quota. Callers must present the same GitHub
 * token the browser already holds, which both ties spend to a real GitHub
 * account and gives the rate limiter a stable identity to key on.
 */

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 8
const MAX_BODY_BYTES = 200_000
const VIEWER_CACHE_TTL_MS = 5 * 60_000

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const viewerCache = new Map<string, { login: string; expiresAt: number }>()

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  for (const [key, entry] of viewerCache) {
    if (entry.expiresAt <= now) viewerCache.delete(key)
  }
}

export function assertWithinRateLimit(identity: string) {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(identity)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(identity, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000)
    throw new HttpError(
      `Too many generations in a row. Try again in ${seconds}s.`,
      429,
    )
  }

  bucket.count += 1
}

export function assertBodyWithinLimit(request: VercelRequest) {
  const declared = Number(request.headers['content-length'] ?? 0)

  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new HttpError('Request body is too large.', 413)
  }

  if (request.body !== undefined) {
    const serialized =
      typeof request.body === 'string' ? request.body : JSON.stringify(request.body)

    if (serialized && Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
      throw new HttpError('Request body is too large.', 413)
    }
  }
}

export function readBearerToken(request: VercelRequest): string {
  const header = request.headers['x-github-token']
  const token = Array.isArray(header) ? header[0] : header

  if (!token || typeof token !== 'string' || token.length < 8) {
    throw new HttpError('Sign in with GitHub before generating.', 401)
  }

  return token
}

/**
 * Confirms the token belongs to a real GitHub account and returns the login,
 * which becomes the rate-limit identity. Results are cached briefly so a normal
 * session does not spend a GitHub API call on every generation.
 */
export async function resolveGitHubIdentity(token: string): Promise<string> {
  const now = Date.now()
  const cached = viewerCache.get(token)

  if (cached && cached.expiresAt > now) {
    return cached.login
  }

  let response: Response
  try {
    response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new HttpError('Could not verify your GitHub session.', 503)
  }

  if (!response.ok) {
    throw new HttpError('Your GitHub session expired. Sign in again.', 401)
  }

  const payload = (await response.json()) as { login?: string; id?: number }
  const login = payload.login ?? (payload.id ? String(payload.id) : '')

  if (!login) {
    throw new HttpError('Your GitHub session expired. Sign in again.', 401)
  }

  viewerCache.set(token, { login, expiresAt: now + VIEWER_CACHE_TTL_MS })
  return login
}

/**
 * Blocks cross-site browser callers. Same-origin requests from the app send an
 * Origin matching the deployment host; requests with no Origin (curl, server to
 * server) still have to pass the GitHub token check above.
 */
export function assertSameOrigin(request: VercelRequest) {
  const origin = request.headers.origin

  if (!origin) return

  const host = request.headers['x-forwarded-host'] ?? request.headers.host
  if (!host) return

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw new HttpError('Request origin is not allowed.', 403)
  }

  if (originHost !== host) {
    throw new HttpError('Request origin is not allowed.', 403)
  }
}

export const limits = {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  MAX_BODY_BYTES,
}
