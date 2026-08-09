export type RepoIssueType = 'readme' | 'description' | 'homepage' | 'topics'

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

export type ScoreChecklist = {
  hasReadme: boolean
  hasDetailedReadme: boolean
  hasDescription: boolean
  hasHomepage: boolean
  hasTopics: boolean
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
  score: number
  scoreBreakdown: RepoScoreBreakdown
  checklist: ScoreChecklist
  issues: RepoIssue[]
}
