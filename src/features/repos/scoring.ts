import type { RepoIssue, RepoScoreBreakdown } from '../../types/repo'

type ScoreInput = {
  description: string
  homepage: string
  topics: string[]
  readmeWordCount: number
}

const README_MAX = 35
const DESCRIPTION_MAX = 20
const HOMEPAGE_MAX = 20
const TOPICS_MAX = 25

export function scoreRepository(input: ScoreInput): {
  score: number
  scoreBreakdown: RepoScoreBreakdown
  issues: RepoIssue[]
} {
  const readme =
    input.readmeWordCount >= 180
      ? README_MAX
      : input.readmeWordCount >= 80
        ? 26
        : input.readmeWordCount >= 20
          ? 14
          : 0

  const description = input.description.trim() ? DESCRIPTION_MAX : 0
  const homepage = input.homepage.trim() ? HOMEPAGE_MAX : 0
  const topics =
    input.topics.length >= 4
      ? TOPICS_MAX
      : input.topics.length >= 2
        ? 16
        : input.topics.length >= 1
          ? 8
          : 0

  const issues: RepoIssue[] = []

  if (readme < 20) {
    issues.push({
      type: 'readme',
      label: 'Thin README',
      detail: 'Add setup, purpose, and screenshots or demo links.',
    })
  }

  if (!input.description.trim()) {
    issues.push({
      type: 'description',
      label: 'Missing description',
      detail: 'Summarize the repo clearly in one sentence for GitHub visitors.',
    })
  }

  if (!input.homepage.trim()) {
    issues.push({
      type: 'homepage',
      label: 'No live link',
      detail: 'Add a homepage, deployed app, docs site, or portfolio URL.',
    })
  }

  if (input.topics.length === 0) {
    issues.push({
      type: 'topics',
      label: 'No topics',
      detail: 'Topics improve discoverability and help explain the project stack.',
    })
  }

  return {
    score: readme + description + homepage + topics,
    scoreBreakdown: {
      readme,
      description,
      homepage,
      topics,
    },
    issues,
  }
}
