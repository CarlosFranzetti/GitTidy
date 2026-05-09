# Roadmap: GitTidy — Selective Write-Back

**Created:** 2026-05-09
**Core Value:** A user can review AI-generated improvements and write only the pieces they want back to GitHub, with full control over what changes.
**Granularity:** Standard
**Coverage:** 7/7 requirements mapped

---

## Phases

- [ ] **Phase 1: Selective Write-Back** - Replace individual write buttons with checkboxes and a single "Apply Selected" button that writes only what the user chose

---

## Phase Details

### Phase 1: Selective Write-Back
**Goal**: Users can pick exactly which AI-generated improvements to apply and write them all to GitHub in one guarded operation
**Depends on**: Nothing (brownfield addition to existing app — all prerequisites already shipped)
**Requirements**: WRTB-01, WRTB-02, WRTB-03, WRTB-04, WRTB-05, WRTB-06, WRTB-07
**Success Criteria** (what must be TRUE):
  1. After AI generation, every suggested item (README, description, topics, homepage/deploy link) shows a checked checkbox in the preview panel
  2. User can uncheck any individual item and that item is excluded from the subsequent write; all other items remain selected
  3. The "Apply Selected" button is visible and disabled when zero items are checked, and enabled as soon as at least one item is checked
  4. Clicking "Apply Selected" opens a single confirmation modal that explicitly lists every item about to be written — no surprises
  5. After confirming, only the checked items are written to GitHub; unchecked items are left unchanged on the repo
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Selective Write-Back | 0/0 | Not started | - |

---

*Roadmap created: 2026-05-09*
