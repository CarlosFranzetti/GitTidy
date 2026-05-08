# GitTidy MVP Spec

## Product Summary

GitTidy is an AI-assisted repository cleanup tool for students and indie developers. It helps users identify low-effort GitHub repo hygiene issues and generate better presentation content without requiring a full platform backend.

The MVP is intentionally narrow:

- Authenticate with GitHub OAuth.
- Fetch a user's repositories.
- Score each repository on a few visible quality signals.
- Let the user inspect one repository in detail.
- Generate improved repo content with OpenRouter.
- Let the user copy outputs or apply optional GitHub write-back only after
  confirmation.

## Users

- Students building portfolios from school or side projects.
- Indie developers maintaining multiple unfinished or lightly documented repos.

## MVP Goals

- Make repo quality issues obvious in under 30 seconds.
- Produce useful README, description, topic, and deploy suggestions.
- Avoid backend persistence and database work.
- Keep deployment compatible with a static frontend plus serverless functions.

## Non-Goals

- Automatic repository editing.
- Multi-user collaboration.
- Historical analytics.
- Complex GitHub org admin workflows.
- Database-backed sessions or a large auth subsystem.

## Core User Flow

1. User opens GitTidy.
2. User authenticates with GitHub OAuth.
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
9. User copies outputs or explicitly confirms a GitHub write-back action.

## MVP Functional Requirements

### Repository Dashboard

- Display a simple repository list.
- Each card shows:
  - repo name
  - description or missing-description status
  - visibility
  - language
  - last updated date
  - quality score
  - key issue badges
- Allow selecting a repository card to open detail analysis.

### Repository Detail And Analysis

- When a repo is clicked, fetch:
  - `GET /repos/{owner}/{repo}`
  - `GET /repos/{owner}/{repo}/readme`
- Decode the README API response from base64.
- Show the existing README in a preview panel.
- Calculate a deterministic score from 0-100:
  - README exists: 25 points
  - README longer than 300 characters: 20 points
  - description exists: 20 points
  - homepage/deploy link exists: 20 points
  - at least 3 topics exist: 15 points
- Show issue-level feedback, not just the score.
- Show this warning when homepage is empty:
  `No deployed URL detected. Add a Vercel link so people can actually click the thing you built.`

### AI Suggestions

- Trigger AI generation on demand from the selected repository.
- Use OpenRouter through a serverless function so the API key is not exposed in the client.
- Generate:
  - replacement README markdown
  - short repository description
  - 5-8 topic suggestions
  - deployment suggestions based on repo type

### Copy And Write Actions

- Provide a generated README preview panel.
- Provide a `Copy README` action.
- Provide optional write-back actions:
  - `Update README on GitHub`
  - `Update repo description/topics/homepage`
- Show a confirmation modal before any GitHub write action.
- Never auto-write to GitHub.
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
- Dark background by default.
- Provide a light/dark toggle.
- Keep the interface sleek and focused rather than dashboard-heavy.

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

## Auth Strategy

- Use GitHub OAuth through serverless callback endpoints.
- Store the returned access token client-side for the MVP.
- Request repo scope because optional write-back needs repository contents and
  metadata permissions.
- Keep all writes behind explicit confirmation modals.

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
- `readme_md`
- `description`
- `topics`
- `deploy_suggestion`

## Delivery Phases

### Phase 1

- Tailwind setup
- app shell
- mock repo dashboard

### Phase 2

- GitHub OAuth flow
- GitHub API integration
- real repo fetch
- repo scoring utilities

### Phase 3

- serverless OpenRouter function
- AI generation UI
- existing and generated README preview panels

### Phase 4

- copy actions
- optional confirmed write-back actions
- loading and error states
- responsive polish
- basic empty states

## Acceptance Criteria

- App runs locally and builds successfully.
- Selected repo view shows score checklist and existing README preview.
- Live GitHub fetch works after OAuth.
- OpenRouter generation works through a serverless endpoint.
- Copy action works for generated README.
- GitHub write actions require confirmation and never run automatically.
