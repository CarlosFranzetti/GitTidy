import type { RepoIssue, RepoScoreBreakdown, ScoreChecklist } from '../../types/repo'

export type ScoreInput = {
  description: string
  homepage: string
  topics: string[]
  readmeWordCount: number
}

export type ScoreResult = {
  score: number
  scoreBreakdown: RepoScoreBreakdown
  checklist: ScoreChecklist
  issues: RepoIssue[]
}

export const README_MAX = 35
export const DESCRIPTION_MAX = 20
export const HOMEPAGE_MAX = 20
export const TOPICS_MAX = 25

const DETAILED_README_WORDS = 80
const ENOUGH_TOPICS = 3

export function scoreReadme(readmeWordCount: number) {
  if (readmeWordCount >= 180) return README_MAX
  if (readmeWordCount >= DETAILED_README_WORDS) return 26
  if (readmeWordCount >= 20) return 14
  return 0
}

export function scoreTopics(topicCount: number) {
  if (topicCount >= 4) return TOPICS_MAX
  if (topicCount >= 2) return 16
  if (topicCount >= 1) return 8
  return 0
}

export function scoreRepository(input: ScoreInput): ScoreResult {
  const description = input.description.trim()
  const homepage = input.homepage.trim()
  const topicCount = input.topics.length

  const scoreBreakdown: RepoScoreBreakdown = {
    readme: scoreReadme(input.readmeWordCount),
    description: description ? DESCRIPTION_MAX : 0,
    homepage: homepage ? HOMEPAGE_MAX : 0,
    topics: scoreTopics(topicCount),
  }

  const checklist: ScoreChecklist = {
    hasReadme: input.readmeWordCount > 0,
    hasDetailedReadme: input.readmeWordCount >= DETAILED_README_WORDS,
    hasDescription: Boolean(description),
    hasHomepage: Boolean(homepage),
    hasTopics: topicCount >= ENOUGH_TOPICS,
  }

  const issues: RepoIssue[] = []

  if (!checklist.hasReadme) {
    issues.push({
      type: 'readme',
      label: 'No README',
      detail: 'Add a README so visitors know what this project does.',
    })
  } else if (!checklist.hasDetailedReadme) {
    issues.push({
      type: 'readme',
      label: 'Thin README',
      detail: 'Add setup, purpose, and screenshots or demo links.',
    })
  }

  if (!checklist.hasDescription) {
    issues.push({
      type: 'description',
      label: 'Missing description',
      detail: 'Summarize the repo clearly in one sentence for GitHub visitors.',
    })
  }

  if (!checklist.hasHomepage) {
    issues.push({
      type: 'homepage',
      label: 'No deploy link',
      detail: 'Point the homepage field at a live demo so people can click through.',
    })
  }

  if (!checklist.hasTopics) {
    issues.push({
      type: 'topics',
      label: 'Too few topics',
      detail: `Add at least ${ENOUGH_TOPICS} topics so the repo shows up in GitHub search.`,
    })
  }

  const score =
    scoreBreakdown.readme +
    scoreBreakdown.description +
    scoreBreakdown.homepage +
    scoreBreakdown.topics

  return { score, scoreBreakdown, checklist, issues }
}

export function countWords(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}
