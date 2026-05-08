# GitTidy

GitTidy turns messy GitHub repos into portfolio-ready projects.

It connects to GitHub, lets you select one or more repositories, asks AI to infer missing project context from repo metadata and markdown files, then generates a clean preview of README, description, topic, and deploy-link improvements before anything is committed.

## Why It Exists

Students and indie developers ship real work, then bury it behind thin READMEs, missing descriptions, no topics, and no deploy links. GitTidy is the small cleanup pass before you send someone your GitHub profile.

## What It Does

- Connects to GitHub with a token-first MVP auth flow.
- Lists repositories and lets you select one or more.
- Samples repo metadata, README markdown, docs markdown, and lightweight config files.
- Uses OpenRouter with Baidu Qianfan CoBuddy free model.
- Infers useful context so you do not have to fill out every field manually.
- Generates previewable improvements for each selected repo.
- Keeps commit/push disabled until a final diff and write-scope GitHub flow are added.

## Current MVP Flow

1. Connect GitHub.
2. Select repos.
3. Click `Infer from repos` to prefill context.
4. Edit the context if needed.
5. Generate previews.
6. Copy or review the proposed changes.

No repo files are changed automatically yet.

## Tech Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Vercel serverless functions
- GitHub API
- OpenRouter API
- Baidu Qianfan CoBuddy free model

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` in the project root:

```env
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=baidu/cobuddy:free
```

Run the full local app:

```bash
npm run dev:full
```

Open:

```text
http://localhost:3000/
```

Use `npm run dev` only when working on frontend-only UI. AI routes require `npm run dev:full`.

## Scripts

- `npm run dev`: Vite frontend only
- `npm run dev:full`: Vite plus Vercel API routes
- `npm run build`: type-check and build
- `npm run lint`: lint
- `npm run preview`: preview production build

## Environment Variables

`OPENROUTER_API_KEY` is used only inside serverless functions. Do not prefix it with `VITE_`.

`OPENROUTER_MODEL` defaults to:

```text
baidu/cobuddy:free
```

## Project Status

GitTidy is an MVP. It can fetch repositories, infer context, and generate previews. The next major step is safe write support:

- request write-scope GitHub auth
- show final file diffs
- commit generated changes to a branch
- open a pull request

## Validation

```bash
npm run build
npm run lint
```

## License

MIT
