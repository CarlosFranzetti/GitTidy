import type { VercelRequest } from '@vercel/node'

function header(request: VercelRequest, name: string): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

export function isHttps(request: VercelRequest): boolean {
  return (header(request, 'x-forwarded-proto') ?? 'https') === 'https'
}

export function resolveBaseUrl(request: VercelRequest): string {
  const proto = header(request, 'x-forwarded-proto') ?? 'https'
  const host = header(request, 'x-forwarded-host') ?? header(request, 'host') ?? ''

  return `${proto}://${host}`
}

/**
 * The __Host- prefix pins the cookie to this exact origin with Path=/ and
 * Secure, which browsers enforce. It cannot be used over plain http, so local
 * development falls back to the unprefixed name.
 */
export function stateCookieName(secure: boolean): string {
  return secure ? '__Host-gittidy_oauth_state' : 'gittidy_oauth_state'
}

export function readCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

/**
 * Constant-time comparison so a mismatched OAuth state cannot be recovered by
 * timing the response.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
