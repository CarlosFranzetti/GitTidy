import type {
  GitHubReadmeResponse,
  GitHubRepoResponse,
  GitHubViewerResponse,
} from './types'

const GITHUB_API_BASE = 'https://api.github.com'

export class GitHubClientError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GitHubClientError'
    this.status = status
  }
}

function buildHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function requestJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    throw new GitHubClientError(resolveErrorMessage(response.status), response.status)
  }

  return response.json() as Promise<T>
}

export async function fetchViewer(token: string) {
  return requestJson<GitHubViewerResponse>('/user', token)
}

export async function fetchRepositories(token: string) {
  return requestJson<GitHubRepoResponse[]>(
    '/user/repos?sort=updated&per_page=30',
    token,
  )
}

export async function fetchRepositoryDetails(
  owner: string,
  repo: string,
  token: string,
) {
  return requestJson<GitHubRepoResponse>(`/repos/${owner}/${repo}`, token)
}

export async function fetchRepositoryReadme(
  owner: string,
  repo: string,
  token: string,
) {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`, {
    headers: buildHeaders(token),
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new GitHubClientError(resolveErrorMessage(response.status), response.status)
  }

  const payload = (await response.json()) as GitHubReadmeResponse

  return {
    ...payload,
    decodedContent: decodeBase64Content(payload.content),
  }
}

export async function updateRepositoryReadme(input: {
  owner: string
  repo: string
  token: string
  content: string
  sha?: string
}) {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/contents/README.md`,
    {
      method: 'PUT',
      headers: buildHeaders(input.token),
      body: JSON.stringify({
        message: 'Update README with GitTidy',
        content: encodeBase64Content(input.content),
        sha: input.sha,
      }),
    },
  )

  if (!response.ok) {
    throw new GitHubClientError(resolveErrorMessage(response.status), response.status)
  }

  return response.json() as Promise<unknown>
}

export async function updateRepositoryMetadata(input: {
  owner: string
  repo: string
  token: string
  description: string
  homepage: string
  topics: string[]
}) {
  const repoResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}`,
    {
      method: 'PATCH',
      headers: buildHeaders(input.token),
      body: JSON.stringify({
        description: input.description,
        homepage: input.homepage,
      }),
    },
  )

  if (!repoResponse.ok) {
    throw new GitHubClientError(
      resolveErrorMessage(repoResponse.status),
      repoResponse.status,
    )
  }

  const topicsResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/topics`,
    {
      method: 'PUT',
      headers: {
        ...buildHeaders(input.token),
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({ names: input.topics }),
    },
  )

  if (!topicsResponse.ok) {
    throw new GitHubClientError(
      resolveErrorMessage(topicsResponse.status),
      topicsResponse.status,
    )
  }
}

export async function fetchReadmeWordCount(
  owner: string,
  repo: string,
  token: string,
) {
  const text = await fetchReadmeContent(owner, repo, token)
  return wordCount(text)
}

export async function fetchReadmeContent(
  owner: string,
  repo: string,
  token: string,
) {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`, {
    headers: {
      ...buildHeaders(token),
      Accept: 'application/vnd.github.raw+json',
    },
  })

  if (response.status === 404) {
    return ''
  }

  if (!response.ok) {
    throw new GitHubClientError(resolveErrorMessage(response.status), response.status)
  }

  return response.text()
}

type GitTreeResponse = {
  tree?: Array<{
    path?: string
    type?: string
  }>
}

export async function fetchRepositoryContextText(
  owner: string,
  repo: string,
  branch: string,
  token: string,
) {
  const readme = await fetchReadmeContent(owner, repo, token)

  try {
    const tree = await requestJson<GitTreeResponse>(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      token,
    )
    const paths = selectContextPaths(tree.tree ?? [])
    const files = await Promise.all(
      paths.map(async (path) => {
        const content = await fetchRawFile(owner, repo, path, branch, token)
        return `--- ${path} ---\n${content.trim()}`
      }),
    )

    return [readme ? `--- README ---\n${readme.trim()}` : '', ...files]
      .filter(Boolean)
      .join('\n\n')
  } catch {
    return readme
  }
}

async function fetchRawFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token: string,
) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        ...buildHeaders(token),
        Accept: 'application/vnd.github.raw+json',
      },
    },
  )

  if (!response.ok) {
    return ''
  }

  return response.text()
}

function selectContextPaths(tree: NonNullable<GitTreeResponse['tree']>) {
  const candidates = tree
    .filter((item) => item.type === 'blob' && item.path)
    .map((item) => item.path as string)
    .filter((path) => {
      const lower = path.toLowerCase()
      return (
        lower.endsWith('.md') ||
        lower === 'package.json' ||
        lower === 'vite.config.ts' ||
        lower === 'next.config.js' ||
        lower === 'pyproject.toml'
      )
    })
    .filter((path) => !/^readme(\.|$)/i.test(path))

  return candidates
    .sort((a, b) => contextPriority(a) - contextPriority(b))
    .slice(0, 6)
}

function contextPriority(path: string) {
  const lower = path.toLowerCase()

  if (lower === 'package.json') return 1
  if (lower.startsWith('docs/') && lower.endsWith('.md')) return 2
  if (lower.endsWith('.md')) return 3
  return 4
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0
}

function decodeBase64Content(value: string) {
  const binary = window.atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeBase64Content(value: string) {
  const bytes = new TextEncoder().encode(value)
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return window.btoa(binary)
}

function resolveErrorMessage(status: number) {
  switch (status) {
    case 401:
      return 'GitHub rejected the session. Sign in again and make sure repo access is allowed.'
    case 403:
      return 'GitHub rate limited or denied the request. Write actions may need repo permission.'
    default:
      return 'GitHub request failed. Check your connection or sign in again.'
  }
}
