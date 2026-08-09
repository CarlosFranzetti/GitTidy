import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveProviders } from './providers.js'
import { HttpError } from './http.js'

const ENV_KEYS = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_FALLBACK_MODELS',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'OPENROUTER_FALLBACK_MODELS',
]

let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
})

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

const request = {
  systemPrompt: 'system',
  userPrompt: 'user',
  mode: 'full' as const,
}

describe('resolveProviders', () => {
  it('puts Gemini first when both keys are present', () => {
    process.env.GEMINI_API_KEY = 'g-key'
    process.env.OPENROUTER_API_KEY = 'or-key'

    expect(resolveProviders().map((provider) => provider.id)).toEqual([
      'gemini',
      'openrouter',
    ])
  })

  it('falls back to OpenRouter alone when Gemini is not configured', () => {
    process.env.OPENROUTER_API_KEY = 'or-key'

    expect(resolveProviders().map((provider) => provider.id)).toEqual(['openrouter'])
  })

  it('works with only Gemini configured', () => {
    process.env.GEMINI_API_KEY = 'g-key'

    expect(resolveProviders().map((provider) => provider.id)).toEqual(['gemini'])
  })

  it('explains itself when no provider key exists at all', () => {
    expect(() => resolveProviders()).toThrow(/GEMINI_API_KEY or OPENROUTER_API_KEY/)
  })

  it('uses configured Gemini models ahead of the defaults', () => {
    process.env.GEMINI_API_KEY = 'g-key'
    process.env.GEMINI_MODEL = 'gemini-custom'
    process.env.GEMINI_FALLBACK_MODELS = 'gemini-backup, gemini-custom'

    // Duplicates collapse, order is preserved.
    expect(resolveProviders()[0].models).toEqual(['gemini-custom', 'gemini-backup'])
  })

  it('ships a default Gemini model list when none is configured', () => {
    process.env.GEMINI_API_KEY = 'g-key'
    expect(resolveProviders()[0].models.length).toBeGreaterThan(0)
  })
})

describe('gemini provider', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'g-key'
  })

  function gemini() {
    return resolveProviders()[0]
  }

  it('requests schema-enforced JSON and returns the candidate text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"readme_md":"hi"}' }] } }],
        }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await gemini().call('gemini-2.5-flash', request)

    expect(result.content).toBe('{"readme_md":"hi"}')
    expect(result.model).toBe('gemini/gemini-2.5-flash')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('gemini-2.5-flash:generateContent')
    expect(init.headers['x-goog-api-key']).toBe('g-key')

    const body = JSON.parse(init.body)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema.required).toContain('readme_md')
  })

  it('joins multi-part responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"a":' }, { text: '1}' }] } }],
          }),
      }),
    )

    expect((await gemini().call('m', request)).content).toBe('{"a":1}')
  })

  it('surfaces the upstream status so a 429 stays retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'quota' }),
    )

    await expect(gemini().call('m', request)).rejects.toMatchObject({ status: 429 })
  })

  it('reports a safety block rather than an empty response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({ candidates: [{ finishReason: 'SAFETY', content: {} }] }),
      }),
    )

    await expect(gemini().call('m', request)).rejects.toThrow(/stopped early \(SAFETY\)/)
  })

  it('turns a network failure into a 503, not a false timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    await expect(gemini().call('m', request)).rejects.toMatchObject({ status: 503 })
  })

  it('reports an abort as a timeout', async () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))

    await expect(gemini().call('m', request)).rejects.toMatchObject({ status: 504 })
  })

  it('rejects a non-JSON API envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => '<html>oops</html>' }),
    )

    await expect(gemini().call('m', request)).rejects.toBeInstanceOf(HttpError)
  })
})

describe('openrouter provider', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'or-key'
  })

  it('sends the chat-completions shape and returns the message content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({ choices: [{ message: { content: '{"readme_md":"x"}' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolveProviders()[0].call('some/model:free', request)

    expect(result.content).toBe('{"readme_md":"x"}')
    expect(result.model).toBe('some/model:free')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[0].role).toBe('system')
  })

  it('rejects an empty completion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ choices: [{ message: { content: '  ' } }] }),
      }),
    )

    await expect(resolveProviders()[0].call('m', request)).rejects.toThrow(/empty/)
  })
})
