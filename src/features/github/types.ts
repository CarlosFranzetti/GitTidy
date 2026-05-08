export type GitHubRepoResponse = {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  language: string | null
  updated_at: string
  homepage: string | null
  topics?: string[]
  default_branch: string
}

export type GitHubReadmeResponse = {
  name: string
  path: string
  sha: string
  content: string
  encoding: string
}

export type GitHubViewerResponse = {
  login: string
  name: string | null
}
