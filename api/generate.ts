import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type GenerateBody = {
  repos: Array<{
    name: string
    fullName: string
    language: string
    description: string
    homepage: string
    topics: string[]
    readmeWordCount: number
    readmeExcerpt: string
    issues: string[]
  }>
  context: {
    projectGoal: string
    audience: string
    deployTarget: string
    tone: string
    extraNotes: string
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Content-Type', 'application/json')

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const apiKey = readEnvValue('OPENROUTER_API_KEY')

  if (!apiKey) {
    return response
      .status(500)
      .json({ error: 'OPENROUTER_API_KEY is not configured.' })
  }

  try {
    const body = request.body as GenerateBody
    const payload = await createOpenRouterCompletion(apiKey, body)

    return response.status(200).json(payload)
  } catch (error: unknown) {
    return response.status(resolveStatus(error)).json({
      error:
        error instanceof Error
          ? error.message
          : 'AI preview generation failed.',
    })
  }
}

async function createOpenRouterCompletion(apiKey: string, body: GenerateBody) {
  const systemPrompt = [
    'You are GitTidy, an AI assistant that improves GitHub repository presentation for students and indie developers.',
    'Return valid JSON only.',
    'Be practical and specific.',
    'Do not invent unsupported features.',
    'Topics must be 3 to 5 lowercase hyphenated strings.',
    'Deploy suggestions must be short actionable strings.',
    'Generate previewable repository changes only. Do not claim anything was committed.',
    'Return this exact JSON shape: {"previews":[{"repoName":"string","suggestedDescription":"string","suggestedReadme":"string","suggestedTopics":["string"],"deploySuggestions":["string"],"commitSummary":"string"}]}',
  ].join(' ')
  const userPrompt = [
    `Project goal: ${body.context.projectGoal || 'Not provided'}`,
    `Audience: ${body.context.audience || 'Not provided'}`,
    `Deploy target: ${body.context.deployTarget || 'Not provided'}`,
    `Tone: ${body.context.tone || 'clear and practical'}`,
    `Extra notes: ${body.context.extraNotes || 'None'}`,
    'Repositories:',
    JSON.stringify(body.repos, null, 2),
    'For each repository, preview a tighter GitHub description, improved README markdown, suggested topics, deploy suggestions, and a concise commit summary.',
  ].join('\n')

  const openRouterResponse = await callOpenRouter(apiKey, {
    model: readEnvValue('OPENROUTER_MODEL') ?? 'baidu/cobuddy:free',
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const rawBody = await openRouterResponse.text()

  if (!openRouterResponse.ok) {
    throw statusError(
      `OpenRouter request failed (${openRouterResponse.status}): ${previewText(rawBody)}`,
      openRouterResponse.status,
    )
  }

  const completion = parseJson<{
    choices?: Array<{ message?: { content?: string } }>
  }>(rawBody, 'OpenRouter returned a non-JSON API response.')
  const content = completion.choices?.[0]?.message?.content

  if (!content) {
    throw statusError('OpenRouter returned an empty response.', 502)
  }

  return normalizePreviewPayload(parseModelJson(content))
}

async function callOpenRouter(apiKey: string, body: unknown) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

  try {
    return await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gittidy.local',
        'X-Title': 'GitTidy',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    throw statusError('OpenRouter did not respond before the timeout.', 504)
  } finally {
    clearTimeout(timeout)
  }
}

function parseJson<T>(value: string, message: string): T {
  try {
    return JSON.parse(value) as T
  } catch {
    throw statusError(message, 502)
  }
}

function parseModelJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? value
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  const json = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate

  return parseJson(json, 'OpenRouter returned invalid JSON content.')
}

function statusError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
}

function resolveStatus(error: unknown) {
  return typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
    ? error.status
    : 500
}

function previewText(value: string) {
  return value.trim().slice(0, 240) || 'No response body.'
}

function normalizePreviewPayload(value: unknown) {
  if (isPreviewEnvelope(value)) {
    return value
  }

  if (Array.isArray(value)) {
    if (value.every(isPreviewItem)) {
      return { previews: value }
    }

    const first = value[0]

    if (isPreviewEnvelope(first)) {
      return first
    }
  }

  if (isPreviewItem(value)) {
    return { previews: [value] }
  }

  throw statusError('OpenRouter preview response had the wrong shape.', 502)
}

function isPreviewEnvelope(value: unknown): value is { previews: unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'previews' in value &&
    Array.isArray(value.previews)
  )
}

function isPreviewItem(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'repoName' in value &&
    'suggestedReadme' in value
  )
}

function readEnvValue(name: string) {
  if (process.env[name]) {
    return process.env[name]
  }

  const envPath = join(process.cwd(), '.env.local')

  if (!existsSync(envPath)) {
    return undefined
  }

  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((item) => item.startsWith(`${name}=`))

  return line?.slice(name.length + 1).trim() || undefined
}
