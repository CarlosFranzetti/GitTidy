# GitTidy — Investigate, Regenerate & Layout Redesign

**Date:** 2026-05-08
**Status:** Approved

---

## Overview

Four coordinated improvements to GitTidy:

1. Two-view layout (repos list → tidy screen)
2. Repo investigation + additional context input
3. Regenerate with clarification
4. OpenRouter JSON reliability (retry + JSON mode)

---

## 1. Layout — Two-View State

### Architecture

Replace the current sidebar + detail split with a `view: 'repos' | 'tidy'` state variable in `App.tsx`. A single conditional render switches between two full-width screens.

### Repos Screen (default view)

- Full-width scrollable list; each row shows: repo name, language, GitTidy score badge, description.
- Clicking a row sets `activeRepo`, triggers the existing `selectRepo` load sequence, and transitions `view` to `'tidy'`.
- Loaded repo state is preserved when the user returns — no redundant API calls if the same repo is re-opened.

### Tidy Screen

- Full-width version of the current detail panel.
- `← Repos` button in the header transitions `view` back to `'repos'`.
- All existing functionality (score, checklist, README panels, write-back buttons) unchanged.

### State changes

- Add `view: 'repos' | 'tidy'` to component state, defaulting to `'repos'`.
- On `selectRepo` success → set `view` to `'tidy'`.
- `← Repos` button → set `view` to `'repos'` (does not clear `activeRepo`).

---

## 2. Repo Investigation + Additional Info

### Auto baseline (always-on)

When `existingReadme` is empty or absent, `api/generate.ts` appends to the user prompt:

```
This repository has no README. Infer its purpose from the repository name, language, topics, and any file structure provided below.
```

This requires no user action and ensures generation never silently fails on empty repos.

### "Investigate repo" button

- Shown in the tidy screen when `readme.trim().length < 100`.
- On click: calls new `fetchRepositoryFileTree(owner, repo, branch, token)` in `src/features/github/client.ts`.
- `fetchRepositoryFileTree` calls `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`, filters results:
  - Only `blob` type items
  - Exclude paths matching: `node_modules/`, `dist/`, `build/`, `.next/`, `__pycache__/`, `.git/`
  - Exclude binary extensions: `.png`, `.jpg`, `.gif`, `.ico`, `.svg`, `.woff`, `.ttf`, `.eot`, `.mp4`, `.zip`, `.lock`
  - Max 150 paths
- Returns `string[]` of file paths.
- Stored as `fileTree?: string[]` on `ActiveRepo` state.
- A small collapsible "File structure" panel renders below the checklist showing the paths.
- `fileTree` is passed through `RepoGenerationInput` to the backend and appended to the user prompt as a newline-separated block.

### Additional info textarea

- Always visible in the tidy screen, labelled **"Extra context for AI (optional)"**.
- Stored as `extraNotes: string` in component state (replaces the current hardcoded `extraNotes` string in `handleGenerate`).
- Passed as `context.extraNotes` in the generation request. Cleared between repo selections.

### Type changes

- `RepoGenerationInput`: add `fileTree?: string[]`
- `ActiveRepo`: add `fileTree?: string[]`

---

## 3. Regenerate with Clarification

### UI

- After a successful generation, a textarea labelled **"What should change in the next draft?"** appears below the action buttons.
- A **"Regenerate"** button sits next to it.
- The textarea is cleared after each regeneration completes.
- No draft history — each regeneration replaces the current draft.

### Data flow

- `refinementNote: string` added to `GenerateSuggestionsRequest` (optional).
- `api/generate.ts` appends to the user prompt when present:
  ```
  User refinement request: {refinementNote}
  ```
- Frontend sends the same repo payload as the first generation plus the refinement note.

### Type changes

- `GenerateSuggestionsRequest`: add `refinementNote?: string`

---

## 4. OpenRouter JSON Reliability

### Three-layer defence

**Layer 1 — JSON mode header**
Add `response_format: { type: "json_object" }` to the OpenRouter request body. Most hosted models suppress freetext wrapping when this is set.

**Layer 2 — `extractJson` (already in place)**
`parseModelJson` already strips markdown fences and finds the first `{` / last `}`. No change.

**Layer 3 — Automatic single retry**
If `parseModelJson` throws on the first attempt, retry once with a stripped-down system prompt:
```
Return only a JSON object matching this shape: {"readme_md":"...","description":"...","topics":["..."],"deploy_suggestion":"..."}. No markdown. No text. Just JSON.
```
Same user prompt. If the retry also fails, the error response includes `rawContent` (already implemented) and the frontend debug panel shows it with the message "GitTidy could not parse the AI response. Try again."

### Backend change summary (`api/generate.ts`)

- Add `response_format` to the OpenRouter request body.
- Extract `parseModelJson` call into a `generateWithRetry` helper that calls `createOpenRouterCompletion` twice at most.
- On second failure, rethrow with `rawContent` attached.

---

## File Change Map

| File | Change |
|---|---|
| `src/App.tsx` | Add `view` state, repos screen, tidy screen, investigate button, extra notes input, regenerate textarea + button |
| `src/features/github/client.ts` | Add `fetchRepositoryFileTree` |
| `src/features/ai/types.ts` | Add `fileTree?` to `RepoGenerationInput`, `refinementNote?` to `GenerateSuggestionsRequest` |
| `src/types/repo.ts` | No change |
| `api/generate.ts` | Add `response_format`, retry logic, `fileTree` + `refinementNote` in user prompt, auto baseline note |

---

## Out of Scope

- Routing (no React Router added)
- Draft history / version compare
- File content fetching (paths only for the tree)
- Model switching on retry
