import { describe, expect, it } from 'vitest'
import { readCookie, safeEqual, stateCookieName } from './oauth'

describe('safeEqual', () => {
  it('matches identical strings', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true)
  })

  it('rejects differing strings of the same length', () => {
    expect(safeEqual('abc123', 'abc124')).toBe(false)
  })

  it('rejects differing lengths', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })

  it('rejects an empty candidate against a real state', () => {
    expect(safeEqual('', 'realstate')).toBe(false)
  })

  it('is not fooled by a prefix', () => {
    expect(safeEqual('token', 'token-extra')).toBe(false)
  })
})

describe('readCookie', () => {
  it('reads a value from a multi-cookie header', () => {
    const header = 'foo=1; gittidy_oauth_state=abc-123; bar=2'
    expect(readCookie(header, 'gittidy_oauth_state')).toBe('abc-123')
  })

  it('returns undefined when the cookie is absent', () => {
    expect(readCookie('foo=1; bar=2', 'gittidy_oauth_state')).toBeUndefined()
  })

  it('returns undefined for an empty header', () => {
    expect(readCookie('', 'gittidy_oauth_state')).toBeUndefined()
  })

  it('does not match a cookie whose name merely ends with the target', () => {
    expect(readCookie('evil_gittidy_oauth_state=bad', 'gittidy_oauth_state')).toBeUndefined()
  })

  it('reads the __Host- prefixed name used over HTTPS', () => {
    const header = '__Host-gittidy_oauth_state=secure-value'
    expect(readCookie(header, '__Host-gittidy_oauth_state')).toBe('secure-value')
  })
})

describe('stateCookieName', () => {
  it('uses the __Host- prefix only when the request is secure', () => {
    expect(stateCookieName(true)).toBe('__Host-gittidy_oauth_state')
    expect(stateCookieName(false)).toBe('gittidy_oauth_state')
  })
})
