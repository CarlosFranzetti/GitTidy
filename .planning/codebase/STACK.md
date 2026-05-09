# Technology Stack

**Analysis Date:** 2026-05-09

## Languages

**Primary:**
- TypeScript 6.0.2 - All frontend (React components, hooks, utilities) and all backend serverless functions in `api/`

**Secondary:**
- None detected (no Python, Go, Rust, etc.)

## Runtime

**Environment:**
- Node.js (version unspecified; inferred from `@types/node ^24.12.2` dev dependency)
- Browser (ES2023 target with DOM lib for frontend code)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present — confirmed by node_modules/ presence)

## Frameworks

**Core:**
- React 19.2.5 - UI framework; single-page application with no router
- Tailwind CSS 4.2.4 - Utility-first styling, integrated via `@tailwindcss/vite` plugin

**Build/Dev:**
- Vite 8.0.10 - Frontend bundler and dev server; config at `vite.config.ts`
- Vercel CLI 53.2.0 - Full-stack local dev via `vercel dev`; also handles deployment

**No testing framework detected** - No Jest, Vitest, Playwright, or Cypress configuration found.

## Key Dependencies

**Critical:**
- `react` ^19.2.5 - Core UI runtime
- `react-dom` ^19.2.5 - DOM rendering

**Build Infrastructure:**
- `@vitejs/plugin-react` ^6.0.1 - Vite plugin for React JSX transform and Fast Refresh
- `@tailwindcss/vite` ^4.2.4 - Tailwind CSS v4 integration as Vite plugin
- `typescript` ~6.0.2 - TypeScript compiler; drives `npm run build` type-checking via `tsc -b`
- `vercel` ^53.2.0 - Local dev server for serverless functions; also used for env var sync

**Linting:**
- `eslint` ^10.2.1 - Flat config format (`eslint.config.js`)
- `typescript-eslint` ^8.58.2 - TypeScript-aware lint rules
- `eslint-plugin-react-hooks` ^7.1.1 - Enforces React hooks rules
- `eslint-plugin-react-refresh` ^0.5.2 - Vite Fast Refresh compatibility rules
- `@eslint/js` ^10.1.0 - Core JavaScript recommended rules
- `globals` ^17.5.0 - Global variable definitions for browser/node environments

**Type Definitions:**
- `@types/node` ^24.12.2 - Node.js types for serverless functions
- `@types/react` ^19.2.14 - React TypeScript types
- `@types/react-dom` ^19.2.3 - ReactDOM TypeScript types

**Runtime AI/Backend SDK:**
- No third-party SDK — OpenRouter is called via native `fetch()` in `api/generate.ts` and `api/context.ts`
- No third-party SDK — GitHub API is called via native `fetch()` in `src/features/github/client.ts`

## Configuration

**TypeScript — Dual tsconfig:**
- `tsconfig.json` - Root, references `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` - Frontend: target ES2023, lib DOM, jsx react-jsx, includes `src/`
- `tsconfig.node.json` - Backend/Vite config: target ES2023, lib Node, includes `vite.config.ts`
- Both enforce `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`
- Both use `moduleResolution: bundler`

**Environment:**
- `.env.local` — local secrets file (present, not committed)
- `.env.example` — template with all required keys (committed)
- Serverless functions read env via `process.env` with fallback to `.env.local` file parsing (`readEnvValue()`)

**Build:**
- `npm run build` → `tsc -b && vite build` → output to `dist/`
- `npm run dev` → Vite only (frontend, port 5173)
- `npm run dev:full` → `vercel dev` (frontend + serverless functions, port 3000)

## Platform Requirements

**Development:**
- Node.js (latest LTS implied by `@types/node ^24`)
- npm
- Vercel CLI for full-stack local development
- `.env.local` with `OPENROUTER_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- GitHub OAuth app with callback set to `http://localhost:3000/api/github/oauth/callback`

**Production:**
- Vercel (frontend + serverless functions deployed together)
- Environment variables configured in Vercel project settings
- Serverless functions live in `api/` directory, auto-deployed as Vercel Functions

---

*Stack analysis: 2026-05-09*
