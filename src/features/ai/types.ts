export type AiSuggestions = {
  repoName: string
  readmeMd: string
  description: string
  topics: string[]
  deploySuggestion: string
  /** Which model actually produced this, reported by the server. */
  model?: string
}

export type RepoGenerationInput = {
  id: number
  name: string
  fullName: string
  language: string
  description: string
  homepage: string
  topics: string[]
  readmeWordCount: number
  existingReadme: string
  issues: string[]
}

export type GenerationContext = {
  projectGoal: string
  audience: string
  deployTarget: string
  tone: string
  extraNotes: string
}

/**
 * 'full' asks for a README plus metadata. 'metadata' skips README generation
 * entirely so topics and description can be fixed on their own — far cheaper
 * and far less likely to trip the free-model rate limits.
 */
export type GenerationMode = 'full' | 'metadata'

export type GenerateSuggestionsRequest = {
  repos: RepoGenerationInput[]
  context: GenerationContext
  mode?: GenerationMode
  refinementInput?: string
  currentReadmeMd?: string
}

export type GenerateSuggestionsResponse = {
  previews: AiSuggestions[]
}
