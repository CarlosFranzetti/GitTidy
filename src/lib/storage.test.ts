import { describe, expect, it, vi } from 'vitest'
import { readStored, removeStored, writeStored } from './storage'
import { resolveTheme } from './theme'
import { resolveFont } from './fonts'

describe('storage', () => {
  it('round-trips a value', () => {
    expect(writeStored('k', 'v')).toBe(true)
    expect(readStored('k')).toBe('v')
    expect(removeStored('k')).toBe(true)
    expect(readStored('k')).toBeNull()
  })

  it('returns null for a missing key', () => {
    expect(readStored('never-set')).toBeNull()
  })

  it('reports failure instead of throwing when setItem is blocked', () => {
    // Safari private mode and quota exhaustion both throw here.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    expect(() => writeStored('k', 'v')).not.toThrow()
    expect(writeStored('k', 'v')).toBe(false)
  })

  it('returns null instead of throwing when getItem is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    expect(() => readStored('k')).not.toThrow()
    expect(readStored('k')).toBeNull()
  })

  it('does not throw when removeItem is blocked', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    expect(removeStored('k')).toBe(false)
  })
})

describe('preference resolvers', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', 'system'],
  ])('honours a stored theme of %j', (input, expected) => {
    expect(resolveTheme(input)).toBe(expected)
  })

  // GitTidy opens dark. Only an explicit "system" choice follows the OS.
  it.each([['nonsense'], [null]])(
    'falls back to dark for %j',
    (input) => {
      expect(resolveTheme(input as string | null)).toBe('dark')
    },
  )

  it.each([
    ['inter', 'inter'],
    ['outfit', 'outfit'],
    ['system', 'system'],
    ['comic-sans', 'inter'],
    [null, 'inter'],
  ])('resolves font %j to %s', (input, expected) => {
    expect(resolveFont(input)).toBe(expected)
  })
})
