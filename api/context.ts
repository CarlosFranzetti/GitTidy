import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type ContextBody = {
  repos: Array<{
    fullName: string
    language: string
    description: string
    homepage: string
    topics: string[]
    readmeWordCount: number
    readmeExcerpt: string
    issues: string[]
  }>
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
    const body = request.body as ContextBody
    const payload = await inferContext(apiKey, body)

    return response.status(200).json(payload)
  } catch (error: unknown) {
    return response.status(resolveStatus(error)).json({
      error:
        error instanceof Error ? error.message : 'Context inference failed.',
    })
  }
}

async function inferContext(apiKey: string, body: ContextBody) {
  const systemPrompt = [
    'You are GitTidy. Infer concise repository improvement context from GitHub metadata and README markdown.',
    'Return valid JSON only.',
    'Do not invent unsupported facts.',
    'If evidence is weak, use sensible generic portfolio positioning.',
    'Return this exact JSON shape: {"context":{"projectGoal":"string","audience":"string","deployTarget":"string","tone":"string","extraNotes":"string"}}',
  ].join(' ')
  const userPrompt = [
    'Selected repositories:',
    JSON.stringify(body.repos, null, 2),
    'Infer the best context values for improving these repositories.',
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
      `OpenRouter context inference failed (${openRouterResponse.status}): ${previewText(rawBody)}`,
      openRouterResponse.status,
    )
  }

  const completion = parseJson<{
    choices?: Array<{ message?: { content?: string } }>
  }>(rawBody, 'OpenRouter returned a non-JSON context API response.')
  const content = completion.choices?.[0]?.message?.content

  if (!content) {
    throw statusError('OpenRouter returned an empty context response.', 502)
  }

  return normalizeContextPayload(parseModelJson(content))
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

  return parseJson(json, 'OpenRouter returned invalid context JSON.')
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

function normalizeContextPayload(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value

  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'context' in candidate
  ) {
    return candidate
  }

  throw statusError('OpenRouter context response had the wrong shape.', 502)
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
