# External Integrations

**Analysis Date:** 2026-05-09

## APIs & External Services

**AI / LLM:**
- OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) - Routes AI generation requests to the underlying LLM (Baidu Qianfan CoBuddy by default)
  - SDK/Client: No SDK; raw `fetch()` POST in `api/generate.ts` and `api/context.ts`
  - Auth: `Authorization: Bearer <OPENROUTER_API_KEY>` header
  - Model: `baidu/cobuddy:free` (default); overridable via `OPENROUTER_MODEL` env var
  - Timeout: 45-second `AbortController` timeout on all requests
  - Request headers include `HTTP-Referer: https://gittidy.local` and `X-Title: GitTidy`

**GitHub REST API:**
- GitHub API (`https://api.github.com`) - Reads and writes repository data on behalf of the authenticated user
  - SDK/Client: No SDK; raw `fetch()` in `src/features/github/client.ts`
  - Auth: `Authorization: Bearer <github_token>` (user OAuth token stored in `localStorage`)
  - API version: `X-GitHub-Api-Version: 2022-11-28` header on all requests
  - Endpoints used:
    - `GET /user` - Fetch authenticated user profile
    - `GET /user/repos?sort=updated&per_page=30` - List user repositories
    - `GET /repos/:owner/:repo` - Fetch repository details
    - `GET /repos/:owner/:repo/readme` - Fetch README (JSON or raw)
    - `PUT /repos/:owner/:repo/contents/README.md` - Write updated README
    - `PATCH /repos/:owner/:repo` - Update description and homepage
    - `PUT /repos/:owner/:repo/topics` - Replace repository topics
    - `GET /repos/:owner/:repo/git/trees/:branch?recursive=1` - Fetch file tree for context

**GitHub OAuth:**
- GitHub OAuth Authorization (`https://github.com/login/oauth/authorize`) - Initiates OAuth flow
  - OAuth scope requested: `repo` (full repository read/write access)
  - Handled in: `api/github/oauth/start.ts`
- GitHub OAuth Token Exchange (`https://github.com/login/oauth/access_token`) - Exchanges code for access token
  - Handled in: `api/github/oauth/callback.ts`

## Data Storage

**Databases:**
- None - No database or ORM detected.

**File Storage:**
- None - No cloud file storage (S3, GCS, etc.) detected.

**Caching:**
- None - No Redis, Memcached, or CDN caching layer detected.

**Browser Storage:**
- `localStorage` - Stores `github_token` (OAuth access token) and `gittidy.theme` (dark/light theme preference)
- All state is session-scoped in `src/App.tsx`; no persistence beyond localStorage

## Authentication & Identity

**Auth Provider:**
- GitHub OAuth 2.0 — Custom implementation; no third-party auth library
  - Flow:
    1. `GET /api/github/oauth/start` → sets `gittidy_oauth_state` HttpOnly cookie, redirects to GitHub
    2. GitHub redirects to `GET /api/github/oauth/callback` → validates CSRF state cookie, exchanges code for token
    3. Callback redirects to `/?github_token=<token>` → token stored in `localStorage`
  - CSRF protection: `randomUUID()` state stored in HttpOnly SameSite=Lax cookie (10-minute expiry)
  - Token delivery: URL parameter (note: token visible in browser history)
  - Required env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

## Monitoring & Observability

**Error Tracking:**
- None - No Sentry, Datadog, or similar error tracking service detected.

**Logs:**
- Serverless function errors are surfaced via HTTP response JSON `{ error: string }`
- No structured server-side logging framework

## CI/CD & Deployment

**Hosting:**
- Vercel - Frontend (Vite build to `dist/`) + Serverless Functions (`api/` directory)
- Live URL: `https://git-tidy.vercel.app`

**CI Pipeline:**
- None detected - No GitHub Actions, CircleCI, or other CI configuration found.

**Deployment:**
- Automatic via Vercel git integration (implied by Vercel project setup)
- `npm run build` used for Vite build step

## Environment Configuration

**Required env vars:**

| Variable | Where Used | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | `api/generate.ts`, `api/context.ts` | Server-only; never exposed to frontend |
| `GITHUB_CLIENT_ID` | `api/github/oauth/start.ts`, `api/github/oauth/callback.ts` | Server-only |
| `GITHUB_CLIENT_SECRET` | `api/github/oauth/callback.ts` | Server-only; never exposed to frontend |
| `OPENROUTER_MODEL` | `api/generate.ts`, `api/context.ts` | Optional; defaults to `baidu/cobuddy:free` |

**Secrets location:**
- Local development: `.env.local` (not committed; `.env.example` provides template)
- Production: Vercel project environment variables dashboard
- Serverless functions read via `readEnvValue()` helper: checks `process.env` first, then parses `.env.local` as fallback

## Webhooks & Callbacks

**Incoming:**
- `GET /api/github/oauth/callback` - Receives GitHub OAuth redirect with `code` and `state` query params

**Outgoing:**
- None - No outgoing webhooks configured.

---

*Integration audit: 2026-05-09*
