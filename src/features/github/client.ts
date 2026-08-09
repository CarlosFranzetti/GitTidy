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

async function requestJson<T>(
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: buildHeaders(token),
    signal,
  })

  if (!response.ok) {
    throw new GitHubClientError(resolveErrorMessage(response.status), response.status)
  }

  return response.json() as Promise<T>
}

export async function fetchViewer(token: string, signal?: AbortSignal) {
  return requestJson<GitHubViewerResponse>('/user', token, signal)
}

export async function fetchRepositories(token: string, signal?: AbortSignal) {
  return requestJson<GitHubRepoResponse[]>(
    '/user/repos?sort=updated&per_page=100',
    token,
    signal,
  )
}

export async function fetchRepositoryDetails(
  owner: string,
  repo: string,
  token: string,
  signal?: AbortSignal,
) {
  return requestJson<GitHubRepoResponse>(`/repos/${owner}/${repo}`, token, signal)
}

export async function fetchRepositoryReadme(
  owner: string,
  repo: string,
  token: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`, {
    headers: buildHeaders(token),
    signal,
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new GitHubClientError(resolveErrorMessage(response.status), response.status)
  }

  const payload = (await response.json()) as GitHubReadmeResponse

  return {
    path: payload.path,
    sha: payload.sha,
    decodedContent: decodeBase64Content(payload.content),
  }
}

export async function updateRepositoryReadme(input: {
  owner: string
  repo: string
  token: string
  content: string
  path?: string
  sha?: string
}) {
  const path = input.path || 'README.md'
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/contents/${encodedPath}`,
    {
      method: 'PUT',
      headers: buildHeaders(input.token),
      body: JSON.stringify({
        message: 'Update README with GitTidy',
        content: encodeBase64Content(input.content),
        ...(input.sha ? { sha: input.sha } : {}),
      }),
    },
  )

  if (!response.ok) {
    throw new GitHubClientError(resolveErrorMessage(response.status), response.status)
  }

  return response.json() as Promise<unknown>
}

/**
 * Updates only the fields explicitly present in `input`.
 *
 * GitHub's PATCH /repos endpoint treats omitted keys as "leave unchanged", so
 * anything the user did not select is never sent. Passing a cached value for an
 * unselected field would silently revert edits made elsewhere since the repo was
 * loaded, so undefined is the only safe representation of "do not touch".
 */
export async function updateRepositoryMetadata(input: {
  owner: string
  repo: string
  token: string
  description?: string
  homepage?: string
  topics?: string[]
}) {
  const repoPatch: Record<string, string> = {}
  if (input.description !== undefined) repoPatch.description = input.description
  if (input.homepage !== undefined) repoPatch.homepage = input.homepage

  if (Object.keys(repoPatch).length > 0) {
    const repoResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}`,
      {
        method: 'PATCH',
        headers: buildHeaders(input.token),
        body: JSON.stringify(repoPatch),
      },
    )

    if (!repoResponse.ok) {
      throw new GitHubClientError(
        resolveErrorMessage(repoResponse.status),
        repoResponse.status,
      )
    }
  }

  if (input.topics !== undefined) {
    const topicsResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/topics`,
      {
        method: 'PUT',
        headers: buildHeaders(input.token),
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
}

export async function fetchReadmeContent(
  owner: string,
  repo: string,
  token: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`, {
    headers: {
      ...buildHeaders(token),
      Accept: 'application/vnd.github.raw+json',
    },
    signal,
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

/**
 * Builds a text digest of the repo for the AI prompt when no README exists:
 * the README (if any) plus a few high-signal config and docs files.
 */
export async function fetchRepositoryContextText(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  signal?: AbortSignal,
) {
  const readme = await fetchReadmeContent(owner, repo, token, signal)

  try {
    const tree = await requestJson<GitTreeResponse>(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      token,
      signal,
    )
    const paths = selectContextPaths(tree.tree ?? [])
    const files = await Promise.all(
      paths.map(async (path) => {
        const content = await fetchRawFile(owner, repo, path, branch, token, signal)
        return content.trim() ? `--- ${path} ---\n${content.trim()}` : ''
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
  signal?: AbortSignal,
) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        ...buildHeaders(token),
        Accept: 'application/vnd.github.raw+json',
      },
      signal,
    },
  )

  if (!response.ok) {
    return ''
  }

  return response.text()
}

export function selectContextPaths(tree: NonNullable<GitTreeResponse['tree']>) {
  return tree
    .filter((item) => item.type === 'blob' && item.path)
    .map((item) => item.path as string)
    .filter((path) => {
      const lower = path.toLowerCase()
      return (
        lower.endsWith('.md') ||
        lower === 'package.json' ||
        lower === 'vite.config.ts' ||
        lower === 'next.config.js' ||
        lower === 'pyproject.toml' ||
        lower === 'cargo.toml' ||
        lower === 'go.mod'
      )
    })
    .filter((path) => !/^readme(\.|$)/i.test(path))
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

export function decodeBase64Content(value: string) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeBase64Content(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function resolveErrorMessage(status: number) {
  switch (status) {
    case 401:
      return 'GitHub rejected the session. Sign in again and make sure repo access is allowed.'
    case 403:
      return 'GitHub rate limited or denied the request. Write actions may need repo permission.'
    case 404:
      return 'GitHub could not find that repository. It may have been renamed or access revoked.'
    case 409:
      return 'This file changed on GitHub since GitTidy loaded it. Reload the repo and try again.'
    case 422:
      return 'GitHub rejected the values. Topics must be lowercase letters, numbers and hyphens.'
    default:
      return 'GitHub request failed. Check your connection or sign in again.'
  }
}
