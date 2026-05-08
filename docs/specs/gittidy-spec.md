# GitTidy MVP Spec

## Product Summary

GitTidy is an AI-assisted repository cleanup tool for students and indie developers. It helps users identify low-effort GitHub repo hygiene issues and generate better presentation content without requiring a full platform backend.

The MVP is intentionally narrow:

- Authenticate with GitHub in the simplest viable way.
- Fetch a user's repositories.
- Score each repository on a few visible quality signals.
- Let the user inspect one repository in detail.
- Generate improved repo content with OpenRouter.
- Let the user copy outputs and apply changes manually later.

## Users

- Students building portfolios from school or side projects.
- Indie developers maintaining multiple unfinished or lightly documented repos.

## MVP Goals

- Make repo quality issues obvious in under 30 seconds.
- Produce useful README, description, topic, and deploy suggestions.
- Avoid backend persistence and database work.
- Keep deployment compatible with a static frontend plus serverless functions.

## Non-Goals

- Full repository editing or commit/push automation.
- Multi-user collaboration.
- Historical analytics.
- Complex GitHub org admin workflows.
- OAuth setup that requires a large auth subsystem on day one.

## Core User Flow

1. User opens GitTidy.
2. User authenticates with GitHub or provides a GitHub token in a scoped MVP flow.
3. App fetches repositories via GitHub API.
4. User browses repo cards with a quality score.
5. User selects a repo.
6. App analyzes:
   - README quality
   - missing description
   - missing homepage or deploy link
   - missing topics
7. User requests AI improvements.
8. Serverless function calls OpenRouter and returns:
   - improved README
   - improved description
   - suggested topics
   - deploy suggestions
9. User copies outputs for manual use.

## MVP Functional Requirements

### Repository Dashboard

- Display repository cards in a responsive grid.
- Each card shows:
  - repo name
  - description or missing-description status
  - visibility
  - language
  - last updated date
  - quality score
  - key issue badges
- Allow selecting a repository card to open detail analysis.

### Repository Analysis

- Calculate a simple score from 0-100.
- Score should be deterministic and explainable.
- Initial scoring inputs:
  - README present and non-trivial
  - description present
  - homepage present
  - topics count greater than zero
- Show issue-level feedback, not just the score.

### AI Suggestions

- Trigger AI generation on demand from the selected repository.
- Use OpenRouter through a serverless function so the API key is not exposed in the client.
- Generate:
  - replacement README markdown
  - short repository description
  - 3-5 topic suggestions
  - deployment suggestions based on repo type

### Copy Actions

- Provide copy actions for:
  - generated README
  - generated description
  - generated topics
  - generated deploy suggestions
- Show lightweight success or failure feedback.

### Error Handling

- Handle:
  - missing GitHub token/auth
  - GitHub API failures and rate limits
  - OpenRouter failures
  - empty repository lists
  - clipboard failures

## UX Requirements

- Responsive from mobile through desktop.
- Fast first interaction with mock data even before live GitHub setup.
- Visual direction: dark productivity UI with bright accents and clear scoring states.
- Dense enough to scan multiple repos quickly without looking like admin clutter.

## Technical Architecture

### Frontend

- Vite
- React
- TypeScript
- Tailwind CSS

### Backend Surface

- No database.
- No long-lived backend.
- Serverless functions only.

### External Integrations

- GitHub API for repository metadata and README lookup.
- OpenRouter for text generation.

## Simplified Auth Strategy

The MVP should avoid full OAuth complexity unless needed for deployment target constraints.

Preferred first implementation:

- Support a user-provided GitHub personal access token in the client.
- Store token in local state or local storage with clear caveats.
- Use fine-grained or classic tokens with repo-read scope guidance.

Future option:

- Upgrade to GitHub OAuth via serverless callback once product value is validated.

## Data Model

### Repository Summary

- `id`
- `name`
- `fullName`
- `description`
- `private`
- `language`
- `updatedAt`
- `htmlUrl`
- `homepage`
- `topics`
- `defaultBranch`
- `hasReadme`
- `readmeWordCount`
- `score`
- `issues`

### AI Suggestion Payload

- `repoName`
- `description`
- `readme`
- `topics`
- `homepage`
- `language`
- `suggestedDescription`
- `suggestedReadme`
- `suggestedTopics`
- `deploySuggestions`

## Delivery Phases

### Phase 1

- Tailwind setup
- app shell
- mock repo dashboard

### Phase 2

- GitHub token entry flow
- GitHub API integration
- real repo fetch
- repo scoring utilities

### Phase 3

- serverless OpenRouter function
- AI generation UI
- generated content panels

### Phase 4

- copy actions
- loading and error states
- responsive polish
- basic empty states

## Acceptance Criteria

- App runs locally and builds successfully.
- Mock dashboard is usable before live integrations are configured.
- At least one selected repo view shows score, issues, and generated content placeholders.
- Live GitHub fetch works with a supplied token.
- OpenRouter generation works through a serverless endpoint.
- Copy actions work for generated outputs.
