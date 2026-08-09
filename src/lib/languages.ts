/**
 * Languages offered for README translation.
 *
 * The value travels into the model prompt, so the server re-validates it
 * against a strict pattern; keep these to plain language names.
 */
export const LANGUAGES = [
  'English',
  'Spanish',
  'Portuguese',
  'French',
  'German',
  'Italian',
  'Hindi',
  'Chinese (Simplified)',
  'Japanese',
  'Korean',
  'Arabic',
  'Russian',
] as const

export type Language = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'English'
