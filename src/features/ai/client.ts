import type {
  GenerateSuggestionsRequest,
  GenerateSuggestionsResponse,
  InferContextRequest,
  InferContextResponse,
} from './types'

export async function generateSuggestions(input: GenerateSuggestionsRequest) {
  return postJson<GenerateSuggestionsResponse>('/api/generate', input)
}

export async function inferContext(input: InferContextRequest) {
  return postJson<InferContextResponse>('/api/context', input)
}

async function postJson<T extends object>(path: string, input: unknown) {
  let response: Response

  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error(
      `The local app could not reach ${path}. Start GitTidy with \`npm run dev:full\` or deploy it on Vercel to test OpenRouter generation.`,
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload: T | { error?: string; rawContent?: string } = contentType.includes(
    'application/json',
  )
    ? ((await response.json()) as T | { error?: string; rawContent?: string })
    : { error: 'The AI endpoint returned a non-JSON response.' }

  if (!response.ok) {
    const message = ('error' in payload && payload.error) || 'Generation failed.'
    const rawContent = 'rawContent' in payload ? (payload.rawContent as string | undefined) : undefined
    throw Object.assign(new Error(message), { rawContent })
  }

  return payload as T
}
