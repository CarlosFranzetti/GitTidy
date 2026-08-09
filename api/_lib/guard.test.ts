import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest } from '@vercel/node'
import {
  assertBodyWithinLimit,
  assertSameOrigin,
  assertWithinRateLimit,
  limits,
  readBearerToken,
  resolveGitHubIdentity,
} from './guard.js'
import { HttpError } from './http.js'

function request(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return { headers: {}, query: {}, ...overrides } as VercelRequest
}

describe('assertWithinRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('allows requests up to the limit then blocks', () => {
    const id = `user-${Math.random()}`

    for (let i = 0; i < limits.RATE_LIMIT_MAX_REQUESTS; i += 1) {
      expect(() => assertWithinRateLimit(id)).not.toThrow()
    }

    expect(() => assertWithinRateLimit(id)).toThrow(/Too many generations/)
  })

  it('reports a 429 status', () => {
    const id = `user-${Math.random()}`
    for (let i = 0; i < limits.RATE_LIMIT_MAX_REQUESTS; i += 1) assertWithinRateLimit(id)

    try {
      assertWithinRateLimit(id)
    } catch (error) {
      expect((error as HttpError).status).toBe(429)
    }
  })

  it('lets the window expire', () => {
    const id = `user-${Math.random()}`
    for (let i = 0; i < limits.RATE_LIMIT_MAX_REQUESTS; i += 1) assertWithinRateLimit(id)

    vi.advanceTimersByTime(limits.RATE_LIMIT_WINDOW_MS + 1000)
    expect(() => assertWithinRateLimit(id)).not.toThrow()
  })

  it('keeps separate budgets per identity', () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    for (let i = 0; i < limits.RATE_LIMIT_MAX_REQUESTS; i += 1) assertWithinRateLimit(a)

    expect(() => assertWithinRateLimit(b)).not.toThrow()
  })
})

describe('assertBodyWithinLimit', () => {
  it('accepts a normal payload', () => {
    expect(() =>
      assertBodyWithinLimit(request({ body: { repos: [{ name: 'x' }] } })),
    ).not.toThrow()
  })

  it('rejects an oversized declared content-length', () => {
    expect(() =>
      assertBodyWithinLimit(
        request({ headers: { 'content-length': String(limits.MAX_BODY_BYTES + 1) } }),
      ),
    ).toThrow(/too large/i)
  })

  it('rejects an oversized parsed body even when the header lies', () => {
    const body = { repos: [{ existingReadme: 'x'.repeat(limits.MAX_BODY_BYTES + 10) }] }
    expect(() =>
      assertBodyWithinLimit(request({ headers: { 'content-length': '10' }, body })),
    ).toThrow(/too large/i)
  })

  it('counts bytes not characters for multibyte payloads', () => {
    // Each emoji is 4 UTF-8 bytes, so this is over the cap by bytes but not by length.
    const body = { readme: '🚀'.repeat(limits.MAX_BODY_BYTES / 3) }
    expect(() => assertBodyWithinLimit(request({ body }))).toThrow(/too large/i)
  })
})

describe('readBearerToken', () => {
  it('reads the token header', () => {
    expect(readBearerToken(request({ headers: { 'x-github-token': 'gho_abcdefgh' } }))).toBe(
      'gho_abcdefgh',
    )
  })

  it('rejects a missing token', () => {
    expect(() => readBearerToken(request())).toThrow(/Sign in with GitHub/)
  })

  it('rejects an implausibly short token', () => {
    expect(() => readBearerToken(request({ headers: { 'x-github-token': 'abc' } }))).toThrow(
      /Sign in with GitHub/,
    )
  })

  it('reports 401 so the client can prompt a re-auth', () => {
    try {
      readBearerToken(request())
    } catch (error) {
      expect((error as HttpError).status).toBe(401)
    }
  })
})

describe('assertSameOrigin', () => {
  it('allows a matching origin', () => {
    expect(() =>
      assertSameOrigin(
        request({ headers: { origin: 'https://git-tidy.vercel.app', host: 'git-tidy.vercel.app' } }),
      ),
    ).not.toThrow()
  })

  it('blocks a cross-site origin', () => {
    expect(() =>
      assertSameOrigin(
        request({ headers: { origin: 'https://evil.example', host: 'git-tidy.vercel.app' } }),
      ),
    ).toThrow(/origin is not allowed/i)
  })

  it('blocks a malformed origin', () => {
    expect(() =>
      assertSameOrigin(request({ headers: { origin: 'not a url', host: 'git-tidy.vercel.app' } })),
    ).toThrow(/origin is not allowed/i)
  })

  it('permits a request with no Origin, which the token check still gates', () => {
    expect(() => assertSameOrigin(request({ headers: { host: 'git-tidy.vercel.app' } }))).not.toThrow()
  })

  it('prefers x-forwarded-host behind the Vercel proxy', () => {
    expect(() =>
      assertSameOrigin(
        request({
          headers: {
            origin: 'https://git-tidy.vercel.app',
            host: 'internal.vercel.internal',
            'x-forwarded-host': 'git-tidy.vercel.app',
          },
        }),
      ),
    ).not.toThrow()
  })
})

describe('resolveGitHubIdentity', () => {
  it('rejects a token GitHub does not recognise', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    await expect(resolveGitHubIdentity(`bad-${Math.random()}`)).rejects.toThrow(
      /session expired/i,
    )
  })

  it('returns the login for a valid token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ login: 'octocat' }) }),
    )

    await expect(resolveGitHubIdentity(`good-${Math.random()}`)).resolves.toBe('octocat')
  })

  it('caches a verified token instead of re-querying GitHub', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ login: 'octocat' }) })
    vi.stubGlobal('fetch', fetchMock)

    const token = `cached-${Math.random()}`
    await resolveGitHubIdentity(token)
    await resolveGitHubIdentity(token)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces a 503 when GitHub is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    try {
      await resolveGitHubIdentity(`down-${Math.random()}`)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as HttpError).status).toBe(503)
    }
  })
})
