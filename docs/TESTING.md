# Testing

```bash
npm test           # Vitest unit + component tests (130)
npm run test:watch # Vitest in watch mode
npm run test:e2e   # Playwright browser matrix (48 in Chromium alone)
npm run test:all   # both
npm run typecheck  # app, api and test sources
```

## Unit and component tests (Vitest + jsdom)

| File | Covers |
| --- | --- |
| `src/features/repos/scoring.test.ts` | Every score tier boundary, the 0–100 invariant, whitespace-only metadata, breakdown-sums-to-total |
| `src/features/repos/prompt.test.ts` | `owner/name` splitting incl. names with slashes, prompt truncation, tone mapping |
| `src/features/github/client.test.ts` | Base64 UTF-8 round-trip (emoji, CJK, 50k chars), line-wrapped base64, HTTP status mapping, **partial metadata writes** |
| `src/lib/storage.test.ts` | `localStorage` throwing on read/write/remove (Safari private mode), preference fallbacks |
| `src/components/confirm-dialog.test.tsx` | Per-item change list, focus management, Escape handling, locked state mid-write |
| `src/components/markdown.test.tsx` | XSS regressions: script tags, `onerror`, `javascript:` URLs, link `rel`, table overflow wrapper |
| `api/_lib/http.test.ts` | Model JSON parsing — clean, fenced, prose-wrapped, code-in-string, unparseable |
| `api/_lib/oauth.test.ts` | Constant-time state comparison, cookie parsing incl. suffix-collision attempts |
| `api/_lib/guard.test.ts` | Rate-limit window and per-identity isolation, byte-accurate body cap, origin checks, identity caching |

Two of these encode bugs found in review, so a regression fails loudly:

- **Partial metadata writes** — the old code sent cached values for unselected
  fields, reverting other people's edits.
- **Confirm dialog item list** — the old dialog joined items with `\n` into a
  single `<p>`, which CSS collapsed into one run-on line.

## Browser tests (Playwright)

`e2e/fixtures.ts` stubs GitHub and `/api/generate`, so runs are deterministic
and never touch a real service or spend AI quota.

**`e2e/flow.spec.ts`** — the write-safety contract:

- No `PATCH`/`PUT` reaches GitHub before the confirmation dialog is accepted.
- Cancelling writes nothing.
- The metadata-only path works without generating a README.
- The Current/New README switch.
- An AI failure surfaces without losing the loaded repo.
- Invalid topics block the Apply button before any request.

**`e2e/responsive.spec.ts`** — layout and resilience:

- No horizontal page scroll at 320 / 375 / 768 / 1440px, checked again after a
  wide-table README renders.
- The primary action stays in the viewport after scrolling (sticky action bar).
- Every button, link and checkbox is at least 44px tall.
- `prefers-color-scheme` is honoured.
- The app still renders when `localStorage` throws.
- The OAuth token never remains in the visible URL.

### Browser matrix

| Project | Engine | Viewport |
| --- | --- | --- |
| `chromium-desktop` | Chromium | 1440×900 |
| `chromium-mobile` | Chromium | iPhone SE (375×667) |
| `chromium-tablet` | Chromium | Galaxy Tab S4 |
| `firefox-desktop` | Firefox | Desktop |
| `webkit-desktop` | WebKit | Desktop Safari |
| `webkit-mobile` | WebKit | iPhone 13 |

Firefox and WebKit require:

```bash
npx playwright install firefox webkit
```

If those engines are not installed, their projects are **omitted rather than
failed**, so a sandbox without them still runs the Chromium matrix. CI installs
all three and runs the full six.

WebKit coverage matters most here — Safari is where `dvh` units, `env(safe-area-inset-*)`,
clipboard permissions and `backdrop-filter` diverge from Chromium.

## What is deliberately not covered

- **The real OpenRouter call.** Stubbed everywhere. Testing it would spend quota
  and be non-deterministic. `api/_lib/http.test.ts` covers response parsing,
  which is where the failures actually happen.
- **The real OAuth handshake.** Requires GitHub credentials and a browser
  redirect to github.com. The security-relevant parts — state comparison, cookie
  handling — are unit tested directly.
- **Visual regression.** No screenshot baselines; the responsive suite asserts
  measurable properties (overflow, target size, viewport position) instead,
  which do not produce false failures on font rendering differences.
