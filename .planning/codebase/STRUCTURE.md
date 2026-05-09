# Codebase Structure

**Analysis Date:** 2026-05-09

## Directory Layout

```
GitTidy/
├── api/                        # Vercel serverless functions (Node.js runtime)
│   ├── generate.ts             # POST /api/generate — AI README generation
│   ├── context.ts              # POST /api/context — context inference (unused in UI)
│   └── github/
│       └── oauth/
│           ├── start.ts        # GET /api/github/oauth/start — OAuth initiation
│           └── callback.ts     # GET /api/github/oauth/callback — token exchange
├── src/                        # React frontend (browser)
│   ├── main.tsx                # React root mount
│   ├── App.tsx                 # Monolithic SPA component — all state and UI
│   ├── index.css               # Global styles (Tailwind CSS v4 entry point)
│   ├── assets/                 # Static images (hero.png, SVG logos)
│   ├── components/             # Reusable UI primitives (partially used)
│   │   ├── app-shell.tsx       # Outer layout shell with header and metrics
│   │   ├── panel.tsx           # Generic bordered panel wrapper
│   │   ├── score-ring.tsx      # Circular score visualization
│   │   └── status-badge.tsx    # Inline status tag component
│   ├── features/               # Feature modules (client + types + sub-components)
│   │   ├── ai/
│   │   │   ├── client.ts       # Wrapper for POST /api/generate and /api/context
│   │   │   ├── types.ts        # AiSuggestions, GenerateSuggestionsRequest/Response
│   │   │   └── components/
│   │   │       └── ai-output-panel.tsx   # AI results display component (not used by App.tsx)
│   │   ├── github/
│   │   │   ├── client.ts       # GitHub REST API calls (fetch, write, OAuth helpers)
│   │   │   ├── normalize.ts    # Convert GitHubRepoResponse → RepoRecord
│   │   │   └── types.ts        # GitHubRepoResponse, GitHubReadmeResponse, GitHubViewerResponse
│   │   └── repos/
│   │       ├── scoring.ts      # scoreRepository() — deterministic 0-100 score
│   │       ├── mock-data.ts    # mockRepos[] for frontend-only dev
│   │       └── components/
│   │           ├── repo-card.tsx    # Single repo list item (not used by App.tsx)
│   │           └── repo-detail.tsx  # Repo detail panel (not used by App.tsx)
│   ├── lib/                    # Generic utilities (not feature-tied)
│   │   ├── clipboard.ts        # copyText() wrapper around navigator.clipboard
│   │   └── utils.ts            # formatUpdatedAt() date formatter
│   └── types/                  # Shared domain types
│       └── repo.ts             # RepoRecord, RepoIssue, RepoScoreBreakdown, RepoInsight
├── public/                     # Static assets served at root
│   ├── favicon.svg
│   └── icons.svg
├── docs/                       # Developer documentation (not deployed)
│   ├── specs/                  # Feature specs
│   ├── superpowers/specs/      # AI agent specs
│   ├── continuation-notes.md
│   ├── file-structure.md
│   ├── implementation-plan.md
│   └── openrouter-prompt.md
├── .planning/                  # GSD planning artifacts (not deployed)
│   └── codebase/               # Codebase map documents
├── dist/                       # Vite build output (generated, not committed)
├── index.html                  # Vite HTML entry point
├── vite.config.ts              # Vite config — react + tailwindcss plugins
├── tsconfig.json               # TypeScript project references root
├── tsconfig.app.json           # Frontend TypeScript config (ESNext, react-jsx)
├── tsconfig.node.json          # Node/serverless TypeScript config
├── eslint.config.js            # ESLint flat config
├── package.json                # npm scripts and dependencies
└── CLAUDE.md                   # Project instructions for AI coding assistants
```

## Directory Purposes

**`api/`:**
- Purpose: Vercel serverless functions — the only server-side code
- Contains: TypeScript files where each file is one HTTP handler (Vercel file-based routing)
- Key files: `generate.ts` (AI proxy), `github/oauth/start.ts`, `github/oauth/callback.ts`
- Note: Does NOT import from `src/`. Self-contained with duplicated utilities.

**`src/features/`:**
- Purpose: Feature-scoped modules, each owning their API client, types, and components
- Contains: Subdirectories named after the feature domain (`ai/`, `github/`, `repos/`)
- Pattern: Each feature exposes a `client.ts` and `types.ts`; optional `components/` subdirectory

**`src/components/`:**
- Purpose: Small, generic, reusable UI primitives not tied to a feature
- Contains: Layout shell, panel, score visualization, badge
- Note: These components exist but are not currently used by `src/App.tsx` — they represent a future refactor direction

**`src/lib/`:**
- Purpose: Generic utilities with no feature dependency
- Contains: `clipboard.ts` (browser clipboard), `utils.ts` (date formatting)

**`src/types/`:**
- Purpose: Shared TypeScript types used by multiple features
- Contains: `repo.ts` — the canonical `RepoRecord` type and all sub-types
- Note: Feature-specific types stay in `src/features/*/types.ts`, not here

**`docs/`:**
- Purpose: Developer reference documentation — not deployed, not served
- Contains: Implementation plans, continuation notes, prompt examples, specs
- Generated: No | Committed: Yes

**`.planning/`:**
- Purpose: GSD planning system artifacts
- Contains: Codebase maps, phase plans
- Generated: Yes (by GSD commands) | Committed: Yes

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM mount — renders `<App />` in `StrictMode`
- `index.html`: Vite HTML shell — references `src/main.tsx` as module entry
- `api/generate.ts`: AI generation serverless handler
- `api/github/oauth/start.ts`: OAuth flow entry point

**Configuration:**
- `vite.config.ts`: Build config with React and Tailwind CSS v4 plugins
- `tsconfig.app.json`: Frontend compiler options
- `tsconfig.node.json`: Node/serverless compiler options
- `eslint.config.js`: ESLint flat config

**Core Logic:**
- `src/App.tsx`: All state management, UI, and orchestration
- `src/features/github/client.ts`: All GitHub REST API calls
- `src/features/github/normalize.ts`: GitHub response → `RepoRecord` conversion
- `src/features/repos/scoring.ts`: Quality score algorithm
- `src/features/ai/client.ts`: AI endpoint client

**Types:**
- `src/types/repo.ts`: Canonical `RepoRecord` — used everywhere in the frontend
- `src/features/ai/types.ts`: AI request/response types
- `src/features/github/types.ts`: GitHub API response shapes

**Testing:**
- No test files present in the repository. No test framework configured.

## Naming Conventions

**Files:**
- Kebab-case for all source files: `app-shell.tsx`, `mock-data.ts`, `score-ring.tsx`
- Serverless functions follow Vercel file-based routing: `api/github/oauth/start.ts` maps to `/api/github/oauth/start`
- Types files are named `types.ts` within each feature directory
- Client files are named `client.ts` within each feature directory

**Directories:**
- Feature directories use kebab-case nouns: `ai/`, `github/`, `repos/`
- Component subdirectories are named `components/` (lowercase)

**TypeScript:**
- Types: PascalCase (`RepoRecord`, `AiSuggestions`, `GitHubClientError`)
- Functions: camelCase (`normalizeGitHubRepo`, `scoreRepository`, `fetchRepositories`)
- Constants: SCREAMING_SNAKE_CASE for module-level constants (`GITHUB_API_BASE`, `README_MAX`, `STORAGE_KEY`)
- React components: PascalCase function declarations (`function EmptyState`, `function Checklist`)

## Where to Add New Code

**New API endpoint:**
- Create `api/<name>.ts` exporting a default Vercel handler function
- Read env vars via `readEnvValue()` (copy pattern from `api/generate.ts:246–262`)
- The URL path matches the file path automatically via Vercel routing

**New GitHub client operation:**
- Add exported async function to `src/features/github/client.ts`
- Use `requestJson<T>()` for GET requests; raw `fetch` for PUT/PATCH/POST
- Throw `GitHubClientError` with status code on failure

**New UI panel or widget:**
- If reusable across features: add to `src/components/`
- If feature-specific: add to `src/features/<feature>/components/`
- Currently, `App.tsx` still defines its own inline components; new code should prefer the `components/` directories

**New feature domain:**
- Create `src/features/<name>/` with `client.ts`, `types.ts`, and optionally `components/`
- Place shared cross-feature types in `src/types/`

**New shared utility:**
- Generic browser util: `src/lib/utils.ts` or new file in `src/lib/`
- Feature-specific helper: inside the feature module file directly

**New shared type:**
- If used by 2+ features: `src/types/repo.ts` (or a new file in `src/types/`)
- If feature-specific: `src/features/<name>/types.ts`

## Special Directories

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes
- Committed: No (in `.gitignore`)

**`.vercel/`:**
- Purpose: Vercel CLI project metadata
- Generated: Yes (by `vercel` CLI)
- Committed: Partially (`project.json` yes, `cache/` no)

**`.planning/`:**
- Purpose: GSD codebase maps and phase plans
- Generated: Yes (by GSD commands)
- Committed: Yes

**`docs/`:**
- Purpose: Human-readable developer notes and specs
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-05-09*
