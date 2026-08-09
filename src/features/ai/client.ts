import type {
  GenerateSuggestionsRequest,
  GenerateSuggestionsResponse,
} from './types'

export class AiClientError extends Error {
  /** Raw model output, present only when the response could not be parsed. */
  rawContent?: string
  status: number

  constructor(message: string, status: number, rawContent?: string) {
    super(message)
    this.name = 'AiClientError'
    this.status = status
    this.rawContent = rawContent
  }
}

export async function generateSuggestions(
  input: GenerateSuggestionsRequest,
  options: { signal?: AbortSignal; token?: string } = {},
) {
  return postJson<GenerateSuggestionsResponse>('/api/generate', input, options)
}

async function postJson<T extends object>(
  path: string,
  input: unknown,
  options: { signal?: AbortSignal; token?: string },
): Promise<T> {
  let response: Response

  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { 'X-GitHub-Token': options.token } : {}),
      },
      body: JSON.stringify(input),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new AiClientError(
      `Could not reach ${path}. Run GitTidy with \`npm run dev:full\` or deploy it to Vercel to use AI generation.`,
      0,
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : { error: 'The AI endpoint returned a non-JSON response.' }

  if (!response.ok) {
    const record = (payload ?? {}) as { error?: string; rawContent?: string }
    throw new AiClientError(
      record.error || 'Generation failed.',
      response.status,
      record.rawContent,
    )
  }

  return payload as T
}
