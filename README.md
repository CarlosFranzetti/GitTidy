# GitTidy

Polish the repo before anyone clicks it.

GitTidy scores how well your GitHub repositories present themselves, drafts a
better README, description and topics with AI, and writes back **only** the
parts you tick.

**Live:** <https://git-tidy.vercel.app>

---

## How it works

**Pick → Review → Apply.** One screen each.

Pick a repo (scored 0–100, worst first). Review the current README against the
generated one — tap either to open it full screen, and edit the draft by hand if
you want. Then tick exactly what to write.

Every value is shown before you confirm, and anything unticked is left
untouched. **Nothing reaches GitHub without an explicit confirmation.**

Just need metadata? **Suggest description + topics only** skips the README
entirely — faster, and far less likely to hit a rate limit.

## Features

- Repo health score with a live checklist
- Independent write choices: README, description, topics, homepage
- Full-screen README editor with markdown preview
- Refine in plain English, or translate into 12 languages
- Four tones — fun, professional, minimal, technical
- No README? It reads `package.json`, docs and config instead
- Topic validation before anything is sent
- Deploy guides when a repo has no live link
- Dark by default, with light/auto and three self-hosted typefaces

## Setup

```bash
npm install
npm run dev        # UI only, port 5173
npm run dev:full   # full stack, port 3000
```

`.env.local`:

```env
GEMINI_API_KEY=          # optional but recommended — see docs/GEMINI-SETUP.md
OPENROUTER_API_KEY=      # fallback provider
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

OAuth callback URL: `http://localhost:3000/api/github/oauth/callback`

| Command | |
| --- | --- |
| `npm run build` | Type-check and build |
| `npm run lint` | ESLint |
| `npm run typecheck` | App, API and tests |
| `npm test` | 154 unit and component tests |
| `npm run test:e2e` | Playwright browser matrix |

## Tech

React 19 · TypeScript · Tailwind v4 · Vite · Vercel Functions · Gemini with an
OpenRouter fallback. No state library, no UI framework — deliberately.

## Docs

| | |
| --- | --- |
| [`memorystate.md`](./memorystate.md) | Project state, decisions, known gaps |
| [`docs/GEMINI-SETUP.md`](./docs/GEMINI-SETUP.md) | Getting a free API key, from a phone |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | Security review and trade-offs |
| [`docs/TESTING.md`](./docs/TESTING.md) | Test strategy and browser matrix |
| [`docs/AI-PROVIDERS.md`](./docs/AI-PROVIDERS.md) | Free provider comparison |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | What's next |
| [`CLAUDE.md`](./CLAUDE.md) | Guidance for AI coding agents |
