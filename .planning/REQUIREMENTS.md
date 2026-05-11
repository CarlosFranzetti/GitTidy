# Requirements: GitTidy

**Defined:** 2026-05-09
**Core Value:** A user can review AI-generated improvements and write only the pieces they want back to GitHub, with full control over what changes.

## v1 Requirements

### Selective Write-Back

- [x] **WRTB-01**: User sees a checkbox next to each AI-generated item (README, description, topics, homepage/deploy link) in the preview panel
- [x] **WRTB-02**: All checkboxes are checked by default when AI suggestions arrive
- [x] **WRTB-03**: User can uncheck any item to exclude it from the write operation
- [x] **WRTB-04**: A single "Apply Selected" button replaces the individual per-item write buttons
- [x] **WRTB-05**: "Apply Selected" is disabled when no items are checked
- [ ] **WRTB-06**: Clicking "Apply Selected" opens a confirmation modal that lists every item that will be written to GitHub
- [ ] **WRTB-07**: User confirms in the modal and only the checked items are written to GitHub

## v2 Requirements

(None identified — scope is contained)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Individual per-item write buttons | Replaced by the unified checkbox + Apply Selected pattern |
| Per-item confirmation modals | Replaced by one shared confirmation listing all selected items |
| Saving checkbox state across sessions | Ephemeral preference — resets cleanly when new suggestions arrive |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WRTB-01 | Phase 1 | Complete |
| WRTB-02 | Phase 1 | Complete |
| WRTB-03 | Phase 1 | Complete |
| WRTB-04 | Phase 1 | Complete |
| WRTB-05 | Phase 1 | Complete |
| WRTB-06 | Phase 1 | Pending |
| WRTB-07 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-05-09 after initial definition*
