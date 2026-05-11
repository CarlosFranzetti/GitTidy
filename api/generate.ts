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
    existingReadme?: string
    issues: string[]
  }>
  context: {
    projectGoal: string
    audience: string
    deployTarget: string
    tone: string
    extraNotes: string
  }
  refinementInput?: string
  currentReadmeMd?: string
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
    const rawContent =
      typeof error === 'object' &&
      error !== null &&
      'rawContent' in error &&
      typeof (error as Record<string, unknown>).rawContent === 'string'
        ? (error as { rawContent: string }).rawContent
        : undefined

    return response.status(resolveStatus(error)).json({
      error:
        error instanceof Error
          ? error.message
          : 'AI preview generation failed.',
      ...(rawContent !== undefined ? { rawContent } : {}),
    })
  }
}

async function createOpenRouterCompletion(apiKey: string, body: GenerateBody) {
  const isRefinement = Boolean(body.refinementInput && body.currentReadmeMd)
  const systemPrompt = [
    'You are a JSON API. You MUST respond with ONLY a raw JSON object.',
    'Do NOT include markdown. Do NOT use backticks. Do NOT add any explanation or commentary.',
    'Do NOT write any text before or after the JSON object.',
    'The response must start with { and end with } and contain nothing else.',
    'Use this exact shape:',
    '{"readme_md":"A polished README in markdown with title, tagline, features, tech stack, setup, demo link section, screenshots placeholder, and future improvements.","description":"Short GitHub repo description under 160 characters.","topics":["5","to","8","github","topics"],"deploy_suggestion":"Short suggestion if no homepage exists."}',
    isRefinement
      ? 'Task: Refine and update the provided README based on the user instructions. Preserve the overall structure but apply the requested changes.'
      : `Tone: ${body.context.tone || 'Fun, clear, student-builder friendly'}.`,
    'No fake claims. Do not invent features.',
    'Topics must be 5 to 8 lowercase GitHub topics.',
    'Return ONLY valid JSON. Do not include markdown. Do not include backticks. Do not include explanations.',
  ].join(' ')
  const primaryRepo = body.repos[0]
  const userPrompt = isRefinement
    ? [
        `Repo name: ${primaryRepo?.fullName || primaryRepo?.name || 'Unknown'}`,
        `Refinement instructions: ${body.refinementInput}`,
        `Extra context: ${body.context.extraNotes || 'None'}`,
        'Current README to refine:',
        body.currentReadmeMd ?? '',
      ].join('\n')
    : [
        `Repo name: ${primaryRepo?.fullName || primaryRepo?.name || 'Unknown'}`,
        `Current description: ${primaryRepo?.description || 'None'}`,
        `Language: ${primaryRepo?.language || 'Unknown'}`,
        `Homepage URL: ${primaryRepo?.homepage || 'None'}`,
        `Topics: ${(primaryRepo?.topics ?? []).join(', ') || 'None'}`,
        `Project goal: ${body.context.projectGoal || 'Infer from the repository.'}`,
        `Audience: ${body.context.audience || 'students, recruiters, collaborators, and indie builders'}`,
        `Deploy target: ${body.context.deployTarget || 'Infer if possible.'}`,
        `Tone: ${body.context.tone || 'fun, clear, student-builder friendly'}`,
        `Extra notes: ${body.context.extraNotes || 'None'}`,
        'Existing README or code analysis:',
        primaryRepo?.existingReadme || primaryRepo?.readmeExcerpt || 'No README provided. Infer from the repo name, language, and metadata.',
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

  return normalizePreviewPayload(primaryRepo?.name ?? 'Repository', parseModelJson(content))
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
  // 1. Direct parse — works when the model returns raw JSON (even with code blocks inside string values)
  try {
    return JSON.parse(value.trim())
  } catch {
    // fall through
  }

  // 2. Model wrapped response in ```json ... ``` fences
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]
  if (fenced) {
    try {
      return JSON.parse(fenced.trim())
    } catch {
      // fall through
    }
  }

  // 3. Extract outermost { … } from surrounding prose
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(value.slice(start, end + 1))
    } catch {
      // fall through
    }
  }

  throw Object.assign(
    new Error('OpenRouter returned invalid JSON content.'),
    { status: 502, rawContent: value },
  )
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

function normalizePreviewPayload(repoName: string, value: unknown) {
  if (isPreviewEnvelope(value)) {
    return value
  }

  if (isPromptResult(value)) {
    return {
      previews: [
        {
          repoName,
          readmeMd: value.readme_md,
          description: value.description,
          topics: value.topics,
          deploySuggestion: value.deploy_suggestion,
        },
      ],
    }
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

function isPromptResult(value: unknown): value is {
  readme_md: string
  description: string
  topics: string[]
  deploy_suggestion: string
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'readme_md' in value &&
    'description' in value &&
    'topics' in value &&
    'deploy_suggestion' in value &&
    typeof value.readme_md === 'string' &&
    typeof value.description === 'string' &&
    Array.isArray(value.topics) &&
    typeof value.deploy_suggestion === 'string'
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
