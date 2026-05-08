export type RepoIssueType =
  | 'readme'
  | 'description'
  | 'homepage'
  | 'topics'

export type RepoIssue = {
  type: RepoIssueType
  label: string
  detail: string
}

export type RepoScoreBreakdown = {
  readme: number
  description: number
  homepage: number
  topics: number
}

export type RepoInsight = {
  label: string
  value: string
}

export type RepoRecord = {
  id: number
  name: string
  fullName: string
  description: string
  private: boolean
  language: string
  updatedAt: string
  homepage: string
  topics: string[]
  defaultBranch: string
  readmeWordCount: number
  readmeExcerpt?: string
  score: number
  scoreBreakdown: RepoScoreBreakdown
  issues: RepoIssue[]
  insights: RepoInsight[]
  readmeLoaded?: boolean
}
