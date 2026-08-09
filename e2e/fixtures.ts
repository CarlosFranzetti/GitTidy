import type { Page, Route } from '@playwright/test'

export const REPOS = [
  {
    id: 1,
    name: 'gittidy',
    full_name: 'octocat/gittidy',
    description: 'Polish your GitHub repos',
    private: false,
    language: 'TypeScript',
    updated_at: '2026-08-01T00:00:00Z',
    homepage: 'https://git-tidy.vercel.app',
    topics: ['react', 'typescript', 'github', 'ai'],
    default_branch: 'main',
  },
  {
    id: 2,
    name: 'bare-project',
    full_name: 'octocat/bare-project',
    description: null,
    private: false,
    language: 'JavaScript',
    updated_at: '2026-07-01T00:00:00Z',
    homepage: null,
    topics: [],
    default_branch: 'main',
  },
  {
    id: 3,
    name: 'private-thing',
    full_name: 'octocat/private-thing',
    description: 'Secret sauce',
    private: true,
    language: 'Go',
    updated_at: '2026-06-01T00:00:00Z',
    homepage: null,
    topics: ['go'],
    default_branch: 'main',
  },
]

const LONG_README = `# gittidy

A tool for tidying repositories. ${'Detail sentence here. '.repeat(60)}

| Feature | Status |
| ------- | ------ |
| Scoring | Done |

\`\`\`bash
npm install
\`\`\`
`

function base64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64')
}

/**
 * Stubs every network dependency so the suite is deterministic and never
 * touches GitHub or OpenRouter.
 */
export async function mockBackend(page: Page, options: { failAi?: boolean } = {}) {
  await page.route('https://api.github.com/**', async (route: Route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (method === 'PATCH' || method === 'PUT') {
      return route.fulfill({ json: { ok: true } })
    }

    if (url.includes('/user/repos')) {
      return route.fulfill({ json: REPOS })
    }
    if (url.endsWith('/user')) {
      return route.fulfill({ json: { login: 'octocat', name: 'Octo Cat' } })
    }
    if (url.includes('/readme')) {
      if (url.includes('bare-project')) {
        return route.fulfill({ status: 404, json: { message: 'Not Found' } })
      }
      return route.fulfill({
        json: { path: 'README.md', sha: 'abc123', content: base64(LONG_README) },
      })
    }
    if (url.includes('/git/trees/')) {
      return route.fulfill({ json: { tree: [] } })
    }

    const repo = REPOS.find((entry) => url.includes(entry.full_name))
    return route.fulfill({ json: repo ?? REPOS[0] })
  })

  await page.route('**/api/generate', async (route: Route) => {
    if (options.failAi) {
      return route.fulfill({
        status: 502,
        json: { error: 'All free models are busy right now.' },
      })
    }

    const body = route.request().postDataJSON() as { mode?: string }
    return route.fulfill({
      json: {
        previews: [
          {
            repoName: 'gittidy',
            readmeMd:
              body?.mode === 'metadata'
                ? ''
                : '# GitTidy\n\nA generated README with plenty of words to count.\n\n## Setup\n\n```bash\nnpm install\n```\n',
            description: 'Generated description for the repository',
            topics: ['react', 'typescript', 'vite', 'github-api', 'openrouter'],
            deploySuggestion: 'Deploy on Vercel at https://example.vercel.app',
            model: 'test/model:free',
          },
        ],
      },
    })
  })
}

/** Puts a token in localStorage so the app starts signed in. */
export async function signIn(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('gittidy.github-token', 'gho_test_token_value')
  })
}
