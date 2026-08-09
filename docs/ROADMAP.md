# Roadmap

Agreed but not built. Ordered by value relative to effort.

## 1. Repository logo generation

Generate a simple logo or social preview image from the repo's name, language,
description and topics, then offer it as another selectable write.

**Why it is not built yet:** it needs an image-generation provider, and the
write path is different from everything GitTidy does today. Logos would go to
`.github/` or the repo's social preview, and the social preview is **not
settable through the public GitHub REST API** — only through the web UI. So the
realistic first version writes an image file into the repo and links it from the
README, leaving the user to set the social preview manually.

**Sketch:**

- Gemini's image models can generate at 1024×1024 on the free tier (roughly 500
  images/day), which suits a social preview card.
- A no-AI fallback is worth having and is genuinely cheap: render an SVG from
  the repo name, language colour and initials. Deterministic, free, instant, and
  often nicer than a generated raster.
- Existing images in the repo (`docs/`, `assets/`, an existing logo) should be
  detected and offered before generating anything new.
- Reuse the confirmation dialog: an image write is still a write, and must show
  a preview of the actual image before it happens.

**Suggested order:** SVG generator first (no provider, no cost, testable), AI
generation second.

## 2. Repository pagination

`fetchRepositories` requests `per_page=100` with no pagination, so an account
with more than 100 repositories only ever sees the 100 most recently updated.

Follow GitHub's `Link` header until exhausted, with a cap and a progress hint.
Needs a virtualised list if someone has thousands.

## 3. README SHA refresh and retry

The SHA is captured when the repo is selected. If the README changes on GitHub
before the write, GitHub returns 409 and GitTidy now explains it clearly — but
the user has to reload manually.

Better: on 409, re-fetch the README, show a diff of what changed underneath
them, and let them retry or merge. Do **not** auto-retry blindly; that would
silently overwrite someone else's edit, which is the exact bug class this app
exists to avoid.

## 4. Provider chain beyond Gemini

`api/_lib/providers.ts` already walks a list of providers. Adding Groq or
Cerebras is now a matter of writing one `Provider` object each. Worth doing only
if Gemini's daily quota turns out to be a real constraint — see
`docs/AI-PROVIDERS.md`.

## 5. Fine-grained GitHub App

Replace the `repo` OAuth scope with a GitHub App requesting exactly Metadata:
read and Contents: write. Shrinks the blast radius from "every private
repository" to "the files GitTidy actually touches". The largest change here is
installation flow, not permissions.

## 6. Translating an existing README

Translation currently applies to **generated** content. Translating a README the
user already has, without rewriting it, is a distinct and useful mode: same
structure, same code blocks, different prose.

## 7. Diff view

Show a line-level diff between the current and generated README rather than two
separate documents. The editor makes this more valuable, since the user can now
edit the draft and would want to see what actually changed.
