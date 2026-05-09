# GitTidy

## What This Is

GitTidy is a web app for students and indie developers that connects to GitHub via OAuth, analyzes repository quality (README, description, topics, deploy link), and uses AI to generate improved versions of those elements. Users preview AI suggestions and selectively apply changes back to GitHub — they choose exactly what gets written.

## Core Value

A user can review AI-generated improvements and write only the pieces they want back to GitHub, with full control over what changes.

## Requirements

### Validated

- ✓ GitHub OAuth login (HttpOnly CSRF cookie, token stored in localStorage) — existing
- ✓ Fetch and display user's repositories with quality scores (0–100) — existing
- ✓ Select a repo and load its README + metadata — existing
- ✓ AI-powered generation of improved README, description, topics, deploy link — existing
- ✓ Write README back to GitHub with confirmation modal — existing
- ✓ Write description, topics, homepage back to GitHub with confirmation modal — existing
- ✓ Dark/light theme toggle persisted to localStorage — existing

### Active

- [ ] Checkmark toggles on AI preview panel for each generated item (README, description, topics, homepage/deploy link)
- [ ] All items checked by default when suggestions arrive
- [ ] Single "Apply Selected" button replaces individual per-item write buttons
- [ ] Confirmation modal lists all selected items before applying
- [ ] Write only the checked items to GitHub in one operation

### Out of Scope

- Keeping individual per-item write buttons — replaced by the checkbox + single-button pattern
- Per-item confirmation modals — replaced by one shared confirm that lists all selected items

## Context

- Stack: React 19, TypeScript, Tailwind CSS v4, Vite, Vercel serverless functions
- All app state lives in `src/App.tsx` (monolithic component ~800 lines)
- AI suggestions are stored in `generated` state as `AiSuggestions` (`readmeMd`, `description`, `topics`, `deploySuggestion`, `repoName`)
- GitHub writes go through `pendingAction` → `ConfirmationModal` → `runPendingAction()` pattern
- Current write buttons live in the AI output panel (`src/features/ai/components/ai-output-panel.tsx`) and in App.tsx handlers
- The `updateRepositoryMetadata()` function accepts partial updates (description, topics, homepage individually or together)

## Constraints

- **Tech stack**: Must stay within React 19 + TypeScript + Tailwind CSS v4 — no new UI libraries
- **Write guard**: All GitHub writes must remain behind a confirmation step — non-negotiable safety principle
- **No global state**: All state stays local in App.tsx unless explicitly refactored

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Replace individual buttons with checkboxes + one Apply button | Simpler UX, user asked for it explicitly | — Pending |
| Single confirmation modal listing all selected items | Maintains the write-guard principle without multiple modals | — Pending |
| Default all checkboxes to checked | Matches current behavior where all items were shown; user opts out rather than in | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-09 after initialization*
