# GitTidy File Structure

## Current Target Structure

```text
docs/
  implementation-plan.md
  file-structure.md
  openrouter-prompt.md
  specs/
    gittidy-spec.md

src/
  components/
    app-shell.tsx
    panel.tsx
    score-ring.tsx
    status-badge.tsx
  features/
    ai/
      components/
      types.ts
    github/
      client.ts
      types.ts
    repos/
      components/
        repo-card.tsx
        repo-detail.tsx
      mock-data.ts
      scoring.ts
      types.ts
  lib/
    clipboard.ts
    utils.ts
  types/
    api.ts
  App.tsx
  index.css
  main.tsx

api/
  generate.ts

public/
  favicon.svg
```

## Structure Notes

- `components/` is for small reusable UI building blocks.
- `features/repos/` owns repository list, detail view, mock data, and scoring logic.
- `features/github/` owns GitHub API normalization and fetch code.
- `features/ai/` owns generation request/response handling and UI.
- `lib/` holds generic helpers that are not feature-specific.
- `api/` is reserved for serverless handlers.

## Scope Guardrails

- No global state library unless real complexity appears.
- No routing layer unless more than one top-level screen is added.
- No database models or ORM.
- No premature component library extraction beyond obvious primitives.
