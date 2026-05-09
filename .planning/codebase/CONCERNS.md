# Codebase Concerns

**Analysis Date:** 2026-05-09

## Tech Debt

**Monolithic App.tsx:**
- Issue: All UI, state, event handlers, and helper functions live in a single 792-line file (`src/App.tsx`). Inline sub-components (`EmptyState`, `Checklist`, `ReadmePanel`, `PreviewMeta`, `DebugPanel`, `ConfirmationModal`) are defined at the bottom of the file rather than in separate component modules.
- Files: `src/App.tsx`
- Impact: Hard to navigate, test, or safely modify any single UI slice without risk of regressions elsewhere. Grows unbounded as features are added.
- Fix approach: Extract each inline component to its own file in `src/components/` or `src/features/repos/components/`. Move state management logic into custom hooks (`useRepos`, `useActiveRepo`, `useGeneration`).

**Duplicate `wordCount` / `countWords` implementations:**
- Issue: Functionally identical word-counting logic is implemented twice — `countWords()` in `src/App.tsx` (line 783) and `wordCount()` in `src/features/github/client.ts` (line 280).
- Files: `src/App.tsx`, `src/features/github/client.ts`
- Impact: Changes to the algorithm must be made in two places; results may silently diverge.
- Fix approach: Extract to `src/lib/utils.ts` and import from both callers.

**Duplicate `callOpenRouter` / `parseModelJson` / `readEnvValue` across two serverless functions:**
- Issue: `api/generate.ts` and `api/context.ts` each contain their own copy of `callOpenRouter`, `parseModelJson`, `statusError`, `resolveStatus`, `previewText`, and `readEnvValue`. These are identical implementations copy-pasted.
- Files: `api/generate.ts`, `api/context.ts`
- Impact: Any bug or security fix to these helpers must be applied in two places. Already diverged slightly (`parseModelJson` in `api/context.ts` throws a different error message).
- Fix approach: Extract to `api/_lib/openrouter.ts` and `api/_lib/env.ts` shared modules.

**Scoring algorithm defined twice with different logic:**
- Issue: `src/features/repos/scoring.ts` implements the canonical scoring algorithm (README: 0/14/26/35 points, Topics: 0/8/16/25 points). `src/App.tsx` (`calculateScore`, lines 714–730) implements a second, simpler algorithm (README: 0/25/45 points, Topics: 0/15 points). Both are used at the same time — `scoring.ts` for the `RepoRecord.score` field shown in the repo list, `App.tsx`'s `calculateScore` for the score badge and checklist in the detail panel.
- Files: `src/App.tsx` (lines 714–730), `src/features/repos/scoring.ts`
- Impact: The displayed score changes when switching from the repo list to the detail view. The checklist thresholds (`readme.trim().length > 300`) differ from the scoring thresholds (word count >= 20/80/180). Users see inconsistent information.
- Fix approach: Remove `calculateScore` from `App.tsx`. Drive the detail panel from `scoreRepository()` in `scoring.ts`, which already returns a `scoreBreakdown` and `issues` array.

**`readmeExcerpt` set redundantly on every generation:**
- Issue: In `toGenerationInput()` (`src/App.tsx` line 732), `readmeExcerpt` and `existingReadme` are both set to `truncateForPrompt(readme)` — the same value. The prompt in `api/generate.ts` falls back from `existingReadme` to `readmeExcerpt` (line 94), making one field always unused.
- Files: `src/App.tsx` (lines 742–743), `api/generate.ts` (line 94)
- Impact: Extra unnecessary serialization; developer confusion about which field the API reads.
- Fix approach: Remove `readmeExcerpt` from `RepoGenerationInput` and use `existingReadme` only, or vice versa.

**`fetchReadmeWordCount` and `fetchReadmeContent` are unused in the UI:**
- Issue: `src/features/github/client.ts` exports `fetchReadmeWordCount` and `fetchReadmeContent` (lines 157–187) which are only called from `fetchRepositoryContextText` (itself only called from `api/context.ts` indirectly). These browser-side functions reference `window.atob` which would break in a Node.js context.
- Files: `src/features/github/client.ts`
- Impact: Dead code adds cognitive overhead and a false impression that these paths are exercised.
- Fix approach: Remove or clearly mark as unused; enforce with `noUnusedLocals` (already enabled in tsconfig, which means they survive only because they are exported).

**`/api/context` endpoint is implemented but unreachable from the UI:**
- Issue: `api/context.ts` is a fully implemented serverless function. `src/features/ai/client.ts` exports `inferContext()`. Neither is called from `src/App.tsx`.
- Files: `api/context.ts`, `src/features/ai/client.ts`
- Impact: Dead surface area that must be maintained, patched for security, and billed for Vercel invocations if accidentally triggered.
- Fix approach: Either wire it to the UI or delete it and its corresponding client export until it is needed.

---

## Security Considerations

**GitHub OAuth token passed in URL query string:**
- Risk: The OAuth callback (`api/github/oauth/callback.ts` line 54) redirects to `/?github_token=<token>`. The raw token is visible in the browser's address bar, browser history, Referrer headers sent to third-party scripts, and server/CDN access logs.
- Files: `api/github/oauth/callback.ts`, `src/App.tsx`
- Current mitigation: `window.history.replaceState` removes the token from the URL after it is stored (`src/App.tsx` lines 105). However, the token is in localStorage (XSS-accessible) rather than an HttpOnly cookie.
- Recommendations: Deliver the token via a short-lived HttpOnly cookie set during the callback redirect; read it server-side on first load; delete it after consumption. This eliminates URL exposure and localStorage risk simultaneously.

**GitHub OAuth token stored in `localStorage`:**
- Risk: Any JavaScript running on the page (including injected scripts, browser extensions, or XSS payloads) can read `localStorage['gittidy.github-token']` and obtain a `repo`-scoped GitHub token, which grants full read/write access to all of the user's repositories.
- Files: `src/App.tsx` (lines 49–57, 103, 525)
- Current mitigation: None. React's JSX encoding prevents direct XSS from generated content, but the stored token itself has no runtime protection.
- Recommendations: Store the token in an HttpOnly cookie (server-managed) or shorten the token lifetime with PKCE/session tokens.

**OAuth scope requests `repo` (full access):**
- Risk: `api/github/oauth/start.ts` line 16 requests the `repo` scope, which grants read and write access to all public and private repositories. GitTidy only needs to read repos/READMEs and write README + metadata on user-selected repos.
- Files: `api/github/oauth/start.ts`
- Current mitigation: None.
- Recommendations: Use `public_repo` for public-only users. For private repo support, consider `repo:status` + `contents:write` fine-grained permissions if the GitHub Apps model is adopted.

**No input validation or size limits on `/api/generate` and `/api/context` POST bodies:**
- Risk: Both serverless endpoints cast `request.body` directly to typed structures without any runtime validation. A malicious caller could send arbitrarily large strings in `existingReadme`, `description`, or `issues` arrays, driving up OpenRouter token costs or causing payload-size errors.
- Files: `api/generate.ts` (line 46), `api/context.ts` (line 37)
- Current mitigation: The `readmeExcerpt` / `existingReadme` field is truncated client-side before being sent, but a direct API caller bypasses this.
- Recommendations: Add request body size limits at the Vercel function level and validate/trim string fields server-side before forwarding to OpenRouter. Consider rate-limiting by IP.

**Hardcoded `HTTP-Referer: https://gittidy.local` in OpenRouter calls:**
- Risk: The referer sent to OpenRouter does not match the production deployment URL (`https://git-tidy.vercel.app`). If OpenRouter ever enforces referer-based allowlisting, production requests will be rejected.
- Files: `api/generate.ts` (line 137), `api/context.ts` (line 102)
- Current mitigation: OpenRouter does not currently enforce this.
- Recommendations: Derive the referer from `VERCEL_URL` or a `PUBLIC_APP_URL` environment variable.

---

## Performance Bottlenecks

**`selectRepo` makes three sequential GitHub API calls with no caching:**
- Problem: Every repo click calls `fetchRepositoryDetails` and `fetchRepositoryReadme` in parallel, then the rest of the component rerenders on result. If the user clicks through many repos, each selection incurs ~2 network round-trips with no deduplication.
- Files: `src/App.tsx` (lines 386–412), `src/features/github/client.ts`
- Cause: No caching layer; all data lives in ephemeral React state.
- Improvement path: Cache `{ readme, details }` per repo ID in a `Map` stored in a ref; skip network calls on re-selection of a previously loaded repo.

**Repository list hardcapped at 30 with no pagination:**
- Problem: `fetchRepositories` fetches `/user/repos?sort=updated&per_page=30`. Users with more than 30 repos cannot access older ones.
- Files: `src/features/github/client.ts` (line 44)
- Cause: No pagination implementation.
- Improvement path: Add a "Load more" button or paginate automatically; GitHub API supports `per_page=100` and `Link` header pagination.

---

## Fragile Areas

**`splitFullName` does not guard against repos without a `/`:**
- Files: `src/App.tsx` (lines 709–712)
- Why fragile: `const [owner, name] = fullName.split('/')` will produce `undefined` for `name` if `fullName` contains no slash. This value is then passed to `fetchRepositoryDetails(owner, name, ...)` which would make a malformed GitHub API request with `undefined` in the URL path.
- Safe modification: Add a guard — throw or return early if the split does not produce exactly two parts.
- Test coverage: None.

**`updateRepositoryReadme` always targets `README.md` (case-sensitive):**
- Files: `src/features/github/client.ts` (line 91)
- Why fragile: Many repositories use `readme.md`, `Readme.md`, or `README.MD`. Writing to `README.md` when the existing file is `readme.md` creates a duplicate file rather than updating the existing one. The `sha` passed would not match the new path, causing a 409 conflict or creating an orphaned file.
- Safe modification: Read the actual file path from the `fetchRepositoryReadme` response (GitHub returns the `path` field) and use it for writes.
- Test coverage: None.

**`readmeSha` missing causes silent README creation without conflict protection:**
- Files: `src/App.tsx` (lines 474–483), `src/features/github/client.ts` (lines 83–108)
- Why fragile: If `fetchRepositoryReadme` returns `null` (no README), `readmeSha` is `undefined`. GitHub's Contents API requires `sha` for updates to prevent conflicts; omitting it creates a new file. If a README was created externally between load and write, the write will fail with a 422 conflict rather than a user-friendly error.
- Safe modification: Surface the conflict error as a specific message rather than the generic `resolveErrorMessage` output; re-fetch SHA before writing if the write fails with 409/422.
- Test coverage: None.

---

## Test Coverage Gaps

**Zero test files exist:**
- What's not tested: Everything — scoring algorithm, normalization, token parsing, AI response parsing, OAuth flow, write-back logic, error handling.
- Files: Entire `src/` and `api/` directories.
- Risk: Any refactor silently breaks working behavior. The scoring discrepancy between `App.tsx` and `scoring.ts` (see Tech Debt above) could only be caught by tests.
- Priority: High

**`scoring.ts` has no tests despite having deterministic, testable logic:**
- What's not tested: All score thresholds and issue generation paths in `src/features/repos/scoring.ts`.
- Files: `src/features/repos/scoring.ts`
- Risk: The dual-scoring bug described above would be immediately caught by a simple unit test.
- Priority: High

**`parseModelJson` has no tests for malformed AI responses:**
- What's not tested: The JSON extraction logic in `api/generate.ts` and `api/context.ts` (markdown fence stripping, `{`/`}` boundary extraction, multi-object edge cases).
- Files: `api/generate.ts` (lines 158–174), `api/context.ts` (lines 123–131)
- Risk: Unexpected AI output format silently breaks generation with a hard-to-debug error.
- Priority: Medium

---

## Missing Critical Features

**No token expiry or revocation detection:**
- Problem: The stored GitHub token has no expiration on the client side. If GitHub revokes it (user revokes app access, token expires), the app shows generic "GitHub request failed" errors with no clear recovery path. The `disconnect()` function removes the token locally but offers no server-side revocation.
- Blocks: Good error UX; users don't know to sign out and sign back in.

**No loading state shown in the repo list while `isLoadingRepos` is true:**
- Problem: The repo list shows nothing while loading — only the "Loading GitHub repos..." subtitle text. There is no skeleton or spinner in the list area itself.
- Files: `src/App.tsx` (lines 168–170)
- Blocks: Perceived performance; users may click "Refresh" repeatedly thinking the load failed.

---

*Concerns audit: 2026-05-09*
