import type { RepoRecord } from '../../types/repo'
import type { GitHubRepoResponse } from './types'
import { scoreRepository } from '../repos/scoring'

export function normalizeGitHubRepo(
  repo: GitHubRepoResponse,
  readmeWordCount = 0,
): RepoRecord {
  const description = repo.description ?? ''
  const homepage = repo.homepage ?? ''
  const topics = repo.topics ?? []
  const { score, scoreBreakdown, checklist, issues } = scoreRepository({
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
    checklist,
    issues,
  }
}
