<p align="center">
  <img src="GitTidyLogo.png" alt="GitTidy logo" width="96" />
</p>

<h1 align="center">GitTidy</h1>

<p align="center">Polish your GitHub repos before anyone clicks them.</p>

<p align="center">
  <a href="https://git-tidy.vercel.app">Live app</a>
</p>

---

GitTidy connects to GitHub via OAuth, analyzes your repository quality (README, description, topics, deploy link), and uses AI to generate improved versions of those elements. You preview every suggestion and selectively apply only what you want — nothing is written automatically.

## Features

- Connect GitHub with OAuth — no tokens stored server-side
- Repository quality scoring (README detail, description, topics, deploy link)
- AI-generated README rewrite, description, topics, and deploy link suggestion
- Tone selector: fun, professional, minimal, or technical
- Refine the generated README with targeted instructions
- Selective write-back: choose exactly which items to apply
- Code analysis fallback when a repo has no README — AI infers from file structure
- Confirmation modal before any GitHub write

## Tech stack

- React 19 + TypeScript
- Tailwind CSS v4
- Vite + Vercel serverless functions
- GitHub API (OAuth + REST)
- OpenRouter (Random free models. Its free, you get what you get.)

## Local setup

```bash
npm install
```

Create `.env.local` in the project root:

```env
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=baidu/cobuddy:free
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
```

For GitHub OAuth, register an app with callback URL:

```
http://localhost:3000/api/github/oauth/callback
```

Run the full local stack (frontend + API):

```bash
npm run dev:full
```

Frontend only (no API):

```bash
npm run dev
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite frontend only (port 5173) |
| `npm run dev:full` | Vite + Vercel API routes (port 3000) |
| `npm run build` | Type-check and build |
| `npm run lint` | ESLint |

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENROUTER_API_KEY` | Yes | Server-only — do not prefix with `VITE_` |
| `OPENROUTER_MODEL` | No | Defaults to `baidu/cobuddy:free` |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app secret |

## License

MIT
