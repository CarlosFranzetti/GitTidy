import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decodeBase64Content,
  encodeBase64Content,
  resolveErrorMessage,
  selectContextPaths,
  updateRepositoryMetadata,
} from './client'

describe('base64 content round-trip', () => {
  it.each([
    'plain ascii',
    '# Heading\n\n- bullet\n',
    'emoji 🚀🎉 and accents éàü',
    '中文字符与日本語テキスト',
    'mixed 🚀 中文 café\n\ttabs',
    '',
  ])('round-trips %j without corruption', (input) => {
    expect(decodeBase64Content(encodeBase64Content(input))).toBe(input)
  })

  it('decodes base64 that GitHub wrapped across lines', () => {
    const encoded = encodeBase64Content('a'.repeat(200))
    const wrapped = encoded.replace(/(.{20})/g, '$1\n')
    expect(decodeBase64Content(wrapped)).toBe('a'.repeat(200))
  })

  it('handles content large enough to exceed the call-stack chunk size', () => {
    const large = '🚀'.repeat(50_000)
    expect(decodeBase64Content(encodeBase64Content(large))).toBe(large)
  })
})

describe('resolveErrorMessage', () => {
  it('maps known statuses to distinct guidance', () => {
    const statuses = [401, 403, 404, 409, 422, 500]
    const messages = statuses.map(resolveErrorMessage)
    expect(new Set(messages).size).toBe(statuses.length)
  })

  it('explains a 409 as a concurrent edit rather than a generic failure', () => {
    expect(resolveErrorMessage(409)).toMatch(/changed on GitHub/i)
  })
})

describe('selectContextPaths', () => {
  it('prioritises package.json, then docs, and caps the list at six', () => {
    const tree = [
      { type: 'blob', path: 'src/index.ts' },
      { type: 'blob', path: 'CONTRIBUTING.md' },
      { type: 'blob', path: 'docs/guide.md' },
      { type: 'blob', path: 'package.json' },
      { type: 'tree', path: 'src' },
      ...Array.from({ length: 10 }, (_, i) => ({ type: 'blob', path: `notes${i}.md` })),
    ]

    const picked = selectContextPaths(tree)
    expect(picked[0]).toBe('package.json')
    expect(picked[1]).toBe('docs/guide.md')
    expect(picked).toHaveLength(6)
    expect(picked).not.toContain('src/index.ts')
  })

  it('excludes the README, which is fetched separately', () => {
    const picked = selectContextPaths([
      { type: 'blob', path: 'README.md' },
      { type: 'blob', path: 'readme.rst' },
      { type: 'blob', path: 'GUIDE.md' },
    ])
    expect(picked).toEqual(['GUIDE.md'])
  })
})

describe('updateRepositoryMetadata', () => {
  const base = { owner: 'octo', repo: 'demo', token: 't0ken1234' }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('never sends a field the caller omitted', async () => {
    await updateRepositoryMetadata({ ...base, topics: ['a', 'b'] })

    const patched = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(patched).toHaveLength(0)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/topics')
    expect(JSON.parse(init.body)).toEqual({ names: ['a', 'b'] })
  })

  it('sends only description when only description is given', async () => {
    await updateRepositoryMetadata({ ...base, description: 'new text' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ description: 'new text' })
  })

  it('allows deliberately clearing a field with an empty string', async () => {
    await updateRepositoryMetadata({ ...base, homepage: '' })

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ homepage: '' })
  })

  it('makes no request at all when nothing is selected', async () => {
    await updateRepositoryMetadata(base)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces a typed error when GitHub rejects the write', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })

    await expect(
      updateRepositoryMetadata({ ...base, description: 'x' }),
    ).rejects.toThrow(/rate limited|permission/i)
  })
})
