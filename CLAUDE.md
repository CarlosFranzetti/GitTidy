# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

> Broader project state, the full list of bugs fixed, and known gaps live in
> [`memorystate.md`](./memorystate.md). Read that first for context.

## Project overview

GitTidy is a web app for students and indie developers. It connects to GitHub
via OAuth, scores repository presentation quality, uses AI (Gemini, falling
back to OpenRouter) to draft
an improved README, description and topics, and writes back only what the user
explicitly selects.

**Live:** <https://git-tidy.vercel.app>

**Core value:** a user reviews AI-generated improvements and writes only the
pieces they want, with full control over what changes.

## Non-negotiable constraints

1. **Confirmation before every write.** No GitHub write may happen without the
   user accepting the confirmation dialog. This is the reason the app exists.
2. **Never send an unselected field.** `updateRepositoryMetadata` omits keys the
   user did not tick. Passing a cached value instead would silently revert edits
   made on GitHub since load — this was a real, shipped bug.
3. **Never add `rehype-raw`** to `react-markdown`. It renders untrusted README
   and AI output; raw HTML must stay escaped.
4. **Stay on React 19 + TypeScript + Tailwind v4.** No new UI libraries.
5. **`api/` must not import from `src/`.** Shared serverless helpers go in
   `api/_lib/` (the underscore stops Vercel routing them as functions).

## Commands

```bash
npm run dev        # Vite only, port 5173 (no API)
npm run dev:full   # vercel dev, port 3000 (API works)
npm run build      # tsc -b && vite build
npm run lint
npm run typecheck  # app + api + test sources
npm test           # Vitest, 154 tests
npm run test:e2e   # Playwright browser matrix
npm run test:all
```

`.env.local` keys are documented in `.env.example` and `memorystate.md`.

## Architecture

```
src/
  App.tsx              Orchestrator: all state, data flow, step routing
  components/          Presentational; ui.tsx holds the shared primitives
  features/
    github/            API client, response normalisation
    ai/                /api/generate client and types
    repos/             scoring.ts (single source of truth), prompt.ts
  lib/                 storage, clipboard, theme, fonts, steps, languages
  types/repo.ts        RepoRecord and friends
api/
  generate.ts          The only AI endpoint
  github/oauth/        start.ts, callback.ts
  _lib/                env, http, guard, oauth, providers — shared, not routed
e2e/                   Playwright specs and network fixtures
```

### The three-step flow

`Pick → Review → Apply`, one screen each, tracked by `step` in `App.tsx`.
Each step renders a single card plus a sticky `ActionBar` holding the primary
action, so the main button is always reachable without scrolling. Only the
current step is mounted — do not reintroduce simultaneously-mounted mobile and
desktop trees toggled with `hidden`/`md:block`; that used to render markdown
twice on every keystroke.

### Data flow

1. `/api/github/oauth/start` → GitHub → `/api/github/oauth/callback`
2. Callback redirects to `/#github_token=…` — **fragment, not query string**, so
   the token never reaches a server log, `Referer`, or an analytics pageview
3. App reads the fragment, stores the token, scrubs the URL
4. `selectRepo` fetches details + README in parallel; falls back to a digest of
   `package.json` and docs when there is no README
5. `/api/generate` → Gemini, falling back to OpenRouter → normalised preview
6. Confirmation dialog → GitHub write → repo reloaded

### Async safety

`selectRepo` guards against out-of-order responses with **both** an
`AbortController` (cancels the previous request) and a monotonic `selectionRef`
id checked before every `setState`. Without these, clicking a slow repo then a
fast one leaves the fast repo displayed while the slow repo's data is loaded —
and a subsequent write targets the wrong repository. Preserve both guards.

## Styling

**Dark mode is a `dark` class on `<html>`**, driven by a Tailwind
`@custom-variant` in `index.css`. Write `dark:` variants.

Do **not** reintroduce `theme === 'dark' ? '…' : '…'` ternaries in JSX. That
pattern appeared 30+ times in the old `App.tsx` and is why a hardcoded
`border-white/10` went unnoticed in light mode for so long.

Other rules:

- Interactive controls are `min-h-11` (44px). An e2e test enforces this.
- **Dark is the default theme**, not `system`. An e2e test enforces this.
- The review step must fit roughly one phone screen; an e2e test measures it.
  The inline README pane is intentionally short — the full-screen
  `readme-editor.tsx` is where reading and editing happen.
- Nothing may cause horizontal page scroll at 320px. An e2e test enforces this;
  wide content scrolls inside its own `overflow-x-auto` container.
- `dvh` units always follow a `vh` fallback line.
- Fonts are self-hosted. `src/fonts.css` and `public/fonts/` are **generated** —
  do not hand-edit. Never add an external font or CDN link; the CSP forbids it.

## Scoring

`src/features/repos/scoring.ts` is the **single** source of truth: README 0–35,
description 0/20, homepage 0/20, topics 0–25, max 100. It returns the score,
breakdown, checklist and issues together.

There used to be a second, different algorithm inline in `App.tsx`, so the same
repo showed two different scores in two places. Do not add another.

## AI endpoint

`api/generate.ts` is authenticated, rate limited and body capped — see
`api/_lib/guard.ts` and `docs/SECURITY.md`. It is not an open proxy; keep it
that way.

`api/_lib/providers.ts` owns provider selection. **Gemini first** when
`GEMINI_API_KEY` is set, then OpenRouter. Gemini is sent a `responseSchema`, so
it is structurally constrained to valid JSON; OpenRouter free models are only
asked politely, which is why `parseModelJson` must stay lenient.

`createCompletion` walks providers, then models within each, retrying transient
failures (429/408/5xx/timeout) once with backoff. A parse failure skips to the
next model rather than retrying the same one.

Adding a provider means writing one `Provider` object and appending it to
`resolveProviders()`. Do not restructure `generate.ts` for it.

`mode: 'metadata'` skips README generation entirely — much less output, so it
succeeds when a full README call would be throttled.

Repository content is fenced in `<<<BEGIN_REPO_CONTENT` delimiters and labelled
untrusted, because a README is attacker-controllable. Keep the fencing. The
`language` field is re-validated server-side against a strict pattern for the
same reason — it reaches the prompt.

**Never prefill the homepage field from model output.** A suggested deploy URL
is a guess, and writing a dead link to GitHub is worse than an empty field.

## Testing

Run `npm test` and `npm run test:e2e` before claiming a change works. See
`docs/TESTING.md` for what is covered and what is deliberately not.

Two test files encode shipped bugs — `client.test.ts` (partial metadata writes)
and `confirm-dialog.test.tsx` (itemised change list). Do not weaken them.

## Conventions

- Files `kebab-case`, functions `camelCase`, types `PascalCase`
- `import type` everywhere (`verbatimModuleSyntax` is on)
- Booleans prefixed `is`/`has`
- Named exports, except serverless `handler` and `App`
- Comments explain *why*, not *what*; the codebase is otherwise comment-light

## Known gaps

Listed with priorities in `memorystate.md` §8, and as planned work in
`docs/ROADMAP.md`. The notable ones: repo listing caps at 100 with no
pagination, README SHA can go stale (409 is surfaced but not auto-retried),
Firefox/WebKit e2e projects are configured but were never executed in the dev
sandbox, and the default Gemini model names were chosen without a live key to
verify against.
