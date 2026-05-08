import { useEffect, useMemo, useState } from 'react'
import { generateSuggestions } from './features/ai/client'
import type { AiSuggestions, RepoGenerationInput } from './features/ai/types'
import {
  fetchRepositories,
  fetchRepositoryDetails,
  fetchRepositoryReadme,
  fetchViewer,
  GitHubClientError,
  updateRepositoryMetadata,
  updateRepositoryReadme,
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

  const score = useMemo(
    () => calculateScore(activeRepo?.repo, activeRepo?.readme ?? ''),
    [activeRepo],
  )

  const selectedOwnerRepo = activeRepo ? splitFullName(activeRepo.repo.fullName) : null
  const appClass =
    theme === 'dark'
      ? 'min-h-screen bg-[#070b12] text-slate-100'
      : 'min-h-screen bg-slate-100 text-slate-950'
  const panelClass =
    theme === 'dark'
      ? 'border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30'
      : 'border-slate-200 bg-white shadow-xl shadow-slate-200/70'
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

  return (
    <main className={appClass}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={`text-sm font-medium ${mutedText}`}>GitTidy</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
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

        {message ? (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              theme === 'dark'
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {message}
          </div>
        ) : null}

        <div className="grid flex-1 gap-5 lg:grid-cols-[360px_1fr]">
          <aside className={`rounded-2xl border p-4 ${panelClass}`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Repositories</h2>
                <p className={`text-sm ${mutedText}`}>
                  {githubToken
                    ? isLoadingRepos
                      ? 'Loading GitHub repos...'
                      : `${repos.length} available`
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

            {!githubToken ? (
              <div className={`rounded-xl border border-dashed p-4 text-sm leading-6 ${mutedText}`}>
                GitHub OAuth is required to fetch repo details and write changes.
                The app does not write anything automatically.
              </div>
            ) : (
              <div className="space-y-2">
                {repos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => void selectRepo(repo)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      activeRepo?.repo.id === repo.id
                        ? theme === 'dark'
                          ? 'border-cyan-300/60 bg-cyan-300/10'
                          : 'border-slate-950 bg-slate-950 text-white'
                        : theme === 'dark'
                          ? 'border-white/10 bg-white/[0.04] hover:border-white/25'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                    }`}
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
                ))}
              </div>
            )}
          </aside>

          <section className={`rounded-2xl border p-4 md:p-5 ${panelClass}`}>
            {!activeRepo ? (
              <EmptyState theme={theme} />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <p className={`text-sm ${mutedText}`}>Selected repo</p>
                    <h2 className="mt-1 truncate text-2xl font-semibold">
                      {activeRepo.repo.fullName}
                    </h2>
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
                  <div className="shrink-0 rounded-2xl border border-white/10 px-5 py-4 text-center">
                    <p className={`text-xs font-medium uppercase tracking-[0.18em] ${mutedText}`}>
                      GitTidy score
                    </p>
                    <p className="mt-1 text-5xl font-semibold">{score.total}</p>
                    <p className={`text-sm ${mutedText}`}>/ 100</p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
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
                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={isGenerating || activeRepo.isLoading}
                      className={buttonClass(theme, 'primary', 'w-full')}
                    >
                      {isGenerating ? 'Generating...' : 'Generate Beautified README'}
                    </button>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <ReadmePanel
                      title="Existing README"
                      value={
                        activeRepo.isLoading
                          ? 'Fetching README from GitHub...'
                          : activeRepo.readme || 'No README detected.'
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
                  <div className="rounded-2xl border border-white/10 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <PreviewMeta title="Description" value={generated.description} mutedText={mutedText} />
                      <PreviewMeta title="Topics" value={generated.topics.join(', ')} mutedText={mutedText} />
                      <PreviewMeta
                        title="Deploy suggestion"
                        value={generated.deploySuggestion || 'Homepage already exists.'}
                        mutedText={mutedText}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyReadme()}
                        className={buttonClass(theme, 'secondary')}
                      >
                        Copy README
                      </button>
                      <button
                        type="button"
                        onClick={confirmReadmeUpdate}
                        className={buttonClass(theme, 'secondary')}
                      >
                        Update README on GitHub
                      </button>
                      <button
                        type="button"
                        onClick={confirmMetadataUpdate}
                        className={buttonClass(theme, 'secondary')}
                      >
                        Update repo description/topics/homepage
                      </button>
                    </div>
                    {copyMessage ? (
                      <p className="mt-3 text-sm text-emerald-400">{copyMessage}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </section>
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
    setHomepageDraft(repo.homepage)
    setActiveRepo({ repo, readme: '', isLoading: true })

    const { owner, name } = splitFullName(repo.fullName)

    try {
      const [details, readme] = await Promise.all([
        fetchRepositoryDetails(owner, name, githubToken),
        fetchRepositoryReadme(owner, name, githubToken),
      ])
      const decodedReadme = readme?.decodedContent ?? ''
      const normalized = normalizeGitHubRepo(details, countWords(decodedReadme))

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
    setGenerated(null)

    try {
      const response = await generateSuggestions({
        repos: [toGenerationInput(activeRepo.repo, activeRepo.readme)],
        context: {
          projectGoal: 'Make this repository clear, clickable, and portfolio-ready.',
          audience: 'students, recruiters, collaborators, and indie builders',
          deployTarget: homepageDraft || activeRepo.repo.homepage || 'Vercel if this is a web app',
          tone: 'fun, clear, student-builder friendly',
          extraNotes: 'Do not invent features. Use only the repository metadata and existing README.',
        },
      })

      setGenerated(response.previews[0] ?? null)
    } catch (error: unknown) {
      setMessage(resolveError(error, 'AI generation failed.'))
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

  function confirmReadmeUpdate() {
    if (!activeRepo || !generated || !selectedOwnerRepo) return

    setPendingAction({
      title: 'Update README on GitHub?',
      body: `This will write the generated README to ${activeRepo.repo.fullName}. It will not update description, topics, or homepage.`,
      confirmLabel: 'Update README',
      run: async () => {
        await updateRepositoryReadme({
          owner: selectedOwnerRepo.owner,
          repo: selectedOwnerRepo.name,
          token: githubToken,
          content: generated.readmeMd,
          sha: activeRepo.readmeSha,
        })
        await selectRepo(activeRepo.repo)
      },
    })
  }

  function confirmMetadataUpdate() {
    if (!activeRepo || !generated || !selectedOwnerRepo) return

    setPendingAction({
      title: 'Update repo metadata on GitHub?',
      body: `This will update the GitHub description, topics, and homepage field for ${activeRepo.repo.fullName}.`,
      confirmLabel: 'Update metadata',
      run: async () => {
        await updateRepositoryMetadata({
          owner: selectedOwnerRepo.owner,
          repo: selectedOwnerRepo.name,
          token: githubToken,
          description: generated.description,
          topics: generated.topics,
          homepage: homepageDraft.trim(),
        })
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

  function disconnect() {
    window.localStorage.removeItem(STORAGE_KEY)
    setGithubToken('')
    setViewerName('')
    setRepos([])
    setActiveRepo(null)
    setGenerated(null)
  }
}

function EmptyState({ theme }: { theme: Theme }) {
  return (
    <div className="grid min-h-[520px] place-items-center text-center">
      <div className="max-w-md">
        <div
          className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl ${
            theme === 'dark' ? 'bg-cyan-300/10 text-cyan-200' : 'bg-slate-950 text-white'
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
                  ? 'bg-emerald-400 text-emerald-950'
                  : theme === 'dark'
                    ? 'bg-white/10 text-slate-400'
                    : 'bg-slate-200 text-slate-500'
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

function ReadmePanel({
  title,
  value,
  theme,
}: {
  title: string
  value: string
  theme: Theme
}) {
  return (
    <div className="min-h-[440px] rounded-2xl border border-white/10">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <pre
        className={`max-h-[560px] overflow-auto whitespace-pre-wrap break-words p-4 text-sm leading-6 ${
          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {value}
      </pre>
    </div>
  )
}

function PreviewMeta({
  title,
  value,
  mutedText,
}: {
  title: string
  value: string
  mutedText: string
}) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${mutedText}`}>
        {title}
      </p>
      <p className="mt-1 text-sm leading-6">{value}</p>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
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
    'inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
  const styles = {
    primary:
      theme === 'dark'
        ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
        : 'bg-slate-950 text-white hover:bg-slate-800',
    secondary:
      theme === 'dark'
        ? 'border border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]'
        : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
    ghost:
      theme === 'dark'
        ? 'text-slate-300 hover:bg-white/[0.08]'
        : 'text-slate-700 hover:bg-slate-100',
  }

  return `${base} ${styles[variant]} ${extra}`
}

function inputClass(theme: Theme) {
  return `mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none transition ${
    theme === 'dark'
      ? 'border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/70'
      : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950'
  }`
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
