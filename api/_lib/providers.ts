import { readEnvValue } from './env'
import { HttpError, previewText } from './http'

export type GenerationMode = 'full' | 'metadata'

export type CompletionRequest = {
  systemPrompt: string
  userPrompt: string
  mode: GenerationMode
}

export type CompletionResult = {
  /** Raw model text, still to be parsed by parseModelJson. */
  content: string
  /** Reported back to the UI so the user can see who wrote the draft. */
  model: string
}

export type Provider = {
  id: string
  models: string[]
  call: (model: string, request: CompletionRequest) => Promise<CompletionResult>
}

const REQUEST_TIMEOUT_MS = 45_000

/**
 * The JSON contract every provider is asked to satisfy.
 *
 * Gemini enforces this structurally, so the model physically cannot answer with
 * prose. OpenRouter free models are only asked politely, which is why
 * parseModelJson still has to be forgiving.
 */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    readme_md: { type: 'STRING' },
    description: { type: 'STRING' },
    topics: { type: 'ARRAY', items: { type: 'STRING' } },
    deploy_suggestion: { type: 'STRING' },
  },
  required: ['readme_md', 'description', 'topics', 'deploy_suggestion'],
} as const

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

async function withTimeout<T>(
  label: string,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await run(controller.signal)
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(`${label} did not respond within 45 seconds.`, 504)
    }
    throw new HttpError(`Could not reach ${label}.`, 503)
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------- Gemini -------------------------------- */

const GEMINI_DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']

function geminiProvider(apiKey: string): Provider {
  const configured = splitList(readEnvValue('GEMINI_MODEL'))
  const fallbacks = splitList(readEnvValue('GEMINI_FALLBACK_MODELS'))
  const models = [...new Set([...configured, ...fallbacks])]

  return {
    id: 'gemini',
    models: models.length > 0 ? models : GEMINI_DEFAULT_MODELS,
    async call(model, { systemPrompt, userPrompt }) {
      return withTimeout(`Gemini (${model})`, async (signal) => {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseSchema: RESPONSE_SCHEMA,
              },
            }),
            signal,
          },
        )

        const raw = await response.text()

        if (!response.ok) {
          throw new HttpError(
            `Gemini rejected ${model} (${response.status}): ${previewText(raw)}`,
            response.status,
          )
        }

        let payload: {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> }
            finishReason?: string
          }>
        }
        try {
          payload = JSON.parse(raw)
        } catch {
          throw new HttpError('Gemini returned a non-JSON API response.', 502)
        }

        const candidate = payload.candidates?.[0]
        const content = candidate?.content?.parts
          ?.map((part) => part.text ?? '')
          .join('')

        if (!content?.trim()) {
          // A safety block or token ceiling shows up here as an empty candidate.
          const reason = candidate?.finishReason
          throw new HttpError(
            reason && reason !== 'STOP'
              ? `Gemini stopped early (${reason}).`
              : `Gemini (${model}) returned an empty response.`,
            502,
          )
        }

        return { content, model: `gemini/${model}` }
      })
    },
  }
}

/* ----------------------------- OpenRouter ------------------------------ */

const OPENROUTER_DEFAULT_MODEL = 'baidu/cobuddy:free'

function openRouterProvider(apiKey: string): Provider {
  const primary = readEnvValue('OPENROUTER_MODEL') ?? OPENROUTER_DEFAULT_MODEL
  const fallbacks = splitList(readEnvValue('OPENROUTER_FALLBACK_MODELS'))

  return {
    id: 'openrouter',
    models: [...new Set([primary, ...fallbacks])],
    async call(model, { systemPrompt, userPrompt }) {
      return withTimeout(`OpenRouter (${model})`, async (signal) => {
        const response = await fetch(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer':
                readEnvValue('PUBLIC_APP_URL') ?? 'https://git-tidy.vercel.app',
              'X-Title': 'GitTidy',
            },
            body: JSON.stringify({
              model,
              temperature: 0.2,
              // Honoured by models that support it, ignored by those that do not.
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }),
            signal,
          },
        )

        const raw = await response.text()

        if (!response.ok) {
          throw new HttpError(
            `OpenRouter rejected ${model} (${response.status}): ${previewText(raw)}`,
            response.status,
          )
        }

        let payload: { choices?: Array<{ message?: { content?: string } }> }
        try {
          payload = JSON.parse(raw)
        } catch {
          throw new HttpError('OpenRouter returned a non-JSON API response.', 502)
        }

        const content = payload.choices?.[0]?.message?.content

        if (!content?.trim()) {
          throw new HttpError(`${model} returned an empty response.`, 502)
        }

        return { content, model }
      })
    },
  }
}

/**
 * Providers are tried in order. Gemini goes first when a key is present: its
 * free tier is far more generous than OpenRouter's shared free pool, and its
 * schema enforcement removes the "model replied with prose" failure entirely.
 * OpenRouter stays as the fallback, so removing GEMINI_API_KEY restores the
 * previous behaviour exactly.
 */
export function resolveProviders(): Provider[] {
  const providers: Provider[] = []

  const geminiKey = readEnvValue('GEMINI_API_KEY')
  if (geminiKey) providers.push(geminiProvider(geminiKey))

  const openRouterKey = readEnvValue('OPENROUTER_API_KEY')
  if (openRouterKey) providers.push(openRouterProvider(openRouterKey))

  if (providers.length === 0) {
    throw new HttpError(
      'No AI provider is configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY.',
      500,
    )
  }

  return providers
}
