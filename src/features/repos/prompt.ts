import type { RepoGenerationInput } from '../ai/types'
import type { RepoRecord } from '../../types/repo'
import { countWords } from './scoring'

/** Mirrors the server-side cap so the request is not rejected for size. */
export const PROMPT_CHAR_LIMIT = 7000

export function truncateForPrompt(value: string, limit = PROMPT_CHAR_LIMIT) {
  const trimmed = value.trim()
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed
}

export function toGenerationInput(
  repo: RepoRecord,
  readme: string,
): RepoGenerationInput {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    language: repo.language,
    description: repo.description,
    homepage: repo.homepage,
    topics: repo.topics,
    readmeWordCount: countWords(readme),
    existingReadme: truncateForPrompt(readme),
    issues: repo.issues.map((issue) => `${issue.label}: ${issue.detail}`),
  }
}

const TONES = {
  professional: 'professional, polished, concise',
  minimal: 'minimal, clean, simple language',
  technical: 'technical, precise, developer-focused',
  fun: 'fun, clear, student-builder friendly',
} as const

export type ToneId = keyof typeof TONES

export const TONE_IDS = Object.keys(TONES) as ToneId[]

export function toToneString(tone: string): string {
  return TONES[tone as ToneId] ?? TONES.fun
}

/** Splits "owner/name", tolerating names that themselves contain slashes. */
export function splitFullName(fullName: string) {
  const separator = fullName.indexOf('/')
  if (separator < 0) return { owner: fullName, name: '' }
  return {
    owner: fullName.slice(0, separator),
    name: fullName.slice(separator + 1),
  }
}
