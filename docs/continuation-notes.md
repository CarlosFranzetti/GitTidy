# Claude Continuation Notes

## What Is Already Done

- GitTidy is built as a Vite + React + TypeScript + Tailwind app.
- The UI is dark by default and includes a light/dark toggle.
- GitHub OAuth is wired through `/api/github/oauth/start` and `/api/github/oauth/callback`.
- Clicking a repo fetches repo metadata and README, then decodes the README from base64.
- The selected repo view shows:
  - existing README preview
  - GitTidy score
  - checklist
  - missing homepage warning
  - beautified README preview
  - copy and write-back actions
- Write-back is always confirmation-gated.
- OpenRouter generation uses the CoBuddy free model.

## Environment Variables Needed

Local `.env.local`:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=baidu/cobuddy:free
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Vercel production env vars:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## GitHub OAuth App Settings

- Homepage URL: `https://git-tidy.vercel.app`
- Callback URL: `https://git-tidy.vercel.app/api/github/oauth/callback`

For local testing:

- Callback URL: `http://localhost:3000/api/github/oauth/callback`

## Remaining Work

- Verify GitHub OAuth end to end after adding the OAuth app credentials.
- Keep UI polish focused and avoid adding a new dashboard layer.
- If write-back needs topic updates beyond repo patching, keep using the GitHub topics endpoint.

## Keep In Mind

- Do not auto-write to GitHub.
- Keep the UI sleek and simple.
- Respect the current OpenRouter JSON contract in `docs/openrouter-prompt.md`.
