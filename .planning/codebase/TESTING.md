# Testing Patterns

**Analysis Date:** 2026-05-09

## Test Framework

**Runner:**
- None — no test framework is installed or configured
- No `jest.config.*`, `vitest.config.*`, or equivalent found
- No testing packages in `package.json` (`devDependencies` contains only Vite, TypeScript, ESLint, and Tailwind tooling)

**Assertion Library:**
- None

**Run Commands:**
```bash
# No test commands configured
# npm run build  # Type-checking via tsc -b is the closest to validation
npm run lint     # ESLint static analysis
npm run build    # Full TypeScript compile + Vite build as integration check
```

## Test File Organization

**Location:**
- No test files exist in the repository (confirmed by `find . -name "*.test.*" -o -name "*.spec.*"` returning no results)

**Naming:**
- Not applicable

## Test Structure

**Suite Organization:**
- Not applicable — no tests exist

**Patterns:**
- Not applicable

## Mocking

**Framework:** None

**Patterns:**
- The codebase uses a static mock data module at `src/features/repos/mock-data.ts` as a substitute for real API data during development
- Mock data is not used by a test framework; it is imported directly in development flows

**Mock data structure:**
```ts
// src/features/repos/mock-data.ts
export const mockRepos: RepoRecord[] = seedRepos.map((repo) => {
  const result = scoreRepository({ ... })
  return { ...repo, ...result, readmeLoaded: true }
})
```

**What to Mock (guidance for future tests):**
- `fetch` calls to GitHub API (`src/features/github/client.ts`)
- `fetch` calls to `/api/generate` and `/api/context` (`src/features/ai/client.ts`)
- `navigator.clipboard.writeText` (`src/lib/clipboard.ts`)
- `window.localStorage` for token/theme persistence

**What NOT to Mock:**
- `scoreRepository` in `src/features/repos/scoring.ts` — pure function, test directly with inputs
- `normalizeGitHubRepo` in `src/features/github/normalize.ts` — pure function, test directly
- `calculateScore` (module-scope helper in `src/App.tsx`) — pure function

## Fixtures and Factories

**Test Data:**
- `src/features/repos/mock-data.ts` contains four realistic seed repos covering TypeScript, JavaScript, Go, and Python
- Seed repos exercise different score tiers: thin README, missing description, no homepage, missing topics
- Scores are computed at import time via `scoreRepository`, not hardcoded

**Location:**
- `src/features/repos/mock-data.ts` — only mock data file

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Not available — no test runner configured
```

## Test Types

**Unit Tests:**
- Not present
- Highest-value targets for unit tests:
  - `src/features/repos/scoring.ts` — deterministic scoring algorithm, easy to unit test with table-driven inputs
  - `src/features/github/normalize.ts` — pure transformation from API shape to `RepoRecord`
  - Helper functions in `src/App.tsx`: `calculateScore`, `countWords`, `truncateForPrompt`, `splitFullName`
  - `api/generate.ts` helpers: `parseModelJson`, `normalizePreviewPayload`, `isPromptResult`, `isPreviewEnvelope`

**Integration Tests:**
- Not present
- Key flows to cover:
  - OAuth token handling and URL cleanup (`useEffect` in `App.tsx`)
  - Repo selection triggering parallel API fetches
  - AI generation, parse failure, and `debugRawAi` debug panel activation
  - Confirmation modal → GitHub write-back flow

**E2E Tests:**
- Not used

## Common Patterns

**Async Testing (recommended when adding tests):**
```ts
// Pattern for testing async functions that can throw GitHubClientError
it('throws GitHubClientError on 401', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
  await expect(fetchRepositories('bad-token')).rejects.toBeInstanceOf(GitHubClientError)
})
```

**Error Testing (recommended when adding tests):**
```ts
// Pattern for testing resolveError helper
it('returns error message for Error instances', () => {
  const err = new Error('something went wrong')
  expect(resolveError(err, 'fallback')).toBe('something went wrong')
})
```

**Pure Function Testing (recommended when adding tests):**
```ts
// Pattern for scoring.ts
it('gives max README score at 180+ words', () => {
  const result = scoreRepository({ description: 'x', homepage: 'x', topics: ['a','b','c','d'], readmeWordCount: 200 })
  expect(result.scoreBreakdown.readme).toBe(35)
})
```

## Recommended Setup (if adding tests)

The codebase is well-suited for Vitest given it already uses Vite:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

Add `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'jsdom' }
})
```

Priority test targets in order:
1. `src/features/repos/scoring.ts` — pure, no deps, deterministic
2. `src/features/github/normalize.ts` — pure transformation
3. `api/generate.ts` JSON parsing helpers — `parseModelJson`, `normalizePreviewPayload`
4. `src/features/github/client.ts` — with `fetch` mocked

---

*Testing analysis: 2026-05-09*
