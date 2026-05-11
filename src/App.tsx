import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generateSuggestions } from './features/ai/client'
import type { AiSuggestions, RepoGenerationInput } from './features/ai/types'
import {
  fetchRepositories,
  fetchRepositoryContextText,
  fetchRepositoryDetails,
  fetchRepositoryReadme,
  fetchViewer,
  GitHubClientError,
  updateRepositoryReadme,
  updateRepositoryMetadata,
} from './features/github/client'
import { normalizeGitHubRepo } from './features/github/normalize'
import { copyText } from './lib/clipboard'
import type { RepoRecord } from './types/repo'

const STORAGE_KEY = 'gittidy.github-token'
const THEME_KEY = 'gittidy.theme'
const DEPLOY_WARNING =
  'No deployed URL detected. Add a Vercel link so people can actually click the thing you built.'

type Theme = 'dark' | 'light'

type ActiveRepo = {
  repo: RepoRecord
  readme: string
  readmeSha?: string
  isLoading: boolean
}

type ScoreChecklist = {
  hasReadme: boolean
  hasDetailedReadme: boolean
  hasDescription: boolean
  hasHomepage: boolean
  hasTopics: boolean
}

type PendingAction = {
  title: string
  body: string
  confirmLabel: string
  run: () => Promise<void>
}

type WriteSelection = {
  readme: boolean
  description: boolean
  topics: boolean
  homepage: boolean
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (window.localStorage.getItem(THEME_KEY) as Theme | null) ?? 'dark'
  })
  const [githubToken, setGithubToken] = useState(() => {
    if (typeof window === 'undefined') return ''
    return (
      new URLSearchParams(window.location.search).get('github_token') ??
      window.localStorage.getItem(STORAGE_KEY) ??
      ''
    )
  })
  const [viewerName, setViewerName] = useState('')
  const [repos, setRepos] = useState<RepoRecord[]>([])
  const [activeRepo, setActiveRepo] = useState<ActiveRepo | null>(null)
  const [generated, setGenerated] = useState<AiSuggestions | null>(null)
  const [writeSelection, setWriteSelection] = useState<WriteSelection | null>(null)
  const [homepageDraft, setHomepageDraft] = useState('')
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isWriting, setIsWriting] = useState(false)
  const [message, setMessage] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('error') ?? ''
  })
  const [copyMessage, setCopyMessage] = useState('')
  const [debugRawAi, setDebugRawAi] = useState<string | null>(null)
  const [appView, setAppView] = useState<'list' | 'detail'>('list')
  const [retryTone, setRetryTone] = useState('fun')
  const [retryNotes, setRetryNotes] = useState('')
  const [refinementInput, setRefinementInput] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [codeContext, setCodeContext] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [repoFilter, setRepoFilter] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedTopics, setEditedTopics] = useState('')

  const score = useMemo(
    () => calculateScore(activeRepo?.repo, activeRepo?.readme ?? ''),
    [activeRepo],
  )

  const displayedRepos = useMemo(() => {
    const filtered = repoFilter
      ? repos.filter((r) => r.fullName.toLowerCase().includes(repoFilter.toLowerCase()))
      : repos
    return [...filtered].sort((a, b) => sortAsc ? a.score - b.score : b.score - a.score)
  }, [repos, repoFilter, sortAsc])

  const selectedOwnerRepo = activeRepo ? splitFullName(activeRepo.repo.fullName) : null

  const appClass =
    theme === 'dark'
      ? 'min-h-dvh bg-[#070b12] text-slate-100'
      : 'min-h-dvh bg-slate-50 text-slate-950'
  const panelClass =
    theme === 'dark'
      ? 'border-white/[0.08] bg-white/[0.06] shadow-2xl shadow-violet-950/50'
      : 'border-slate-200 bg-white shadow-xl shadow-slate-200/60'
  const mutedText = theme === 'dark' ? 'text-slate-400' : 'text-slate-600'

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('github_token')
    const error = params.get('error')

    if (!token && !error) return

    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token)
    }
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  useEffect(() => {
    if (!githubToken) return
    void loadRepos(githubToken)
  }, [githubToken])

  // ─── Repo list sidebar content ───────────────────────────────────────────
  const repoListContent = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Repositories</h2>
          <p className={`text-sm ${mutedText}`}>
            {githubToken
              ? isLoadingRepos
                ? 'Loading GitHub repos...'
                : `${displayedRepos.length} of ${repos.length} repos`
              : 'OAuth required'}
          </p>
        </div>
        {githubToken ? (
          <button
            type="button"
            onClick={() => void loadRepos(githubToken)}
            className={buttonClass(theme, 'ghost')}
          >
            Refresh
          </button>
        ) : null}
      </div>

      {githubToken && !isLoadingRepos && repos.length > 0 ? (
        <div className="mb-3 flex gap-2">
          <input
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            placeholder="Filter repos..."
            className={`h-9 flex-1 rounded-lg border px-3 text-sm outline-none transition duration-150 ${
              theme === 'dark'
                ? 'border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-violet-400/60'
                : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950'
            }`}
          />
          <button
            type="button"
            onClick={() => setSortAsc((v) => !v)}
            title={sortAsc ? 'Sorted: worst first' : 'Sorted: best first'}
            className={buttonClass(theme, 'secondary')}
          >
            {sortAsc ? '↑ Score' : '↓ Score'}
          </button>
        </div>
      ) : null}

      {!githubToken ? (
        <div className={`rounded-xl border border-dashed p-4 text-sm leading-6 ${mutedText}`}>
          GitHub OAuth is required to fetch repo details and write changes.
          The app does not write anything automatically.
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[calc(100vh-260px)] space-y-2 pr-1">
          {displayedRepos.map((repo) => (
            <div
              key={repo.id}
              className={`relative rounded-xl border transition ${
                activeRepo?.repo.id === repo.id
                  ? theme === 'dark'
                    ? 'border-violet-400/60 bg-violet-400/[0.08]'
                    : 'border-slate-950 bg-slate-950 text-white'
                  : theme === 'dark'
                    ? 'border-white/10 bg-white/[0.04] hover:border-white/25'
                    : 'border-slate-200 bg-white hover:border-slate-400'
              }`}
            >
              <button
                type="button"
                onClick={() => void selectRepo(repo)}
                className="block w-full p-3 pr-24 text-left"
              >
                <span className="block truncate text-sm font-semibold">{repo.fullName}</span>
                <span
                  className={`mt-1 block truncate text-xs ${
                    activeRepo?.repo.id === repo.id && theme === 'light'
                      ? 'text-slate-300'
                      : mutedText
                  }`}
                >
                  {repo.language} · {repo.description || 'No description yet'}
                </span>
              </button>
              <div className="absolute right-2 top-2 flex items-center gap-1.5">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    activeRepo?.repo.id === repo.id && theme === 'light'
                      ? 'bg-white/20 text-white'
                      : theme === 'dark'
                        ? 'bg-white/10 text-slate-300'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {repo.score}
                </span>
                <a
                  href={`https://github.com/${repo.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open on GitHub"
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition ${
                    activeRepo?.repo.id === repo.id && theme === 'light'
                      ? 'border-white/30 bg-white/20 text-white hover:bg-white/30'
                      : theme === 'dark'
                        ? 'border-white/20 bg-white/[0.08] text-slate-200 hover:bg-white/[0.14] hover:border-white/30'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                  }`}
                >
                  ↗ GitHub
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  // ─── Detail / main content ────────────────────────────────────────────────
  const detailContent = !activeRepo ? (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={goBack}
        className={`md:hidden ${buttonClass(theme, 'ghost', '-ml-3')}`}
      >
        ← Back to repos
      </button>
      <EmptyState theme={theme} />
    </div>
  ) : (
    <div className="space-y-5">
      <div className="flex items-center pb-1 md:hidden">
        <button type="button" onClick={goBack} className={buttonClass(theme, 'ghost', '-ml-3')}>
          ← Repos
        </button>
      </div>
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className={`text-sm ${mutedText}`}>Selected repo</p>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="truncate text-2xl font-semibold">
              {activeRepo.repo.fullName}
            </h2>
            <a
              href={`https://github.com/${activeRepo.repo.fullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition ${
                theme === 'dark'
                  ? 'border-white/20 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12] hover:border-white/30'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              ↗ GitHub
            </a>
          </div>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${mutedText}`}>
            {activeRepo.repo.description || 'No GitHub description yet.'}
          </p>
          {!score.checklist.hasHomepage ? (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                theme === 'dark'
                  ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {DEPLOY_WARNING}
            </div>
          ) : null}
        </div>
        <div
          className={`shrink-0 rounded-2xl border px-5 py-4 text-center ${
            theme === 'dark' ? 'border-violet-400/20 bg-violet-500/[0.07]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${mutedText}`}>
            Score
          </p>
          <p
            className={`mt-1 text-5xl font-semibold tracking-[-0.02em] ${
              theme === 'dark' ? 'text-violet-200' : 'text-slate-900'
            }`}
          >
            {score.total}
          </p>
          <p className={`text-xs ${mutedText}`}>/ 100</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Checklist checklist={score.checklist} theme={theme} />
          <label className="block">
            <span className={`text-sm font-medium ${mutedText}`}>Deploy URL</span>
            <input
              value={homepageDraft}
              onChange={(event) => setHomepageDraft(event.target.value)}
              placeholder="https://your-project.vercel.app"
              className={inputClass(theme)}
            />
          </label>
          {!generated && score.total >= 80 ? (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                theme === 'dark'
                  ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              <p className="font-semibold">This repo already scores {score.total}/100.</p>
              <p className={`mt-0.5 text-xs ${theme === 'dark' ? 'text-emerald-400/80' : 'text-emerald-700'}`}>
                README, description, topics, and deploy link all look good.
              </p>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || activeRepo.isLoading}
                className="mt-2 text-xs underline opacity-70 transition hover:opacity-100"
              >
                {isGenerating ? 'Generating...' : 'Generate anyway'}
              </button>
            </div>
          ) : !generated ? (
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || activeRepo.isLoading}
              className={buttonClass(theme, 'primary', 'w-full')}
            >
              {isGenerating ? 'Generating...' : 'Generate Beautified README'}
            </button>
          ) : (
            <div className="space-y-3">
              <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${mutedText}`}>
                Try again with different tone
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(['fun', 'professional', 'minimal', 'technical'] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setRetryTone(tone)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition duration-150 ${
                      retryTone === tone
                        ? theme === 'dark'
                          ? 'bg-violet-500 text-white'
                          : 'bg-slate-950 text-white'
                        : theme === 'dark'
                          ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              <textarea
                value={retryNotes}
                onChange={(e) => setRetryNotes(e.target.value)}
                placeholder="Extra context, constraints, or instructions..."
                rows={3}
                className={`w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition duration-150 ${
                  theme === 'dark'
                    ? 'border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-violet-400/60'
                    : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950'
                }`}
              />
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || activeRepo.isLoading}
                className={buttonClass(theme, 'primary', 'w-full')}
              >
                {isGenerating ? 'Generating...' : 'Regenerate'}
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ReadmePanel
            title={activeRepo.readme ? 'Existing README' : codeContext ? 'Code analysis' : 'Existing README'}
            value={
              activeRepo.isLoading
                ? 'Fetching README and analyzing code...'
                : activeRepo.readme || codeContext || 'No README or code analysis available.'
            }
            theme={theme}
          />
          <ReadmePanel
            title="Generated README"
            value={generated?.readmeMd || 'Generate a beautified README to preview it here.'}
            theme={theme}
          />
        </div>
      </div>

      {generated ? (
        <div
          className={`rounded-2xl border p-4 ${
            theme === 'dark' ? 'border-white/[0.08]' : 'border-slate-200'
          }`}
        >
          <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] ${mutedText}`}>
            Refine the generated README
          </p>
          <textarea
            value={refinementInput}
            onChange={(e) => setRefinementInput(e.target.value)}
            placeholder="e.g. Add a contributing section, make it shorter, add API docs..."
            rows={3}
            className={`w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition duration-150 ${
              theme === 'dark'
                ? 'border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-violet-400/60'
                : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950'
            }`}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => void handleRefine()}
              disabled={isRefining || !refinementInput.trim()}
              className={buttonClass(theme, 'secondary')}
            >
              {isRefining ? 'Refining...' : 'Refine README'}
            </button>
          </div>
        </div>
      ) : null}

      {generated && writeSelection ? (
        <div className="rounded-2xl border border-white/10 p-4">
          <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.14em] ${mutedText}`}>
            Select items to write to GitHub
          </p>
          <div className="space-y-2">
            <SelectionCheckbox
              id="sel-readme"
              label="README rewrite"
              checked={writeSelection.readme}
              theme={theme}
              onChange={() => toggleWriteSelection('readme')}
            />
            <SelectionCheckbox
              id="sel-description"
              label="Description"
              checked={writeSelection.description}
              theme={theme}
              onChange={() => toggleWriteSelection('description')}
            />
            {writeSelection.description ? (
              <input
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className={`ml-7 h-8 w-[calc(100%-1.75rem)] rounded-lg border px-3 text-sm outline-none transition duration-150 ${
                  theme === 'dark'
                    ? 'border-white/10 bg-black/20 text-slate-100 focus:border-violet-400/60'
                    : 'border-slate-300 bg-white text-slate-950 focus:border-slate-950'
                }`}
              />
            ) : null}
            <SelectionCheckbox
              id="sel-topics"
              label="Topics"
              checked={writeSelection.topics}
              theme={theme}
              onChange={() => toggleWriteSelection('topics')}
            />
            {writeSelection.topics ? (
              <input
                value={editedTopics}
                onChange={(e) => setEditedTopics(e.target.value)}
                placeholder="comma-separated topics"
                className={`ml-7 h-8 w-[calc(100%-1.75rem)] rounded-lg border px-3 text-sm outline-none transition duration-150 ${
                  theme === 'dark'
                    ? 'border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-violet-400/60'
                    : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950'
                }`}
              />
            ) : null}
            <SelectionCheckbox
              id="sel-homepage"
              label="Deploy suggestion / homepage"
              checked={writeSelection.homepage}
              theme={theme}
              onChange={() => toggleWriteSelection('homepage')}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyReadme()}
              className={buttonClass(theme, 'secondary')}
            >
              Copy README
            </button>
            <button
              type="button"
              onClick={handleDownloadReadme}
              className={buttonClass(theme, 'secondary')}
            >
              Download .md
            </button>
            <button
              type="button"
              onClick={confirmApplySelected}
              disabled={
                !writeSelection.readme &&
                !writeSelection.description &&
                !writeSelection.topics &&
                !writeSelection.homepage
              }
              className={buttonClass(theme, 'primary')}
            >
              Apply Selected
            </button>
          </div>
          {copyMessage ? (
            <p className="mt-3 text-sm text-emerald-400">{copyMessage}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  return (
    <main className={appClass}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={`text-sm font-medium ${mutedText}`}>GitTidy</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              Polish the repo before anyone clicks it.
            </h1>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${mutedText}`}>
              Sign in, pick a repo, preview the existing README, generate a
              cleaner one, then copy or write changes only after confirmation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              className={buttonClass(theme, 'secondary')}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            {githubToken ? (
              <button type="button" onClick={disconnect} className={buttonClass(theme, 'secondary')}>
                Disconnect
              </button>
            ) : null}
            <button type="button" onClick={startGitHubOAuth} className={buttonClass(theme, 'primary')}>
              {githubToken ? `@${viewerName || 'GitHub'}` : 'Sign in with GitHub'}
            </button>
          </div>
        </header>

        {/* Non-blocking dismissable error toast */}
        {message ? (
          <div
            className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-sm ${
              theme === 'dark'
                ? 'border-amber-400/30 bg-[#101827]/90 text-amber-100'
                : 'border-amber-200 bg-white/95 text-amber-900'
            }`}
          >
            <span className="flex-1 leading-5">{message}</span>
            <button
              type="button"
              onClick={() => setMessage('')}
              className="mt-0.5 shrink-0 opacity-50 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ) : null}

        {debugRawAi ? (
          <DebugPanel rawContent={debugRawAi} theme={theme} onClose={() => setDebugRawAi(null)} />
        ) : null}

        <div className="flex-1">
          {/* Mobile: single-view toggle */}
          <div className="md:hidden">
            {appView === 'list' ? (
              <aside className={`rounded-2xl border p-4 ${panelClass}`}>
                {repoListContent}
              </aside>
            ) : (
              <section className={`rounded-2xl border p-4 ${panelClass}`}>
                {detailContent}
              </section>
            )}
          </div>

          {/* Desktop: persistent sidebar + main */}
          <div className="hidden md:grid md:grid-cols-[300px_1fr] md:gap-4">
            <aside className={`rounded-2xl border p-4 ${panelClass}`}>
              {repoListContent}
            </aside>
            <section className={`rounded-2xl border p-4 md:p-5 ${panelClass}`}>
              {detailContent}
            </section>
          </div>
        </div>
      </div>

      {pendingAction ? (
        <ConfirmationModal
          action={pendingAction}
          isWriting={isWriting}
          theme={theme}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void runPendingAction()}
        />
      ) : null}
    </main>
  )

  async function loadRepos(token: string) {
    setIsLoadingRepos(true)
    setMessage('')

    try {
      const [viewer, repoResponses] = await Promise.all([
        fetchViewer(token),
        fetchRepositories(token),
      ])
      const nextRepos = repoResponses.map((repo) => normalizeGitHubRepo(repo))

      setViewerName(viewer.login || viewer.name || '')
      setRepos(nextRepos)
    } catch (error: unknown) {
      setMessage(resolveError(error, 'GitHub connection failed.'))
    } finally {
      setIsLoadingRepos(false)
    }
  }

  async function selectRepo(repo: RepoRecord) {
    if (!githubToken) return

    setMessage('')
    setGenerated(null)
    setWriteSelection(null)
    setHomepageDraft(repo.homepage)
    setRefinementInput('')
    setRetryNotes('')
    setCodeContext('')
    setEditedDescription('')
    setEditedTopics('')
    setAppView('detail')
    setActiveRepo({ repo, readme: '', isLoading: true })

    const { owner, name } = splitFullName(repo.fullName)

    try {
      const [details, readme] = await Promise.all([
        fetchRepositoryDetails(owner, name, githubToken),
        fetchRepositoryReadme(owner, name, githubToken),
      ])
      const decodedReadme = readme?.decodedContent ?? ''
      const normalized = normalizeGitHubRepo(details, countWords(decodedReadme))

      if (!decodedReadme) {
        fetchRepositoryContextText(owner, name, details.default_branch, githubToken)
          .then((ctx) => setCodeContext(ctx))
          .catch(() => undefined)
      }

      setHomepageDraft(normalized.homepage)
      setActiveRepo({
        repo: {
          ...normalized,
          readmeLoaded: true,
          readmeExcerpt: truncateForPrompt(decodedReadme),
        },
        readme: decodedReadme,
        readmeSha: readme?.sha,
        isLoading: false,
      })
      setRepos((current) =>
        current.map((item) => (item.id === normalized.id ? normalized : item)),
      )
    } catch (error: unknown) {
      setMessage(resolveError(error, 'Could not load repo details.'))
      setActiveRepo((current) => (current ? { ...current, isLoading: false } : current))
    }
  }

  async function handleGenerate() {
    if (!activeRepo) return

    setIsGenerating(true)
    setMessage('')
    setDebugRawAi(null)

    try {
      const response = await generateSuggestions({
        repos: [toGenerationInput(activeRepo.repo, activeRepo.readme || codeContext)],
        context: {
          projectGoal: 'Make this repository clear, clickable, and portfolio-ready.',
          audience: 'students, recruiters, collaborators, and indie builders',
          deployTarget: homepageDraft || activeRepo.repo.homepage || 'Vercel if this is a web app',
          tone: toToneString(retryTone),
          extraNotes: retryNotes
            ? `User notes: ${retryNotes}`
            : 'Do not invent features. Use only the repository metadata and existing README.',
        },
      })

      const preview = response.previews[0] ?? null
      setGenerated(preview)
      if (preview) {
        setWriteSelection({ readme: true, description: true, topics: true, homepage: true })
        setEditedDescription(preview.description)
        setEditedTopics(preview.topics.join(', '))
      } else {
        setWriteSelection(null)
      }
    } catch (error: unknown) {
      const rawContent =
        typeof error === 'object' &&
        error !== null &&
        'rawContent' in error &&
        typeof (error as Record<string, unknown>).rawContent === 'string'
          ? (error as { rawContent: string }).rawContent
          : undefined
      setMessage(
        rawContent
          ? 'GitTidy could not parse the AI response. Try again.'
          : resolveError(error, 'AI generation failed.'),
      )
      if (rawContent) setDebugRawAi(rawContent)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCopyReadme() {
    if (!generated) return

    try {
      await copyText(generated.readmeMd)
      setCopyMessage('README copied.')
      window.setTimeout(() => setCopyMessage(''), 1500)
    } catch {
      setCopyMessage('Clipboard write failed.')
    }
  }

  function toggleWriteSelection(field: keyof WriteSelection) {
    setWriteSelection((current) =>
      current ? { ...current, [field]: !current[field] } : current,
    )
  }

  function confirmApplySelected() {
    if (!activeRepo || !generated || !selectedOwnerRepo || !writeSelection) return

    const selectedItems: string[] = []
    if (writeSelection.readme) selectedItems.push('README rewrite')
    if (writeSelection.description) selectedItems.push('Description')
    if (writeSelection.topics) selectedItems.push('Topics')
    if (writeSelection.homepage) selectedItems.push('Deploy suggestion / homepage')

    if (selectedItems.length === 0) return

    const itemList = selectedItems.map((item) => `• ${item}`).join('\n')
    const modalBody =
      `The following items will be written to ${activeRepo.repo.fullName}:\n\n${itemList}\n\n` +
      'Items you left unchecked will not be changed.'

    setPendingAction({
      title: 'Apply selected improvements?',
      body: modalBody,
      confirmLabel: `Apply ${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'}`,
      run: async () => {
        if (writeSelection.readme) {
          await updateRepositoryReadme({
            owner: selectedOwnerRepo.owner,
            repo: selectedOwnerRepo.name,
            token: githubToken,
            content: generated.readmeMd,
            sha: activeRepo.readmeSha,
          })
        }

        const needsMetadata =
          writeSelection.description ||
          writeSelection.topics ||
          writeSelection.homepage

        if (needsMetadata) {
          await updateRepositoryMetadata({
            owner: selectedOwnerRepo.owner,
            repo: selectedOwnerRepo.name,
            token: githubToken,
            description: writeSelection.description
              ? editedDescription
              : activeRepo.repo.description,
            topics: writeSelection.topics
              ? editedTopics.split(',').map((t) => t.trim()).filter(Boolean)
              : activeRepo.repo.topics,
            homepage: writeSelection.homepage
              ? homepageDraft.trim()
              : activeRepo.repo.homepage,
          })
        }

        await selectRepo(activeRepo.repo)
      },
    })
  }

  async function runPendingAction() {
    if (!pendingAction) return

    setIsWriting(true)
    setMessage('')

    try {
      await pendingAction.run()
      setPendingAction(null)
      setMessage('GitHub update completed.')
    } catch (error: unknown) {
      setMessage(resolveError(error, 'GitHub update failed.'))
    } finally {
      setIsWriting(false)
    }
  }

  function goBack() {
    setAppView('list')
    setActiveRepo(null)
    setGenerated(null)
    setWriteSelection(null)
    setRefinementInput('')
    setRetryNotes('')
    setRetryTone('fun')
    setCodeContext('')
    setEditedDescription('')
    setEditedTopics('')
    setMessage('')
  }

  function handleDownloadReadme() {
    if (!generated) return
    const blob = new Blob([generated.readmeMd], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeRepo?.repo.name ?? 'README'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleRefine() {
    if (!activeRepo || !generated || !refinementInput.trim()) return

    setIsRefining(true)
    setMessage('')

    try {
      const response = await generateSuggestions({
        repos: [toGenerationInput(activeRepo.repo, activeRepo.readme || codeContext)],
        context: {
          projectGoal: 'Refine the existing generated README based on user instructions.',
          audience: 'students, recruiters, collaborators, and indie builders',
          deployTarget: homepageDraft || activeRepo.repo.homepage || 'Vercel if this is a web app',
          tone: toToneString(retryTone),
          extraNotes: retryNotes ? `Additional context: ${retryNotes}` : 'None',
        },
        refinementInput: refinementInput.trim(),
        currentReadmeMd: generated.readmeMd,
      })

      const preview = response.previews[0] ?? null
      if (preview) {
        setGenerated(preview)
        setRefinementInput('')
        setWriteSelection({ readme: true, description: true, topics: true, homepage: true })
        setEditedDescription(preview.description)
        setEditedTopics(preview.topics.join(', '))
      }
    } catch (error: unknown) {
      setMessage(resolveError(error, 'Refinement failed.'))
    } finally {
      setIsRefining(false)
    }
  }

  function disconnect() {
    window.localStorage.removeItem(STORAGE_KEY)
    setGithubToken('')
    setViewerName('')
    setRepos([])
    setActiveRepo(null)
    setGenerated(null)
    setAppView('list')
    setCodeContext('')
  }
}

function EmptyState({ theme }: { theme: Theme }) {
  return (
    <div className="grid min-h-[520px] place-items-center text-center">
      <div className="max-w-md">
        <div
          className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl font-semibold ${
            theme === 'dark' ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-950 text-white'
          }`}
        >
          GT
        </div>
        <h2 className="mt-5 text-2xl font-semibold">Pick a repo to tidy.</h2>
        <p className={`mt-2 text-sm leading-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          GitTidy fetches the repo metadata and README on click, then previews
          AI changes before any write-back button can run.
        </p>
      </div>
    </div>
  )
}

function Checklist({ checklist, theme }: { checklist: ScoreChecklist; theme: Theme }) {
  const items = [
    ['README exists', checklist.hasReadme],
    ['README has enough detail', checklist.hasDetailedReadme],
    ['Description exists', checklist.hasDescription],
    ['Deploy link exists', checklist.hasHomepage],
    ['Topics exist', checklist.hasTopics],
  ] as const

  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <h3 className="text-sm font-semibold">Score checklist</h3>
      <div className="mt-3 space-y-2">
        {items.map(([label, checked]) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span
              className={`grid h-5 w-5 place-items-center rounded-full text-xs ${
                checked
                  ? theme === 'dark'
                    ? 'bg-emerald-400/20 text-emerald-400'
                    : 'bg-emerald-500 text-white'
                  : theme === 'dark'
                    ? 'bg-white/10 text-slate-500'
                    : 'bg-slate-200 text-slate-400'
              }`}
            >
              {checked ? '✓' : '•'}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const README_PLACEHOLDERS = new Set([
  'Generate a beautified README to preview it here.',
  'Fetching README and analyzing code...',
  'No README or code analysis available.',
])

function ReadmePanel({
  title,
  value,
  theme,
}: {
  title: string
  value: string
  theme: Theme
}) {
  const isPlaceholder = README_PLACEHOLDERS.has(value)

  return (
    <div
      className={`rounded-2xl border ${
        theme === 'dark' ? 'border-white/10' : 'border-slate-200'
      }`}
    >
      <div
        className={`border-b px-4 py-3 ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}
      >
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div
        className={`min-h-[200px] max-h-[45vh] overflow-y-auto p-4 text-sm leading-6 ${
          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {isPlaceholder ? (
          <p className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>{value}</p>
        ) : (
          <div
            className={`
              [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold
              [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold
              [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold
              [&_p]:mb-2
              [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5
              [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5
              [&_li]:my-0.5
              [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
              [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:mb-2
              [&_pre_code]:rounded-none [&_pre_code]:p-0
              [&_a]:underline [&_a]:opacity-80 [&_a:hover]:opacity-100
              [&_img]:inline [&_img]:h-5 [&_img]:max-w-[160px] [&_img]:object-contain [&_img]:align-middle
              [&_blockquote]:mb-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:opacity-70
              [&_hr]:my-3 [&_hr]:border-t
              [&_table]:mb-2 [&_table]:w-full [&_table]:text-xs
              [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold
              [&_td]:py-0.5
              ${
                theme === 'dark'
                  ? '[&_h1]:text-slate-100 [&_h2]:text-slate-200 [&_h3]:text-slate-300 [&_code]:bg-white/10 [&_pre]:bg-black/30 [&_blockquote]:border-white/20 [&_hr]:border-white/10'
                  : '[&_h1]:text-slate-900 [&_h2]:text-slate-800 [&_h3]:text-slate-700 [&_code]:bg-slate-100 [&_pre]:bg-slate-50 [&_blockquote]:border-slate-300 [&_hr]:border-slate-200'
              }
            `}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

function DebugPanel({
  rawContent,
  theme,
  onClose,
}: {
  rawContent: string
  theme: Theme
  onClose: () => void
}) {
  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        theme === 'dark'
          ? 'border-red-400/30 bg-red-400/10 text-red-100'
          : 'border-red-200 bg-red-50 text-red-900'
      }`}
    >
      <div className="mb-2 flex items-center justify-between font-semibold">
        <span>Raw AI response (debug)</span>
        <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100">
          Dismiss
        </button>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 opacity-80">
        {rawContent}
      </pre>
    </div>
  )
}

function ConfirmationModal({
  action,
  isWriting,
  theme,
  onCancel,
  onConfirm,
}: {
  action: PendingAction
  isWriting: boolean
  theme: Theme
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${
          theme === 'dark'
            ? 'border-white/10 bg-[#101827] text-slate-100'
            : 'border-slate-200 bg-white text-slate-950'
        }`}
      >
        <h2 className="text-xl font-semibold">{action.title}</h2>
        <p className={`mt-2 text-sm leading-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          {action.body}
        </p>
        <p className={`mt-3 text-sm font-medium ${theme === 'dark' ? 'text-amber-200' : 'text-amber-800'}`}>
          GitTidy will never write automatically. Confirm to run this one action.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={isWriting} className={buttonClass(theme, 'secondary')}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isWriting} className={buttonClass(theme, 'primary')}>
            {isWriting ? 'Writing...' : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function startGitHubOAuth() {
  window.location.href = '/api/github/oauth/start'
}

function splitFullName(fullName: string) {
  const [owner, name] = fullName.split('/')
  return { owner, name }
}

function calculateScore(repo?: RepoRecord, readme = '') {
  const checklist: ScoreChecklist = {
    hasReadme: Boolean(readme.trim()),
    hasDetailedReadme: readme.trim().length > 300,
    hasDescription: Boolean(repo?.description.trim()),
    hasHomepage: Boolean(repo?.homepage.trim()),
    hasTopics: (repo?.topics.length ?? 0) >= 3,
  }
  const total =
    (checklist.hasReadme ? 25 : 0) +
    (checklist.hasDetailedReadme ? 20 : 0) +
    (checklist.hasDescription ? 20 : 0) +
    (checklist.hasHomepage ? 20 : 0) +
    (checklist.hasTopics ? 15 : 0)

  return { total, checklist }
}

function toGenerationInput(repo: RepoRecord, readme: string): RepoGenerationInput {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    language: repo.language,
    description: repo.description,
    homepage: repo.homepage,
    topics: repo.topics,
    readmeWordCount: countWords(readme),
    readmeExcerpt: truncateForPrompt(readme),
    existingReadme: truncateForPrompt(readme),
    issues: repo.issues.map((issue) => `${issue.label}: ${issue.detail}`),
  }
}

function buttonClass(theme: Theme, variant: 'primary' | 'secondary' | 'ghost', extra = '') {
  const base =
    'inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2'
  const styles = {
    primary:
      theme === 'dark'
        ? 'bg-violet-500 text-white hover:bg-violet-400 focus-visible:ring-violet-400/50'
        : 'bg-slate-950 text-white hover:bg-slate-800 focus-visible:ring-slate-400/50',
    secondary:
      theme === 'dark'
        ? 'border border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1] focus-visible:ring-white/20'
        : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-300',
    ghost:
      theme === 'dark'
        ? 'text-slate-300 hover:bg-white/[0.08] focus-visible:ring-white/20'
        : 'text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300',
  }

  return `${base} ${styles[variant]} ${extra}`
}

function inputClass(theme: Theme) {
  return `mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none transition duration-150 focus-visible:ring-2 ${
    theme === 'dark'
      ? 'border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-violet-400/60 focus-visible:ring-violet-400/20'
      : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus-visible:ring-slate-300'
  }`
}

function SelectionCheckbox({
  id,
  label,
  checked,
  theme,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  theme: Theme
  onChange: () => void
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition ${
        theme === 'dark' ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 cursor-pointer accent-violet-400"
      />
      <span className="text-sm">{label}</span>
    </label>
  )
}

function toToneString(tone: string) {
  switch (tone) {
    case 'professional': return 'professional, polished, concise'
    case 'minimal': return 'minimal, clean, simple language'
    case 'technical': return 'technical, precise, developer-focused'
    default: return 'fun, clear, student-builder friendly'
  }
}

function resolveError(error: unknown, fallback: string) {
  return error instanceof GitHubClientError || error instanceof Error
    ? error.message
    : fallback
}

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0
}

function truncateForPrompt(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 7000 ? `${trimmed.slice(0, 7000)}...` : trimmed
}

export default App
