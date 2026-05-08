export type AiSuggestions = {
  repoName: string
  readmeMd: string
  description: string
  topics: string[]
  deploySuggestion: string
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
  readmeExcerpt: string
  existingReadme?: string
  issues: string[]
}

export type InferredContext = {
  projectGoal: string
  audience: string
  deployTarget: string
  tone: string
  extraNotes: string
}

export type GenerateSuggestionsRequest = {
  repos: RepoGenerationInput[]
  context: InferredContext
}

export type GenerateSuggestionsResponse = {
  previews: AiSuggestions[]
}

export type InferContextRequest = {
  repos: RepoGenerationInput[]
}

export type InferContextResponse = {
  context: InferredContext
}
