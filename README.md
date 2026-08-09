# GitTidy

Polish the repo before anyone clicks it.

GitTidy connects to GitHub, scores how well your repositories present
themselves, drafts a better README, description and topics with AI, and writes
back **only** the parts you tick.

**Live:** <https://git-tidy.vercel.app>

---

## How it works

Three steps, one screen each.

1. **Pick** — your repositories, scored 0–100 and sorted worst-first so the ones
   that need attention surface immediately.
2. **Review** — see the current README and the generated one side by side on
   desktop, or swapped with a **Current | New** toggle on mobile. Adjust tone,
   add context, refine in plain English.
3. **Apply** — tick exactly what to write. Every value is shown before you
   confirm, and anything unticked is left completely untouched.

**Nothing is ever written to GitHub without an explicit confirmation.** That is
the point of the app.

### Just need topics and a description?

Skip the README entirely — **Suggest description + topics only** drafts just the
metadata. It is faster, and much less likely to hit a free-model rate limit.

---

## Features

- **Repo health score** with a five-point checklist that updates live as you
  edit drafts
- **Selective write-back** — README, description, topics and homepage are
  independent choices
- **Refinement** — "make it shorter", "add a contributing section", in prose
- **Four tones** — fun, professional, minimal, technical
- **No README? No problem** — GitTidy reads `package.json`, docs and config
  files to understand the project
- **Topic validation** before anything is sent, so GitHub cannot reject the write
- **Light / Dark / Auto** theme and an **Inter / Outfit / System** typeface
  picker, both self-hosted with no external font requests
- **Copy or download** the generated README without touching GitHub at all

---

## Getting started

```bash
npm install
npm run dev        # UI only, port 5173 — no AI or OAuth
npm run dev:full   # full stack via vercel dev, port 3000
```

Create `.env.local`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=baidu/cobuddy:free
OPENROUTER_FALLBACK_MODELS=
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
# Optional: public_repo drops access to private repositories entirely.
GITHUB_OAUTH_SCOPE=repo
```

Register a GitHub OAuth app with the callback URL:

```
http://localhost:3000/api/github/oauth/callback
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, UI only |
| `npm run dev:full` | Vite + serverless functions |
| `npm run build` | Type-check and build to `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | App, API and test sources |
| `npm test` | 130 unit and component tests |
| `npm run test:e2e` | Playwright browser matrix |
| `npm run test:all` | Both suites |

---

## Tech

React 19 · TypeScript · Tailwind CSS v4 · Vite · Vercel Functions · OpenRouter

No state library and no UI framework — deliberately. State lives in `App.tsx`;
styling is Tailwind with a class-based dark mode.

---

## Documentation

| Document | Contents |
| --- | --- |
| [`memorystate.md`](./memorystate.md) | Full project state, decisions, bugs fixed, known gaps |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | Security review, fixes, accepted trade-offs |
| [`docs/TESTING.md`](./docs/TESTING.md) | Test strategy and browser matrix |
| [`docs/AI-PROVIDERS.md`](./docs/AI-PROVIDERS.md) | Free AI provider comparison and recommendation |
| [`CLAUDE.md`](./CLAUDE.md) | Guidance for AI coding agents |

---

## A note on AI reliability

GitTidy uses OpenRouter's free model tier, which is a pool shared across all
OpenRouter users. It rate limits, and models occasionally return prose instead
of JSON. GitTidy retries with backoff, walks a configurable chain of free
fallback models, and parses defensively.

If generation fails repeatedly, try **Suggest description + topics only** — it
asks for far less output and usually succeeds when a full README call will not.

See [`docs/AI-PROVIDERS.md`](./docs/AI-PROVIDERS.md) for stronger free options.
