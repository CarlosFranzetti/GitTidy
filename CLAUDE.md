# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitTidy is a web application that helps students and indie developers improve their GitHub repository presentation. It connects to GitHub via OAuth, analyzes repository quality (README, description, topics, deploy links), and uses AI (OpenRouter with Baidu Qianfan CoBuddy) to generate improved versions of these elements. Users can preview changes before writing back to GitHub.

**Live deployment:** https://git-tidy.vercel.app

## Build, Lint, and Development Commands

### Common Commands

```bash
# Install dependencies
npm install

# Frontend-only development (UI work, no API)
npm run dev
# Opens at http://localhost:5173

# Full-stack development (requires .env.local with API keys)
npm run dev:full
# Runs Vite + Vercel serverless functions
# Opens at http://localhost:3000

# Build and type-check
npm run build

# Lint TypeScript and React code
npm run lint

# Preview production build
npm run preview

# Pull Vercel environment variables to .env.local
npm run vercel:pull --yes --environment=development
```

### Development Environment Setup

Create `.env.local` in the project root with:
```env
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=baidu/cobuddy:free
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
```

For local GitHub OAuth testing, register a GitHub OAuth app with callback URL:
```
http://localhost:3000/api/github/oauth/callback
```

Note: `OPENROUTER_API_KEY` is server-only (not prefixed with `VITE_`); it is read in Vercel serverless functions and `.env.local`.

## High-Level Architecture

### Frontend (React + TypeScript + Tailwind CSS)

**Main entry:** `src/App.tsx` - Single monolithic component handling all state and UI logic.

**Features directory structure:**
- `src/features/github/` - GitHub API client, response normalization, write operations
  - `client.ts` - Fetch repos, README, metadata; update repo description/topics/homepage/README
  - `normalize.ts` - Convert GitHub API responses to `RepoRecord` type and calculate scoring
  - `types.ts` - GitHub API response types
  
- `src/features/repos/` - Repository selection and quality scoring
  - `scoring.ts` - Calculates a 0-100 score based on README word count, description, homepage, and topics
  - `mock-data.ts` - Fallback mock repositories for development/testing
  
- `src/features/ai/` - AI generation and context inference
  - `client.ts` - Wrapper around `/api/generate` and `/api/context` POST endpoints
  - `types.ts` - Request/response types for AI operations
  - `components/ai-output-panel.tsx` - UI for displaying generated suggestions

**Utility modules:**
- `src/lib/clipboard.ts` - Copy text to clipboard
- `src/lib/utils.ts` - Helper functions
- `src/types/repo.ts` - Core `RepoRecord` type used throughout the app

**Flow:**
1. User clicks "Sign in with GitHub" → calls `/api/github/oauth/start` to initiate OAuth flow
2. OAuth callback returns `github_token` in URL, stored in `localStorage`
3. `useEffect` loads repos when token is available via `fetchRepositories(token)`
4. User selects repo → fetches README, details, calculates score
5. User clicks "Generate Beautified README" → calls `/api/generate` with repo data and context
6. AI returns improved README, description, topics, deploy suggestion
7. User can copy or write changes back to GitHub with confirmation modal

### Backend (Vercel Serverless)

**API routes:** Located in `api/` directory, deployed as Vercel Functions.

- `api/github/oauth/start.ts` - Initiates GitHub OAuth, sets CSRF state in HttpOnly cookie
- `api/github/oauth/callback.ts` - Exchanges OAuth code for access token, validates state, redirects home with token in URL
- `api/generate.ts` - POST endpoint that calls OpenRouter with system + user prompt, returns improved README/description/topics/deploy suggestion
- `api/context.ts` - POST endpoint (not currently used in UI) that infers project context from selected repos

**Key pattern:** All serverless functions read `OPENROUTER_API_KEY` and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` from environment at request time, checking both `process.env` and `.env.local`.

### TypeScript Configuration

Two separate `tsconfig` files:
- `tsconfig.app.json` - React/frontend (target: ES2023, jsx: react-jsx)
- `tsconfig.node.json` - Vite config and serverless functions (target: ES2023)
- `tsconfig.json` - Root config that references both via `references`

Both enforce:
- `noUnusedLocals` and `noUnusedParameters`
- `noFallthroughCasesInSwitch`
- `erasableSyntaxOnly` (only TypeScript syntax, no runtime transforms)
- Bundler module resolution

### Styling

- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Dark/Light theme:** Toggled in header, stored in `localStorage` (key: `gittidy.theme`)
- Theme-aware class names hardcoded in components (no CSS-in-JS or pre-built theme system)

### Linting

ESLint with flat config (`eslint.config.js`):
- `@eslint/js` (JavaScript recommended rules)
- `typescript-eslint` (TypeScript rules)
- `eslint-plugin-react-hooks` (React hooks rules)
- `eslint-plugin-react-refresh` (Vite refresh rules)

## State Management & Data Flow

All state lives in `App.tsx` as local React state (no global state library):
- `githubToken` - OAuth token stored in localStorage
- `repos` - List of user's repositories
- `activeRepo` - Currently selected repo with README and loading state
- `generated` - AI-generated suggestions (README, description, topics, deploy suggestion)
- `pendingAction` - Confirmation modal state before writing to GitHub
- `theme`, `isGenerating`, `isLoadingRepos`, `isWriting`, `message`, `copyMessage` - UI state

This is intentional to avoid premature complexity. If multi-page routing or deeply nested state sharing becomes necessary, consider refactoring.

## Key Design Decisions

1. **No automatic writes** - All GitHub writes require explicit user confirmation via modal. This is a core safety principle.

2. **Score-based repo quality** - Scoring algorithm in `scoring.ts` is deterministic:
   - README: 0-35 points (0 words = 0, 20+ = 14, 80+ = 26, 180+ = 35)
   - Description: 0 or 20 points (exists or missing)
   - Homepage: 0 or 20 points (exists or missing)
   - Topics: 0-25 points (0 = 0, 1 = 8, 2-3 = 16, 4+ = 25)
   - Max score: 100

3. **README truncation** - Long READMEs are truncated to 7000 characters for the AI prompt to control token usage.

4. **AI JSON parsing** - `api/generate.ts` and `api/context.ts` defensively parse AI responses, extracting JSON from markdown fences if present.

5. **Context inference** - Currently unused endpoint (`/api/context`), but infrastructure is present for future multi-repo batch analysis.

6. **Base64 encoding for writes** - GitHub API requires base64-encoded file content. `encodeBase64Content()` and `decodeBase64Content()` handle this with proper UTF-8 support.

## Notable Patterns

- **Error handling:** `GitHubClientError` class with status codes; detailed HTTP error messages mapped by status (401 = auth failed, 403 = permission/rate limit, etc.)
- **Async/await:** All async operations are awaited; errors are caught and displayed in UI messages
- **Token management:** Token is passed explicitly through function calls, not stored globally
- **Confirmation flow:** Changes go through `pendingAction` state to trigger a modal before execution
- **Repo data normalization:** GitHub API responses are immediately normalized to `RepoRecord` type in `normalize.ts`

## File Organization Notes

- `src/components/` - Small, reusable UI primitives (not feature-specific)
- `src/features/*/` - Feature modules with their own client code, types, and components
- `src/lib/` - Generic utilities not tied to features
- `src/types/` - Shared types used across features
- `api/` - Serverless functions (deployed separately as Vercel Functions)

## Environment Variables Summary

| Variable | Required | Type | Usage |
|----------|----------|------|-------|
| `OPENROUTER_API_KEY` | Yes | Server-only | AI generation in serverless functions |
| `OPENROUTER_MODEL` | No (defaults to `baidu/cobuddy:free`) | Server-only | LLM model selection |
| `GITHUB_CLIENT_ID` | Yes | Public | OAuth flow initiation |
| `GITHUB_CLIENT_SECRET` | Yes | Private | OAuth token exchange |

## Deployment

The app is deployed on Vercel:
- Frontend build: `npm run build` (Vite output to `dist/`)
- Serverless functions: Files in `api/` are automatically deployed as Vercel Functions
- Environment variables configured in Vercel project settings (not in `.env.local`)

<!-- GSD:project-start source:PROJECT.md -->
## Project

**GitTidy**

GitTidy is a web app for students and indie developers that connects to GitHub via OAuth, analyzes repository quality (README, description, topics, deploy link), and uses AI to generate improved versions of those elements. Users preview AI suggestions and selectively apply changes back to GitHub — they choose exactly what gets written.

**Core Value:** A user can review AI-generated improvements and write only the pieces they want back to GitHub, with full control over what changes.

### Constraints

- **Tech stack**: Must stay within React 19 + TypeScript + Tailwind CSS v4 — no new UI libraries
- **Write guard**: All GitHub writes must remain behind a confirmation step — non-negotiable safety principle
- **No global state**: All state stays local in App.tsx unless explicitly refactored
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 6.0.2 - All frontend (React components, hooks, utilities) and all backend serverless functions in `api/`
- None detected (no Python, Go, Rust, etc.)
## Runtime
- Node.js (version unspecified; inferred from `@types/node ^24.12.2` dev dependency)
- Browser (ES2023 target with DOM lib for frontend code)
- npm
- Lockfile: `package-lock.json` (present — confirmed by node_modules/ presence)
## Frameworks
- React 19.2.5 - UI framework; single-page application with no router
- Tailwind CSS 4.2.4 - Utility-first styling, integrated via `@tailwindcss/vite` plugin
- Vite 8.0.10 - Frontend bundler and dev server; config at `vite.config.ts`
- Vercel CLI 53.2.0 - Full-stack local dev via `vercel dev`; also handles deployment
## Key Dependencies
- `react` ^19.2.5 - Core UI runtime
- `react-dom` ^19.2.5 - DOM rendering
- `@vitejs/plugin-react` ^6.0.1 - Vite plugin for React JSX transform and Fast Refresh
- `@tailwindcss/vite` ^4.2.4 - Tailwind CSS v4 integration as Vite plugin
- `typescript` ~6.0.2 - TypeScript compiler; drives `npm run build` type-checking via `tsc -b`
- `vercel` ^53.2.0 - Local dev server for serverless functions; also used for env var sync
- `eslint` ^10.2.1 - Flat config format (`eslint.config.js`)
- `typescript-eslint` ^8.58.2 - TypeScript-aware lint rules
- `eslint-plugin-react-hooks` ^7.1.1 - Enforces React hooks rules
- `eslint-plugin-react-refresh` ^0.5.2 - Vite Fast Refresh compatibility rules
- `@eslint/js` ^10.1.0 - Core JavaScript recommended rules
- `globals` ^17.5.0 - Global variable definitions for browser/node environments
- `@types/node` ^24.12.2 - Node.js types for serverless functions
- `@types/react` ^19.2.14 - React TypeScript types
- `@types/react-dom` ^19.2.3 - ReactDOM TypeScript types
- No third-party SDK — OpenRouter is called via native `fetch()` in `api/generate.ts` and `api/context.ts`
- No third-party SDK — GitHub API is called via native `fetch()` in `src/features/github/client.ts`
## Configuration
- `tsconfig.json` - Root, references `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` - Frontend: target ES2023, lib DOM, jsx react-jsx, includes `src/`
- `tsconfig.node.json` - Backend/Vite config: target ES2023, lib Node, includes `vite.config.ts`
- Both enforce `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`
- Both use `moduleResolution: bundler`
- `.env.local` — local secrets file (present, not committed)
- `.env.example` — template with all required keys (committed)
- Serverless functions read env via `process.env` with fallback to `.env.local` file parsing (`readEnvValue()`)
- `npm run build` → `tsc -b && vite build` → output to `dist/`
- `npm run dev` → Vite only (frontend, port 5173)
- `npm run dev:full` → `vercel dev` (frontend + serverless functions, port 3000)
## Platform Requirements
- Node.js (latest LTS implied by `@types/node ^24`)
- npm
- Vercel CLI for full-stack local development
- `.env.local` with `OPENROUTER_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- GitHub OAuth app with callback set to `http://localhost:3000/api/github/oauth/callback`
- Vercel (frontend + serverless functions deployed together)
- Environment variables configured in Vercel project settings
- Serverless functions live in `api/` directory, auto-deployed as Vercel Functions
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React component files: `kebab-case.tsx` (e.g., `ai-output-panel.tsx`, `status-badge.tsx`, `score-ring.tsx`)
- Non-component TypeScript files: `kebab-case.ts` (e.g., `client.ts`, `normalize.ts`, `mock-data.ts`)
- Type definition files: `types.ts` (one per feature directory)
- Utility files: `kebab-case.ts` under `src/lib/` (e.g., `clipboard.ts`, `utils.ts`)
- camelCase for all functions (e.g., `fetchRepositories`, `normalizeGitHubRepo`, `scoreRepository`)
- Async operations named with action verb prefix: `fetch*`, `load*`, `update*`, `handle*`, `confirm*`
- UI-triggered handlers prefixed `handle` in `App.tsx` (e.g., `handleGenerate`, `handleCopyReadme`)
- Confirmation flow setup functions prefixed `confirm` (e.g., `confirmReadmeUpdate`, `confirmMetadataUpdate`)
- Pure helper/utility functions descriptively named (e.g., `resolveErrorMessage`, `resolveError`, `truncateForPrompt`, `countWords`, `splitFullName`)
- camelCase throughout (e.g., `githubToken`, `activeRepo`, `isGenerating`)
- Boolean state variables prefixed `is*` (e.g., `isLoadingRepos`, `isGenerating`, `isWriting`)
- State setter callbacks use `current` as parameter name for functional updates (e.g., `setRepos((current) => ...)`)
- PascalCase for all type aliases and interfaces (e.g., `RepoRecord`, `AiSuggestions`, `GitHubClientError`)
- API response types suffixed `Response` (e.g., `GitHubRepoResponse`, `GenerateSuggestionsResponse`)
- API request types suffixed `Request` (e.g., `GenerateSuggestionsRequest`, `InferContextRequest`)
- Props types suffixed `Props` (e.g., `PanelProps`, `StatusBadgeProps`, `AiOutputPanelProps`, `AiSectionProps`)
- Internal helper types in module scope without export (e.g., `ScoreInput`, `SeedRepo`, `GitTreeResponse`)
- UPPER_SNAKE_CASE for module-level constants (e.g., `STORAGE_KEY`, `THEME_KEY`, `README_MAX`, `GITHUB_API_BASE`)
## Code Style
- No Prettier config present; formatting is not enforced by tooling
- Single quotes for string literals
- Trailing commas in multi-line structures
- 2-space indentation (consistent throughout)
- Arrow functions with explicit return types omitted (TypeScript inference used)
- ESLint with flat config at `eslint.config.js`
- Plugins: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- TypeScript strict flags enforced at compile time: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`
- `verbatimModuleSyntax` enforced: always use `import type` for type-only imports (e.g., `import type { RepoRecord } from './types/repo'`)
## Import Organization
- No path aliases configured; imports use relative paths throughout
- Always use `import type` for types; enforced by `verbatimModuleSyntax`
- Example from `src/App.tsx`:
## Error Handling
- Custom error class `GitHubClientError` in `src/features/github/client.ts` with a `status: number` field
- Error resolution helper `resolveError(error, fallback)` in `App.tsx` checks `instanceof GitHubClientError | Error`, falling back to a string
- All async handlers in `App.tsx` use try/catch/finally blocks
- Errors display in a `message` state string rendered as a banner; cleared at start of each operation
- Clipboard failures caught silently with a user-visible `copyMessage` fallback
- HTTP status propagated via a `statusError(message, status)` helper that attaches `status` to the Error object
- `resolveStatus(error)` extracts numeric status or defaults to 500
- `rawContent` field attached to errors when AI response JSON parsing fails, forwarded to client for debug display
- Type narrowing via duck-type guards (e.g., `'rawContent' in error && typeof error.rawContent === 'string'`) rather than custom error classes
## Logging
- No `console.log` or `console.error` calls in the codebase
- Errors are surfaced in UI via `message` state (banner) or `copyMessage` state (inline feedback)
- Debug AI output forwarded to a `DebugPanel` component rendered conditionally when `debugRawAi` state is set
## Comments
- No inline comments observed in source files; code is written to be self-documenting
- No JSDoc/TSDoc annotations present on any functions or types
- Not used — type signatures serve as documentation
## Function Design
- Utility/pure functions are small (under 15 lines): `countWords`, `truncateForPrompt`, `splitFullName`, `resolveError`
- Async handler functions in `App.tsx` stay focused on a single operation (e.g., `loadRepos`, `selectRepo`, `handleGenerate`)
- Helper functions extracted from the main component and placed at module scope (not inside the component body), e.g., `buttonClass`, `inputClass`, `calculateScore`, `toGenerationInput`
- Object destructuring for multi-param async operations (e.g., `updateRepositoryReadme(input: { owner, repo, token, content, sha? })`)
- Single token string parameter for read-only GitHub calls (e.g., `fetchRepositories(token: string)`)
- Discriminated union types avoided; explicit typed returns preferred
- Async functions always `await` and return typed results
- `void` operator used for fire-and-forget event handlers (e.g., `onClick={() => void handleGenerate()}`) to satisfy TypeScript no-floating-promises expectations without try/catch at call site
## Module Design
- Named exports for functions and types
- Single default export only for Vercel serverless `handler` functions (`api/*.ts`) and the React root component (`src/App.tsx`)
- Feature client files (`src/features/*/client.ts`) export only the public API surface; internal helpers are unexported
- Not used; imports always reference the specific module file directly (e.g., `import { scoreRepository } from '../repos/scoring'`)
## React Patterns
- Small presentational sub-components defined as named functions at the bottom of `App.tsx` (e.g., `EmptyState`, `Checklist`, `ReadmePanel`, `ConfirmationModal`)
- Reusable primitive components in `src/components/` are exported as named functions (e.g., `Panel`, `StatusBadge`, `AppShell`)
- Feature-specific components in `src/features/*/components/`
- All state centralized in `App.tsx` as local `useState`; no global state library
- State lazy initializers used for localStorage reads (e.g., `useState(() => localStorage.getItem(THEME_KEY))`)
- Class generation functions used for repeated class patterns (e.g., `buttonClass(theme, variant, extra?)`, `inputClass(theme)`)
- Theme-aware classes hardcoded inline; no CSS variables or theme tokens
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- All client state lives in `src/App.tsx` as local React state (no global store, no Context)
- Feature modules under `src/features/` own their API client, types, and sub-components
- Serverless functions in `api/` are the only server-side boundary; they proxy to OpenRouter and GitHub OAuth
- GitHub writes are always guarded by a `pendingAction` confirmation modal — no automatic writes
- Scoring is computed client-side synchronously; no server round-trip required
## Layers
- Purpose: Render all views; manage all local React state
- Location: `src/App.tsx`
- Contains: State declarations, event handlers, JSX, inline helper components (`EmptyState`, `Checklist`, `ReadmePanel`, `PreviewMeta`, `DebugPanel`, `ConfirmationModal`)
- Depends on: feature clients, lib utilities, shared types
- Used by: `src/main.tsx` (React root mount)
- Purpose: Typed wrappers around external HTTP APIs; all async I/O
- Location: `src/features/github/client.ts`, `src/features/ai/client.ts`
- Contains: Fetch calls, error classes (`GitHubClientError`), base64 encode/decode helpers
- Depends on: Shared types; no React
- Used by: `src/App.tsx`
- Purpose: Convert raw API responses to the canonical `RepoRecord` shape
- Location: `src/features/github/normalize.ts`
- Contains: `normalizeGitHubRepo()`, `buildInsights()`; calls `scoreRepository()`
- Depends on: `src/features/repos/scoring.ts`, `src/types/repo.ts`, `src/features/github/types.ts`
- Used by: `src/App.tsx` (after every fetch)
- Purpose: Deterministic quality score computation
- Location: `src/features/repos/scoring.ts`
- Contains: `scoreRepository()` — pure function, no side effects
- Depends on: `src/types/repo.ts` (types only)
- Used by: `src/features/github/normalize.ts`, `src/features/repos/mock-data.ts`
- Purpose: Server-only secrets, AI proxy, GitHub OAuth exchange
- Location: `api/generate.ts`, `api/context.ts`, `api/github/oauth/start.ts`, `api/github/oauth/callback.ts`
- Contains: Vercel request handlers, OpenRouter calls, env var readers (checks `process.env` then `.env.local`)
- Depends on: No shared `src/` code — fully self-contained
- Used by: Browser fetch calls from `src/features/ai/client.ts` and direct navigation for OAuth
- Purpose: Canonical domain types shared across all layers
- Location: `src/types/repo.ts`, `src/features/ai/types.ts`, `src/features/github/types.ts`
- Contains: `RepoRecord`, `RepoIssue`, `AiSuggestions`, `GenerateSuggestionsRequest`, GitHub API response shapes
- Depends on: Nothing (type-only)
- Used by: All other layers
## Data Flow
### Primary Request Path (Generate Flow)
### Write-Back Path
- All state is local React state in `src/App.tsx` (`useState`)
- No Redux, Zustand, or React Context
- `githubToken` and `theme` are persisted to `localStorage` (keys: `gittidy.github-token`, `gittidy.theme`)
- `generated` is ephemeral — lost on page reload or repo switch
## Key Abstractions
- Purpose: Canonical repository shape used throughout the frontend
- Location: `src/types/repo.ts`
- Pattern: Normalized at fetch time; includes pre-computed `score`, `scoreBreakdown`, `issues`, `insights`
- Purpose: Typed error class with HTTP `status` for distinguishing auth/rate-limit errors
- Location: `src/features/github/client.ts:9–17`
- Pattern: Thrown by all GitHub client functions; caught in `App.tsx` via `resolveError()`
- Purpose: Deferred write intent — stores the confirmation text and the `run()` async function
- Location: `src/App.tsx:39–44` (type), `src/App.tsx:466–505` (construction)
- Pattern: Set on intent → rendered by `ConfirmationModal` → executed by `runPendingAction()`
- Purpose: Typed output of the AI generation pipeline
- Location: `src/features/ai/types.ts`
- Fields: `readmeMd`, `description`, `topics[]`, `deploySuggestion`, `repoName`
- Purpose: Pure function computing quality score from four signals
- Location: `src/features/repos/scoring.ts:15`
- Pattern: Called from `normalize.ts` and `mock-data.ts`; never called with stale data
## Entry Points
- Location: `src/main.tsx`
- Triggers: Vite dev server or production build load
- Responsibilities: Mounts `<App />` in React StrictMode
- Location: `api/github/oauth/start.ts`
- Triggers: User navigation to `/api/github/oauth/start`
- Responsibilities: Read `GITHUB_CLIENT_ID`, generate CSRF state UUID, set HttpOnly cookie, redirect to GitHub
- Location: `api/github/oauth/callback.ts`
- Triggers: GitHub redirects back after authorization
- Responsibilities: Validate CSRF state, exchange code for token, clear state cookie, redirect to `/?github_token=...`
- Location: `api/generate.ts`
- Triggers: POST from `src/features/ai/client.ts`
- Responsibilities: Build system + user prompt, call OpenRouter with 45s timeout, parse and normalize JSON response
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
### Token in URL Parameter
### Duplicated Serverless Utilities
## Error Handling
- `GitHubClientError` — typed error from `src/features/github/client.ts` with `status`; checked via `instanceof` in `resolveError()`
- Standard `Error` — also caught by `resolveError()`; message surfaced directly
- `rawContent` error property — AI parse failures attach the raw AI response string; `App.tsx` stores it in `debugRawAi` and renders a dismissible debug panel
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
