<!-- refreshed: 2026-05-09 -->
# Architecture

**Analysis Date:** 2026-05-09

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                        │
│                         `src/App.tsx`                             │
│  All state, event handlers, and UI rendering in one component     │
├───────────────┬──────────────────────┬───────────────────────────┤
│  GitHub       │  AI Generation       │  Repo Scoring             │
│  Feature      │  Feature             │  Feature                  │
│ `src/features/│ `src/features/ai/`   │ `src/features/repos/`     │
│  github/`     │                      │                            │
└───────┬───────┴──────────┬───────────┴────────────┬──────────────┘
        │                  │                         │
        ▼                  ▼                         │
┌───────────────┐  ┌───────────────────┐            │
│ GitHub REST   │  │ Vercel Serverless  │◄───────────┘
│ API (external)│  │  Functions         │  (scoring runs client-side,
│ api.github.com│  │  `api/`            │   no server call)
└───────────────┘  └────────┬──────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │ OpenRouter AI API   │
                   │ (external service)  │
                   │ openrouter.ai       │
                   └────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App | All state, all UI, all orchestration | `src/App.tsx` |
| GitHub client | Fetch repos, README, write metadata/README back to GitHub | `src/features/github/client.ts` |
| GitHub normalizer | Convert raw GitHub API shapes to `RepoRecord` | `src/features/github/normalize.ts` |
| Scoring | Deterministic 0–100 quality score from repo metadata | `src/features/repos/scoring.ts` |
| AI client | POST to `/api/generate`; surface errors including `rawContent` | `src/features/ai/client.ts` |
| generate handler | Receive repo data, call OpenRouter, normalize response | `api/generate.ts` |
| context handler | Infer generation context from multiple repos (unused in UI) | `api/context.ts` |
| OAuth start | Redirect to GitHub with CSRF state cookie | `api/github/oauth/start.ts` |
| OAuth callback | Exchange code for token, clear CSRF cookie, redirect home | `api/github/oauth/callback.ts` |
| Shared types | `RepoRecord`, `RepoIssue`, `RepoScoreBreakdown`, `RepoInsight` | `src/types/repo.ts` |
| AI types | `AiSuggestions`, `GenerateSuggestionsRequest/Response` | `src/features/ai/types.ts` |
| Mock data | Seed repos for frontend-only dev mode | `src/features/repos/mock-data.ts` |
| UI primitives | `AppShell`, `Panel`, `ScoreRing`, `StatusBadge` (currently unused by App.tsx) | `src/components/` |

## Pattern Overview

**Overall:** Single-page application (SPA) with co-located Vercel serverless functions

**Key Characteristics:**
- All client state lives in `src/App.tsx` as local React state (no global store, no Context)
- Feature modules under `src/features/` own their API client, types, and sub-components
- Serverless functions in `api/` are the only server-side boundary; they proxy to OpenRouter and GitHub OAuth
- GitHub writes are always guarded by a `pendingAction` confirmation modal — no automatic writes
- Scoring is computed client-side synchronously; no server round-trip required

## Layers

**UI Layer:**
- Purpose: Render all views; manage all local React state
- Location: `src/App.tsx`
- Contains: State declarations, event handlers, JSX, inline helper components (`EmptyState`, `Checklist`, `ReadmePanel`, `PreviewMeta`, `DebugPanel`, `ConfirmationModal`)
- Depends on: feature clients, lib utilities, shared types
- Used by: `src/main.tsx` (React root mount)

**Feature Clients Layer:**
- Purpose: Typed wrappers around external HTTP APIs; all async I/O
- Location: `src/features/github/client.ts`, `src/features/ai/client.ts`
- Contains: Fetch calls, error classes (`GitHubClientError`), base64 encode/decode helpers
- Depends on: Shared types; no React
- Used by: `src/App.tsx`

**Normalization Layer:**
- Purpose: Convert raw API responses to the canonical `RepoRecord` shape
- Location: `src/features/github/normalize.ts`
- Contains: `normalizeGitHubRepo()`, `buildInsights()`; calls `scoreRepository()`
- Depends on: `src/features/repos/scoring.ts`, `src/types/repo.ts`, `src/features/github/types.ts`
- Used by: `src/App.tsx` (after every fetch)

**Scoring Layer:**
- Purpose: Deterministic quality score computation
- Location: `src/features/repos/scoring.ts`
- Contains: `scoreRepository()` — pure function, no side effects
- Depends on: `src/types/repo.ts` (types only)
- Used by: `src/features/github/normalize.ts`, `src/features/repos/mock-data.ts`

**Serverless Functions Layer:**
- Purpose: Server-only secrets, AI proxy, GitHub OAuth exchange
- Location: `api/generate.ts`, `api/context.ts`, `api/github/oauth/start.ts`, `api/github/oauth/callback.ts`
- Contains: Vercel request handlers, OpenRouter calls, env var readers (checks `process.env` then `.env.local`)
- Depends on: No shared `src/` code — fully self-contained
- Used by: Browser fetch calls from `src/features/ai/client.ts` and direct navigation for OAuth

**Shared Types Layer:**
- Purpose: Canonical domain types shared across all layers
- Location: `src/types/repo.ts`, `src/features/ai/types.ts`, `src/features/github/types.ts`
- Contains: `RepoRecord`, `RepoIssue`, `AiSuggestions`, `GenerateSuggestionsRequest`, GitHub API response shapes
- Depends on: Nothing (type-only)
- Used by: All other layers

## Data Flow

### Primary Request Path (Generate Flow)

1. User clicks "Sign in with GitHub" → browser navigates to `/api/github/oauth/start` (`api/github/oauth/start.ts`)
2. OAuth callback returns `?github_token=...` in URL → `useEffect` in `src/App.tsx` stores token to `localStorage`
3. `useEffect` fires `loadRepos(token)` → calls `fetchRepositories()` + `fetchViewer()` in parallel (`src/features/github/client.ts`)
4. Raw GitHub API response normalized via `normalizeGitHubRepo()` (`src/features/github/normalize.ts`) → stored as `RepoRecord[]` in `repos` state
5. User clicks a repo → `selectRepo()` fires `fetchRepositoryDetails()` + `fetchRepositoryReadme()` in parallel (`src/features/github/client.ts`)
6. Details re-normalized with word count; `activeRepo` state updated with decoded README content
7. User clicks "Generate Beautified README" → `handleGenerate()` calls `generateSuggestions()` (`src/features/ai/client.ts`)
8. `generateSuggestions()` POSTs to `/api/generate` → `api/generate.ts` builds prompt, calls OpenRouter, parses response
9. Normalized `AiSuggestions` returned → stored in `generated` state; UI renders preview panels
10. User clicks "Update README on GitHub" → `confirmReadmeUpdate()` sets `pendingAction`
11. User confirms in modal → `runPendingAction()` calls `updateRepositoryReadme()` (`src/features/github/client.ts`) → refreshes repo

### Write-Back Path

1. `confirmReadmeUpdate()` or `confirmMetadataUpdate()` populates `pendingAction` with a `{ title, body, confirmLabel, run }` object (`src/App.tsx:466–505`)
2. `ConfirmationModal` renders; user must click confirm
3. `runPendingAction()` executes `pendingAction.run()` which calls `updateRepositoryReadme()` or `updateRepositoryMetadata()` (`src/features/github/client.ts:83–155`)
4. On success, `selectRepo()` re-fetches the repo to refresh state

**State Management:**
- All state is local React state in `src/App.tsx` (`useState`)
- No Redux, Zustand, or React Context
- `githubToken` and `theme` are persisted to `localStorage` (keys: `gittidy.github-token`, `gittidy.theme`)
- `generated` is ephemeral — lost on page reload or repo switch

## Key Abstractions

**`RepoRecord`:**
- Purpose: Canonical repository shape used throughout the frontend
- Location: `src/types/repo.ts`
- Pattern: Normalized at fetch time; includes pre-computed `score`, `scoreBreakdown`, `issues`, `insights`

**`GitHubClientError`:**
- Purpose: Typed error class with HTTP `status` for distinguishing auth/rate-limit errors
- Location: `src/features/github/client.ts:9–17`
- Pattern: Thrown by all GitHub client functions; caught in `App.tsx` via `resolveError()`

**`PendingAction`:**
- Purpose: Deferred write intent — stores the confirmation text and the `run()` async function
- Location: `src/App.tsx:39–44` (type), `src/App.tsx:466–505` (construction)
- Pattern: Set on intent → rendered by `ConfirmationModal` → executed by `runPendingAction()`

**`AiSuggestions`:**
- Purpose: Typed output of the AI generation pipeline
- Location: `src/features/ai/types.ts`
- Fields: `readmeMd`, `description`, `topics[]`, `deploySuggestion`, `repoName`

**`scoreRepository()`:**
- Purpose: Pure function computing quality score from four signals
- Location: `src/features/repos/scoring.ts:15`
- Pattern: Called from `normalize.ts` and `mock-data.ts`; never called with stale data

## Entry Points

**Browser SPA:**
- Location: `src/main.tsx`
- Triggers: Vite dev server or production build load
- Responsibilities: Mounts `<App />` in React StrictMode

**OAuth Start:**
- Location: `api/github/oauth/start.ts`
- Triggers: User navigation to `/api/github/oauth/start`
- Responsibilities: Read `GITHUB_CLIENT_ID`, generate CSRF state UUID, set HttpOnly cookie, redirect to GitHub

**OAuth Callback:**
- Location: `api/github/oauth/callback.ts`
- Triggers: GitHub redirects back after authorization
- Responsibilities: Validate CSRF state, exchange code for token, clear state cookie, redirect to `/?github_token=...`

**AI Generation:**
- Location: `api/generate.ts`
- Triggers: POST from `src/features/ai/client.ts`
- Responsibilities: Build system + user prompt, call OpenRouter with 45s timeout, parse and normalize JSON response

**Context Inference (unused in UI):**
- Location: `api/context.ts`
- Triggers: POST from `src/features/ai/client.ts:inferContext()` (not called by `App.tsx`)
- Responsibilities: Infer generation context from multiple repos via OpenRouter

## Architectural Constraints

- **No routing:** Single-page app, no React Router. All views are conditional renders within `src/App.tsx`.
- **No global state:** All state is local to `src/App.tsx`. Feature modules are stateless.
- **Serverless isolation:** `api/` functions do not import from `src/`. Any shared logic must be duplicated (e.g., `parseModelJson` and `readEnvValue` are duplicated between `api/generate.ts` and `api/context.ts`).
- **Token in URL:** GitHub OAuth token is passed via `?github_token=` query param, then immediately moved to `localStorage` and the URL is cleaned via `history.replaceState`. This is a known tradeoff documented in the codebase.
- **README truncation:** READMEs are truncated to 7,000 characters before AI prompting (`src/App.tsx:787–790`).
- **Write guard:** All GitHub write operations require `pendingAction` to be set and user confirmation. This is non-negotiable by design.

## Anti-Patterns

### Monolithic App Component

**What happens:** `src/App.tsx` is 792 lines and contains state declarations, all async handlers, helper components (`EmptyState`, `Checklist`, `ReadmePanel`, `ConfirmationModal`), and pure utility functions (`calculateScore`, `buttonClass`, `inputClass`).

**Why it's wrong:** Makes the file hard to navigate; utility components defined inline cannot be independently tested or reused; adding new features increases file size further.

**Do this instead:** Extract inline components (`ConfirmationModal`, `Checklist`, etc.) to `src/components/` or feature-specific `components/` directories. Move pure utilities (`buttonClass`, `inputClass`) to `src/lib/utils.ts`. The unused components in `src/components/` (`app-shell.tsx`, `panel.tsx`, `score-ring.tsx`) show the intended direction.

### Token in URL Parameter

**What happens:** GitHub OAuth callback returns the access token as a query string parameter (`/?github_token=...`). The token is visible in browser history before `history.replaceState` clears it.

**Why it's wrong:** Tokens in URLs appear in server logs, browser history, and referrer headers.

**Do this instead:** Set the token in a server-side HttpOnly cookie during the callback, then read it from the cookie on the frontend, or use a short-lived code exchanged via a secure API call.

### Duplicated Serverless Utilities

**What happens:** `parseModelJson`, `callOpenRouter`, `readEnvValue`, `statusError`, `resolveStatus`, and `previewText` are copy-pasted between `api/generate.ts` and `api/context.ts`.

**Why it's wrong:** Bug fixes or behavior changes must be applied in both files.

**Do this instead:** Extract shared serverless utilities to `api/lib/` (e.g., `api/lib/openrouter.ts`, `api/lib/env.ts`) and import from there.

## Error Handling

**Strategy:** Errors are caught at the call site in `App.tsx` and displayed as a string message in the `message` state variable, which renders an amber banner.

**Patterns:**
- `GitHubClientError` — typed error from `src/features/github/client.ts` with `status`; checked via `instanceof` in `resolveError()`
- Standard `Error` — also caught by `resolveError()`; message surfaced directly
- `rawContent` error property — AI parse failures attach the raw AI response string; `App.tsx` stores it in `debugRawAi` and renders a dismissible debug panel

## Cross-Cutting Concerns

**Logging:** No structured logging. `console.*` is not used in production code paths.
**Validation:** No runtime schema validation (no Zod). Types are TypeScript-only compile-time checks. AI responses are validated by duck-typing (`isPromptResult`, `isPreviewEnvelope` in `api/generate.ts`).
**Authentication:** GitHub OAuth token stored in `localStorage`. Passed explicitly as a function parameter through all GitHub client calls — never stored as a module-level singleton.

---

*Architecture analysis: 2026-05-09*
