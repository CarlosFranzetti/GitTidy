import type { RepoInsight, RepoRecord } from '../../types/repo'
import type { GitHubRepoResponse } from './types'
import { scoreRepository } from '../repos/scoring'

export function normalizeGitHubRepo(
  repo: GitHubRepoResponse,
  readmeWordCount = 0,
): RepoRecord {
  const description = repo.description ?? ''
  const homepage = repo.homepage ?? ''
  const topics = repo.topics ?? []
  const { score, scoreBreakdown, issues } = scoreRepository({
    description,
    homepage,
    topics,
    readmeWordCount,
  })

  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description,
    private: repo.private,
    language: repo.language ?? 'Unknown',
    updatedAt: repo.updated_at,
    homepage,
    topics,
    defaultBranch: repo.default_branch,
    readmeWordCount,
    score,
    scoreBreakdown,
    issues,
    insights: buildInsights({ readmeWordCount, homepage, topics }),
  }
}

function buildInsights(input: {
  readmeWordCount: number
  homepage: string
  topics: string[]
}): RepoInsight[] {
  return [
    {
      label: 'README',
      value:
        input.readmeWordCount > 0
          ? `${input.readmeWordCount} words detected in the current README.`
          : 'README not loaded yet or repository does not expose one.',
    },
    {
      label: 'Deploy',
      value: input.homepage
        ? `Homepage set to ${input.homepage}.`
        : 'No homepage or deployed app URL is set on the repository.',
    },
    {
      label: 'Topics',
      value: input.topics.length
        ? `${input.topics.length} topic tags: ${input.topics.join(', ')}.`
        : 'No topic tags are set for discovery.',
    },
  ]
}
