export class HttpError extends Error {
  status: number
  rawContent?: string

  constructor(message: string, status: number, rawContent?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.rawContent = rawContent
  }
}

export function resolveStatus(error: unknown): number {
  return error instanceof HttpError ? error.status : 500
}

export function previewText(value: string): string {
  return value.trim().slice(0, 240) || 'No response body.'
}

/**
 * Extracts a JSON object from model output.
 *
 * Models that are told "return only JSON" routinely wrap the payload in code
 * fences or add a sentence of commentary, so parsing falls back through
 * progressively looser strategies before giving up.
 */
export function parseModelJson(value: string): unknown {
  try {
    return JSON.parse(value.trim())
  } catch {
    // try the next strategy
  }

  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]
  if (fenced) {
    try {
      return JSON.parse(fenced.trim())
    } catch {
      // try the next strategy
    }
  }

  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(value.slice(start, end + 1))
    } catch {
      // out of strategies
    }
  }

  throw new HttpError('The AI returned invalid JSON content.', 502, value)
}
