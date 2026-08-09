# Security notes

Findings from the August 2026 review, what was fixed, and what remains a
deliberate trade-off.

## Fixed

### `/api/generate` was an open proxy to a paid API — **high**

Previously the only gate was a `method !== 'POST'` check. Anyone who knew the
URL could `curl` the deployed endpoint and spend the project's OpenRouter quota.
CORS does not help here: `curl` sends no preflight.

Now enforced in `api/_lib/guard.ts`, in this order:

1. `assertSameOrigin` — a browser request whose `Origin` does not match the
   deployment host is rejected. Requests with no `Origin` fall through to (3).
2. `assertBodyWithinLimit` — 200 KB cap, checked against both `Content-Length`
   and the actual parsed body, measured in **bytes** (a multibyte payload can
   pass a naive `.length` check).
3. `readBearerToken` + `resolveGitHubIdentity` — the caller must present a
   GitHub token that GitHub itself confirms. Verified tokens are cached for
   5 minutes so a normal session does not burn a GitHub API call per request.
4. `assertWithinRateLimit` — 8 generations per minute, keyed on the GitHub
   login, so spend is attributable to a real account.

**Known limitation:** the rate limiter is in-process. Serverless scales
horizontally, so the effective ceiling is 8/min *per warm instance*, not
globally. Enough to stop casual abuse and runaway loops; a determined attacker
with a valid GitHub token could still exceed it. A shared store (Vercel KV,
Upstash) would make it exact — deliberately not added, as it introduces a paid
dependency.

### The OAuth token travelled in the URL query string — **medium**

`/?github_token=…` put the token somewhere it could reach server access logs,
the `Referer` header on any outbound request, and an analytics pageview fired
before the app scrubbed the URL.

It is now returned in the **URL fragment** (`/#github_token=…`). Fragments are
never transmitted to a server, so none of those exposure paths exist. The app
still clears it from the address bar via `history.replaceState` on mount.

### Metadata writes clobbered fields the user did not select — **high**

`updateRepositoryMetadata` always sent `description` **and** `homepage`, filling
unselected fields from GitTidy's local cache. If a collaborator edited the
description on GitHub after the repo was loaded, applying only "Topics" would
silently revert their edit.

Fields are now `undefined` unless selected, and undefined keys are never sent.
GitHub treats an omitted key as "leave unchanged". Covered by tests in
`src/features/github/client.test.ts`.

### Prompt injection from README content — **medium**

README text is untrusted (anyone can open a PR adding text to a README) and was
interpolated straight into the model prompt. Injected instructions could steer
output that a user might then write back to a public repo.

Mitigations:

- Repository content is wrapped in explicit `<<<BEGIN_REPO_CONTENT` delimiters
  and labelled untrusted, with a system instruction never to follow
  instructions found inside it.
- Any attempt to forge the closing delimiter is neutralised.
- The confirmation dialog now lists **the actual values** being written
  (`Description → "…"`, `Topics → …`), not generic labels, so injected content
  is visible before approval.

This reduces but does not eliminate the risk — no prompt-level defence does. The
confirmation step is the real control.

### Other fixes

- **CSRF state**: compared in constant time (`safeEqual`); the cookie uses the
  `__Host-` prefix over HTTPS, which browsers enforce as origin-pinned,
  `Secure`, `Path=/`. The cookie is now cleared on *every* callback path,
  including failures.
- **Topic sanitisation**: model-supplied topics are normalised to GitHub's
  accepted charset server-side, and validated again in the UI before the Apply
  button unlocks.
- **Security headers**: `vercel.json` adds CSP, HSTS, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `X-Content-Type-Options`, `Permissions-Policy`
  and COOP.
- **Google Fonts removed**: fonts are self-hosted, so no third party sees a
  request carrying the referring URL, and the CSP can forbid external hosts.
- **Markdown rendering**: `react-markdown` runs without `rehype-raw`, so raw
  HTML in a README or AI response is escaped, not executed. Links get
  `rel="noopener noreferrer nofollow ugc"`. Regression tests in
  `src/components/markdown.test.tsx` cover script tags, `onerror` handlers and
  `javascript:` URLs. **Do not add `rehype-raw`.**

## Accepted trade-offs

### Token in `localStorage`

Still there. It survives reloads, which is the point. There is no XSS vector
today (no `dangerouslySetInnerHTML`, no `rehype-raw`, CSP forbids inline and
external script), but a future XSS would expose the token.

The proper fix is an HttpOnly session cookie with the token held server-side,
which means adding server-side session storage. Deliberately not done — it is a
substantial architectural change for a client-only app.

### OAuth scope is `repo`

`repo` grants read/write on **all** public and private repositories, plus
webhooks — considerably more than GitTidy needs (README, description, homepage,
topics).

Kept as the default so existing users' private repos keep working. It is now
configurable:

```env
GITHUB_OAUTH_SCOPE=public_repo
```

**Set this if you only ever tidy public repos.** It removes private-repo access
entirely and shrinks the blast radius substantially. The trade-off is that
private repositories stop appearing in the list.

A GitHub App with fine-grained permissions (Metadata: read, Contents: write)
would be the correct long-term answer and would drop the scope to exactly what
is used.

## Reporting

Found something? Open a private security advisory on the repository rather than
a public issue.
