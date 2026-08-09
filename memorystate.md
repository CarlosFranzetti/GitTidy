# GitTidy — Memory State

Durable context for anyone (human or agent) picking this project up. Last
updated: **2026-08-09** (second pass).

---

## 1. What GitTidy is

A web app for students and indie developers. It connects to GitHub via OAuth,
scores repository presentation quality, uses AI to draft a better README,
description and topics, and writes back **only** what the user explicitly ticks.

- **Live:** <https://git-tidy.vercel.app>
- **Core value:** review AI suggestions and apply only the parts you want.
- **Non-negotiable:** no write to GitHub without an explicit confirmation step.

### Hard constraints

- React 19 + TypeScript + Tailwind v4. **No new UI libraries.**
- All GitHub writes stay behind a confirmation dialog.
- State stays local to `App.tsx` unless a refactor is explicitly agreed.
- `react-markdown` must **never** gain `rehype-raw` — it renders untrusted
  README and AI content.

---

## 2. Current architecture

```
src/
  App.tsx                     Orchestrator: state, data flow, step routing (~750 lines)
  main.tsx                    Root mount; applies theme/font before first paint
  index.css                   Tokens, class-based dark mode, reduced-motion
  fonts.css                   GENERATED — self-hosted @font-face, do not hand-edit
  components/
    ui.tsx                    Button, TextField, TextArea, Card, Muted, ScorePill, Spinner
    markdown.tsx              Hardened react-markdown wrapper
    readme-compare.tsx        Current|New segmented switch (side-by-side at xl:)
    readme-editor.tsx         Full-screen README reader and markdown editor
    deploy-help.tsx           Vercel/Netlify/Pages links when no homepage is set
    repo-picker.tsx           Step 1: filter, sort, select
    checklist.tsx             Repo health panel with progress bar
    confirm-dialog.tsx        Write confirmation; focus trap; itemised changes
    action-bar.tsx            Sticky bottom primary action
    stepper.tsx               Pick → Review → Apply progress nav
    settings-menu.tsx         Theme + typeface picker
    toast.tsx                 Non-blocking status messages
    error-boundary.tsx        Catches render throws, offers reload
  features/
    github/{client,normalize,types}.ts
    ai/{client,types}.ts
    repos/{scoring,prompt}.ts
  lib/{storage,clipboard,theme,fonts,steps,languages}.ts
  types/repo.ts
api/
  generate.ts                 The only AI endpoint
  github/oauth/{start,callback}.ts
  _lib/{env,http,guard,oauth,providers}.ts  Shared; underscore keeps Vercel from routing them
e2e/                          Playwright specs + network fixtures
```

### Data flow

1. Sign in → `/api/github/oauth/start` → GitHub → `/api/github/oauth/callback`
2. Callback redirects to `/#github_token=…` (**fragment**, not query)
3. App reads the fragment, stores the token, scrubs the URL
4. `loadRepos` → `fetchViewer` + `fetchRepositories` → `normalizeGitHubRepo`
5. Select repo → details + README in parallel; no README → config/docs digest
6. Generate → `/api/generate` → Gemini, falling back to OpenRouter → preview
7. Tick changes → confirmation dialog → GitHub write → repo reloaded

---

## 3. The August 2026 overhaul

Branch: `claude/app-review-mobile-redesign-gbkrum`

Driven by a user request (mobile redesign, fewer errors, better workflow,
security, tests, dead-code removal) plus a parallel Sonnet code review.

### Decisions taken by the user

| Question | Chosen |
| --- | --- |
| Layout | Step flow (Pick → Review → Apply) with a sticky action bar |
| AI provider | Pass 1: keep OpenRouter, recommend only. Pass 2: **implement Gemini** with OpenRouter fallback |
| Fonts | Self-hosted Inter / Outfit / System with an in-app picker |
| Testing | Vitest units + Playwright cross-browser matrix |

### Dead code removed (~600 lines)

An entire earlier "card grid" UI iteration was shipping in the bundle,
unreachable from `App.tsx`: `app-shell.tsx`, `panel.tsx`, `score-ring.tsx`,
`status-badge.tsx`, `repo-card.tsx`, `repo-detail.tsx`, `ai-output-panel.tsx`,
`mock-data.ts`, `lib/utils.ts`, `api/context.ts`, `inferContext()`,
`fetchReadmeWordCount()`, and `src/assets/` (hero.png, react.svg, vite.svg).

### Bugs fixed

| # | Severity | Bug |
| --- | --- | --- |
| 1 | High | **Metadata writes clobbered unselected fields.** Unchecking "Description" still PATCHed the cached description, reverting edits made on GitHub since load. |
| 2 | High | **Two conflicting score algorithms.** `scoring.ts` (35/20/20/25) drove the sidebar; `calculateScore` in `App.tsx` (25/20/20/20/15) drove the detail header. Same repo, two numbers. Now one function. |
| 3 | High | `/api/generate` was an unauthenticated open proxy to a paid API. |
| 4 | Medium | **Race on fast repo switching.** No cancellation; a slow request for repo A could land after B was selected and silently swap the loaded data. Now guarded by an `AbortController` + monotonic selection id. |
| 5 | Medium | Confirmation dialog joined items with `\n` into one `<p>`; CSS collapsed the safety-critical list into a run-on sentence. |
| 6 | Medium | `localStorage` throws (Safari private mode) crashed the app with no boundary. |
| 7 | Medium | OAuth token passed through the URL query string. |
| 8 | Medium | Checklist hardcoded `border-white/10` — invisible in light mode. |
| 9 | Low | Both mobile and desktop trees mounted simultaneously; markdown rendered twice on every keystroke. |
| 10 | Low | Timeout handler reported every network error as a timeout. |
| 11 | Low | Toast could overflow the left viewport edge on a 375px screen. |
| 12 | Low | Tap targets at 24–36px, below the 44px guideline. |
| 13 | Low | Wide markdown tables overflowed the page horizontally. |
| 14 | Low | `dvh` units with no `vh` fallback; `navigator.clipboard` with no fallback. |

### Features added

- **Step flow** — Pick → Review → Apply, one screen each, no long scroll.
- **Sticky action bar** — primary action always thumb-reachable.
- **Current | New README switch** — replaces the stacked side-by-side pair on
  mobile; still side-by-side at `xl:`.
- **Metadata-only generation** — "Suggest description + topics only" skips the
  README call entirely. Cheaper, faster, far less likely to hit a free-tier
  limit.
- **Typeface picker** — Inter / Outfit / System, self-hosted, persisted.
- **Theme: Light / Dark / Auto** — Auto follows the OS and reacts live.
- **Live score** — the health panel updates from unsaved drafts as you type.
- **Topic validation** — invalid topics are flagged and block Apply before any
  request reaches GitHub.
- **Model attribution** — the UI shows which model produced a draft.
- **Error boundary** with a reload path.

### AI reliability (pass one — no provider change)

`api/generate.ts` gained retry with backoff on 429/408/5xx/timeout, a fallback
chain of **free** models, and `response_format: json_object`. The lenient
three-tier JSON parser was retained as a safety net.

Ranked alternatives (Gemini > Groq > Cerebras; GitHub Models ruled out as
retired) were written up in **`docs/AI-PROVIDERS.md`** for the user to decide on.

---

## 3b. Second pass — Gemini, editing, translation

The user reviewed the recommendation and asked for Gemini to be implemented,
along with a set of UI changes.

### Gemini is now the primary provider

`api/_lib/providers.ts` introduces a provider abstraction. `resolveProviders()`
returns Gemini first when `GEMINI_API_KEY` is set, then OpenRouter.
`createCompletion` walks providers, then models within each, retrying transient
failures once with backoff.

Gemini sends `responseSchema` + `responseMimeType: application/json`, so the
model is **structurally constrained** to the expected object and cannot answer
with prose. That is the whole reason for the switch.

**Removing `GEMINI_API_KEY` restores the previous OpenRouter-only behaviour
exactly** — the fallback is not a degraded mode, it is the old code path.

Phone setup walkthrough: **`docs/GEMINI-SETUP.md`**.

### Other changes in this pass

- **Dark mode is now the default.** `resolveTheme` falls back to `'dark'`, not
  `'system'`. Choosing "Auto" opts into following the OS. Persisted in
  `localStorage`, not cookies — it never needs to reach the server, and a cookie
  would be sent on every request for no reason.
- **Full-screen README editor** (`readme-editor.tsx`). Tapping Edit on the
  generated README opens it full screen with edit/preview modes; the current
  README opens read-only. Saved edits become what gets written to GitHub.
- **The inline README pane is deliberately short** (`clamp(160px, 26dvh, 320px)`)
  with a fade and an Edit/Expand affordance. This is what makes the review step
  fit one phone screen — the editor is where reading actually happens.
- **Translation** — 12 languages, applied to the generated README and
  description. Code, commands and identifiers are left untouched; topics stay
  lowercase English. The language value is re-validated server-side against a
  strict pattern because it reaches the prompt.
- **Deploy guidance** — when a repo has no homepage, links to Vercel, Netlify
  and GitHub Pages guides appear under the field. Shown whether or not the row
  is ticked.
- **Checklist shows only unmet items.** A row saying "Description set ✓" costs
  vertical space to say nothing actionable.

### A bug introduced and removed in the same pass

The first cut of metadata generation prefilled the homepage field from the
model's `deploy_suggestion` when it contained a URL. That URL is a **guess** —
`https://example.vercel.app` — and a user who ticked Homepage without reading
would write a dead link to GitHub. Removed. The homepage is never prefilled from
model output.

---

## 4. Security posture

Full detail in **`docs/SECURITY.md`**. Summary:

**Fixed:** open AI proxy (now GitHub-token-authenticated, rate limited, body
capped, origin checked); token moved to URL fragment; constant-time CSRF state
with `__Host-` cookie; prompt-injection fencing; topic sanitisation; CSP and
security headers via `vercel.json`; Google Fonts CDN removed.

**Accepted trade-offs:**

1. **Token in `localStorage`** — no XSS vector today, but a future one would
   expose it. Proper fix needs server-side sessions.
2. **OAuth scope `repo`** — broader than needed. Now configurable via
   `GITHUB_OAUTH_SCOPE=public_repo`. A GitHub App with fine-grained permissions
   is the correct long-term answer.
3. **In-process rate limiting** — per warm serverless instance, not global.
   Exact limiting needs a shared store (a paid dependency).

---

## 5. Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Recommended | Primary provider. See `docs/GEMINI-SETUP.md` |
| `GEMINI_MODEL` | No | Override; defaults to a built-in chain |
| `GEMINI_FALLBACK_MODELS` | No | Comma-separated |
| `OPENROUTER_API_KEY` | Fallback | Server-only. Used when Gemini is absent or fails |
| `OPENROUTER_MODEL` | No | Default `baidu/cobuddy:free` |
| `OPENROUTER_FALLBACK_MODELS` | No | Comma-separated. **Use only `:free` models** |
| `GITHUB_CLIENT_ID` | Yes | |
| `GITHUB_CLIENT_SECRET` | Yes | Server-only |
| `GITHUB_OAUTH_SCOPE` | No | Default `repo`; set `public_repo` to shrink blast radius |
| `PUBLIC_APP_URL` | No | Sent as OpenRouter `HTTP-Referer` |

---

## 6. Conventions

- Files `kebab-case`; functions `camelCase`; types `PascalCase`.
- `import type` everywhere (`verbatimModuleSyntax`).
- **Dark mode is a `dark` class on `<html>`**, driven by a Tailwind
  `@custom-variant`. Use `dark:` variants — do **not** reintroduce
  `theme === 'dark' ? … : …` ternaries; that pattern appeared 30+ times in the
  old `App.tsx`.
- Buttons/inputs are `min-h-11` (44px). Keep it.
- Serverless code must not import from `src/`; shared helpers live in
  `api/_lib/`.
- `src/fonts.css` and `public/fonts/` are generated. To regenerate, re-download
  the latin/latin-ext subsets and rewrite the `src:` URLs to `/fonts/…`.

---

## 7. Commands

```bash
npm run dev        # Vite only, port 5173 (no API)
npm run dev:full   # vercel dev, port 3000 (API works)
npm run build      # tsc -b && vite build
npm run lint
npm run typecheck  # app + api + tests
npm test           # 130 unit/component tests
npm run test:e2e   # 48 browser tests in Chromium; more with firefox/webkit installed
npm run test:all
```

---

## 8. Known gaps / next steps

**Not done, in rough priority order:**

1. **Repo list caps at 100** (`per_page=100`, no pagination). Accounts with more
   repositories see only the 100 most recently updated.
2. **README SHA can go stale** — captured at select time. GitHub returns 409 on
   a conflicting write and the message now explains it, but there is no
   auto-refresh-and-retry.
3. **`App.tsx` is still the single state owner** (~750 lines, down from 1290).
   Intentional per project constraints. If it grows again, extract a
   `useRepoWorkflow` hook before reaching for a state library.
4. **No pagination or search across many repos** beyond client-side filtering.
5. **Repository logo generation** — agreed as roadmap, not built. Note that the
   GitHub social preview image is **not settable via the public REST API**, so a
   first version has to write an image file into the repo instead. Start with a
   deterministic SVG generator (free, testable) before any AI image call. See
   `docs/ROADMAP.md`.
6. **Fine-grained GitHub App** to replace the `repo` OAuth scope.
7. **Firefox/WebKit** could not be downloaded in the dev sandbox; the projects
   are configured and skip gracefully, but have not been executed. Run them in
   CI before trusting Safari behaviour.
8. **Gemini model names are unverified.** The default chain is
   `gemini-2.5-flash` then `gemini-2.0-flash`, chosen without a live key to test
   against. If every generation falls through to OpenRouter, that is the first
   thing to check — set `GEMINI_MODEL` to a current model.
9. **Groq / Cerebras** can now be added as one `Provider` object each. Only
   worth doing if Gemini's quota becomes a real constraint.

---

## 9. Prior context (pre-overhaul)

The project previously completed a GSD milestone, "Phase 1 — Selective
Write-Back" (3 plans, marked 100% complete, deployed). Its artifacts are in
`.planning/`. That milestone delivered the per-item write selection which this
overhaul preserved and hardened — the checkbox model survived; the bug where
unselected fields were still written did not.

Historic docs under `docs/` (`implementation-plan.md`, `file-structure.md`,
`continuation-notes.md`, `specs/`, `superpowers/`) describe the pre-overhaul
structure and now disagree with the code in places. `docs/AI-PROVIDERS.md`,
`docs/SECURITY.md`, `docs/TESTING.md`, this file, `README.md` and `CLAUDE.md`
are current.
