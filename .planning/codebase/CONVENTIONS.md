# Coding Conventions

**Analysis Date:** 2026-05-09

## Naming Patterns

**Files:**
- React component files: `kebab-case.tsx` (e.g., `ai-output-panel.tsx`, `status-badge.tsx`, `score-ring.tsx`)
- Non-component TypeScript files: `kebab-case.ts` (e.g., `client.ts`, `normalize.ts`, `mock-data.ts`)
- Type definition files: `types.ts` (one per feature directory)
- Utility files: `kebab-case.ts` under `src/lib/` (e.g., `clipboard.ts`, `utils.ts`)

**Functions:**
- camelCase for all functions (e.g., `fetchRepositories`, `normalizeGitHubRepo`, `scoreRepository`)
- Async operations named with action verb prefix: `fetch*`, `load*`, `update*`, `handle*`, `confirm*`
- UI-triggered handlers prefixed `handle` in `App.tsx` (e.g., `handleGenerate`, `handleCopyReadme`)
- Confirmation flow setup functions prefixed `confirm` (e.g., `confirmReadmeUpdate`, `confirmMetadataUpdate`)
- Pure helper/utility functions descriptively named (e.g., `resolveErrorMessage`, `resolveError`, `truncateForPrompt`, `countWords`, `splitFullName`)

**Variables:**
- camelCase throughout (e.g., `githubToken`, `activeRepo`, `isGenerating`)
- Boolean state variables prefixed `is*` (e.g., `isLoadingRepos`, `isGenerating`, `isWriting`)
- State setter callbacks use `current` as parameter name for functional updates (e.g., `setRepos((current) => ...)`)

**Types:**
- PascalCase for all type aliases and interfaces (e.g., `RepoRecord`, `AiSuggestions`, `GitHubClientError`)
- API response types suffixed `Response` (e.g., `GitHubRepoResponse`, `GenerateSuggestionsResponse`)
- API request types suffixed `Request` (e.g., `GenerateSuggestionsRequest`, `InferContextRequest`)
- Props types suffixed `Props` (e.g., `PanelProps`, `StatusBadgeProps`, `AiOutputPanelProps`, `AiSectionProps`)
- Internal helper types in module scope without export (e.g., `ScoreInput`, `SeedRepo`, `GitTreeResponse`)

**Constants:**
- UPPER_SNAKE_CASE for module-level constants (e.g., `STORAGE_KEY`, `THEME_KEY`, `README_MAX`, `GITHUB_API_BASE`)

## Code Style

**Formatting:**
- No Prettier config present; formatting is not enforced by tooling
- Single quotes for string literals
- Trailing commas in multi-line structures
- 2-space indentation (consistent throughout)
- Arrow functions with explicit return types omitted (TypeScript inference used)

**Linting:**
- ESLint with flat config at `eslint.config.js`
- Plugins: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- TypeScript strict flags enforced at compile time: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`
- `verbatimModuleSyntax` enforced: always use `import type` for type-only imports (e.g., `import type { RepoRecord } from './types/repo'`)

## Import Organization

**Order (as observed):**
1. External library imports (e.g., `react`, `@vercel/node`, `node:fs`)
2. Internal feature imports (e.g., `./features/ai/client`)
3. Shared type imports using `import type` (e.g., `import type { RepoRecord } from './types/repo'`)
4. Lib/utility imports (e.g., `./lib/clipboard`)

**Path Aliases:**
- No path aliases configured; imports use relative paths throughout

**Type-only imports:**
- Always use `import type` for types; enforced by `verbatimModuleSyntax`
- Example from `src/App.tsx`:
  ```ts
  import type { AiSuggestions, RepoGenerationInput } from './features/ai/types'
  import type { RepoRecord } from './types/repo'
  ```

## Error Handling

**Client-side:**
- Custom error class `GitHubClientError` in `src/features/github/client.ts` with a `status: number` field
- Error resolution helper `resolveError(error, fallback)` in `App.tsx` checks `instanceof GitHubClientError | Error`, falling back to a string
- All async handlers in `App.tsx` use try/catch/finally blocks
- Errors display in a `message` state string rendered as a banner; cleared at start of each operation
- Clipboard failures caught silently with a user-visible `copyMessage` fallback

**Server-side (Vercel functions):**
- HTTP status propagated via a `statusError(message, status)` helper that attaches `status` to the Error object
- `resolveStatus(error)` extracts numeric status or defaults to 500
- `rawContent` field attached to errors when AI response JSON parsing fails, forwarded to client for debug display
- Type narrowing via duck-type guards (e.g., `'rawContent' in error && typeof error.rawContent === 'string'`) rather than custom error classes

**Pattern for unknown errors:**
```ts
} catch (error: unknown) {
  setMessage(resolveError(error, 'GitHub connection failed.'))
}
```

## Logging

**Framework:** None — no logging library is used

**Patterns:**
- No `console.log` or `console.error` calls in the codebase
- Errors are surfaced in UI via `message` state (banner) or `copyMessage` state (inline feedback)
- Debug AI output forwarded to a `DebugPanel` component rendered conditionally when `debugRawAi` state is set

## Comments

**When to Comment:**
- No inline comments observed in source files; code is written to be self-documenting
- No JSDoc/TSDoc annotations present on any functions or types

**JSDoc/TSDoc:**
- Not used — type signatures serve as documentation

## Function Design

**Size:**
- Utility/pure functions are small (under 15 lines): `countWords`, `truncateForPrompt`, `splitFullName`, `resolveError`
- Async handler functions in `App.tsx` stay focused on a single operation (e.g., `loadRepos`, `selectRepo`, `handleGenerate`)
- Helper functions extracted from the main component and placed at module scope (not inside the component body), e.g., `buttonClass`, `inputClass`, `calculateScore`, `toGenerationInput`

**Parameters:**
- Object destructuring for multi-param async operations (e.g., `updateRepositoryReadme(input: { owner, repo, token, content, sha? })`)
- Single token string parameter for read-only GitHub calls (e.g., `fetchRepositories(token: string)`)

**Return Values:**
- Discriminated union types avoided; explicit typed returns preferred
- Async functions always `await` and return typed results
- `void` operator used for fire-and-forget event handlers (e.g., `onClick={() => void handleGenerate()}`) to satisfy TypeScript no-floating-promises expectations without try/catch at call site

## Module Design

**Exports:**
- Named exports for functions and types
- Single default export only for Vercel serverless `handler` functions (`api/*.ts`) and the React root component (`src/App.tsx`)
- Feature client files (`src/features/*/client.ts`) export only the public API surface; internal helpers are unexported

**Barrel Files:**
- Not used; imports always reference the specific module file directly (e.g., `import { scoreRepository } from '../repos/scoring'`)

## React Patterns

**Component structure:**
- Small presentational sub-components defined as named functions at the bottom of `App.tsx` (e.g., `EmptyState`, `Checklist`, `ReadmePanel`, `ConfirmationModal`)
- Reusable primitive components in `src/components/` are exported as named functions (e.g., `Panel`, `StatusBadge`, `AppShell`)
- Feature-specific components in `src/features/*/components/`

**State:**
- All state centralized in `App.tsx` as local `useState`; no global state library
- State lazy initializers used for localStorage reads (e.g., `useState(() => localStorage.getItem(THEME_KEY))`)

**Tailwind:**
- Class generation functions used for repeated class patterns (e.g., `buttonClass(theme, variant, extra?)`, `inputClass(theme)`)
- Theme-aware classes hardcoded inline; no CSS variables or theme tokens

---

*Convention analysis: 2026-05-09*
