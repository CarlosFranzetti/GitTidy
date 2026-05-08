# GitTidy Implementation Plan

## Principles

- Keep the codebase single-app and feature-local.
- Prefer typed utility functions over abstraction-heavy state layers.
- Ship a fully usable mocked experience before live integrations.
- Push secrets into serverless functions only.
- Avoid premature routing, global stores, or persistence layers.

## Architecture Decisions

- Use a single-page React app for the MVP.
- Use Tailwind for layout and visual tokens.
- Organize code by feature:
  - `components/`
  - `features/repos/`
  - `features/ai/`
  - `lib/`
  - `types/`
- Use local React state for phase 1 and phase 2.
- Add serverless functions under `api/` or platform-specific function directory in phase 3.
- Prefer a GitHub token input flow first instead of OAuth.

## Phase 1: Foundation

### Objectives

- Replace Vite starter UI.
- Install and configure Tailwind.
- Create a stable app shell.
- Build a mock repository dashboard and detail panel.

### Tasks

1. Add Tailwind dependencies and configuration.
2. Replace starter CSS with Tailwind entry styles and a small token layer.
3. Create shared app shell primitives:
   - top header
   - dashboard layout
   - section panels
   - reusable status badge
4. Create mock repository dataset.
5. Implement deterministic mock scoring display.
6. Build repo cards grid.
7. Build selected repo detail panel with:
   - score breakdown
   - issue list
   - placeholders for AI output

### Exit Criteria

- Local app renders GitTidy dashboard with mock data.
- Layout works on mobile and desktop.
- Build and lint pass.

## Phase 2: GitHub Integration

### Objectives

- Replace mock-only flow with real repository fetch capability.
- Preserve mock data as fallback/demo mode.

### Tasks

1. Add GitHub token entry UI.
2. Add GitHub API client helpers.
3. Add repository fetch flow:
   - list user repos
   - normalize GitHub responses
4. Add README lookup for selected repo.
5. Implement scoring utility:
   - README presence and quality heuristic
   - description presence
   - homepage presence
   - topics presence
6. Add loading, empty, and rate-limit states.

### Exit Criteria

- User can enter a token and fetch repos.
- Real repositories display score and issue feedback.
- Mock mode still works when no token is present.

## Phase 3: OpenRouter Integration

### Objectives

- Add AI generation without leaking provider secrets to the client.

### Tasks

1. Add serverless function for OpenRouter requests.
2. Define request and response types.
3. Add prompt builder based on selected repo analysis.
4. Add AI generation panel with:
   - generate action
   - loading state
   - sectioned outputs
5. Parse and render:
   - description suggestion
   - README suggestion
   - topics suggestion
   - deploy suggestion

### Exit Criteria

- Generate action returns structured content from OpenRouter.
- Failure states are visible and recoverable.

## Phase 4: Polish

### Objectives

- Make the MVP reliable and presentable.

### Tasks

1. Add copy-to-clipboard actions for each AI output section.
2. Add toast or inline status feedback.
3. Improve skeleton and empty states.
4. Tighten responsive behavior and spacing.
5. Audit UI text for clarity and brevity.
6. Add environment variable documentation.

### Exit Criteria

- Copy actions work across all generated outputs.
- Error states are understandable.
- UI feels production-minded, not scaffold-like.

## Proposed File Milestones

### Phase 1

- `src/App.tsx`
- `src/index.css`
- `src/components/*`
- `src/features/repos/mockData.ts`
- `src/features/repos/scoring.ts`
- `src/types/*`
- `tailwind.config.js` or `tailwind.config.ts`
- `postcss.config.js`

### Phase 2

- `src/features/github/*`
- `src/lib/github.ts`

### Phase 3

- `api/generate.ts`
- `src/features/ai/*`
- `src/lib/openrouter.ts`

### Phase 4

- small refinements across existing files

## Risks and Mitigations

- GitHub auth complexity:
  Use token input first.
- API rate limits:
  keep requests narrow and lazy-load README detail.
- Overly complex AI responses:
  enforce structured JSON output.
- Scope creep:
  keep update/push workflows out of MVP.

## Verification Plan

- After each phase:
  - run `npm run build`
  - run `npm run lint`
- For integration phases:
  - verify empty and failure states manually
  - verify mobile layout in browser
