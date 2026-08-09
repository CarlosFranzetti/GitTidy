import { useCallback, useEffect, useRef, useState } from 'react'
import { ActionBar } from './components/action-bar'
import { Checklist } from './components/checklist'
import { ConfirmDialog, type PendingAction } from './components/confirm-dialog'
import { ReadmeCompare, type ComparePane } from './components/readme-compare'
import { RepoPicker } from './components/repo-picker'
import { SettingsMenu } from './components/settings-menu'
import { Stepper } from './components/stepper'
import { Toast, type ToastTone } from './components/toast'
import { STEPS, type Step } from './lib/steps'
import { Button, Card, Muted, ScorePill, Spinner, TextArea, TextField } from './components/ui'
import { AiClientError, generateSuggestions } from './features/ai/client'
import type { AiSuggestions, GenerationMode } from './features/ai/types'
import {
  fetchRepositories,
  fetchRepositoryContextText,
  fetchRepositoryDetails,
  fetchRepositoryReadme,
  fetchViewer,
  GitHubClientError,
  updateRepositoryMetadata,
  updateRepositoryReadme,
} from './features/github/client'
import { normalizeGitHubRepo } from './features/github/normalize'
import {
  splitFullName,
  toGenerationInput,
  TONE_IDS,
  toToneString,
  type ToneId,
} from './features/repos/prompt'
import { countWords, scoreRepository } from './features/repos/scoring'
import { copyText } from './lib/clipboard'
import { applyFont, resolveFont, type FontChoice } from './lib/fonts'
import { readStored, removeStored, writeStored } from './lib/storage'
import { applyTheme, resolveTheme, type Theme } from './lib/theme'
import type { RepoRecord } from './types/repo'

const TOKEN_KEY = 'gittidy.github-token'
const THEME_KEY = 'gittidy.theme'
const FONT_KEY = 'gittidy.font'

type ActiveRepo = {
  repo: RepoRecord
  readme: string
  readmePath?: string
  readmeSha?: string
  /** Digest of config and docs files, used when there is no README. */
  codeContext: string
  isLoading: boolean
}

type WriteSelection = {
  readme: boolean
  description: boolean
  topics: boolean
  homepage: boolean
}

const NOTHING_SELECTED: WriteSelection = {
  readme: false,
  description: false,
  topics: false,
  homepage: false,
}

/**
 * Reads the OAuth handoff from the URL fragment.
 *
 * The callback returns the token in the fragment rather than the query string,
 * so it never reaches a server log, a Referer header or an analytics pageview.
 */
function readAuthFragment() {
  if (typeof window === 'undefined') return { token: '', error: '' }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const params = new URLSearchParams(hash)

  return {
    token: params.get('github_token') ?? '',
    error: params.get('error') ?? '',
  }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(readStored(THEME_KEY)))
  const [font, setFont] = useState<FontChoice>(() => resolveFont(readStored(FONT_KEY)))

  const [githubToken, setGithubToken] = useState(() => {
    const fromUrl = readAuthFragment().token
    return fromUrl || readStored(TOKEN_KEY) || ''
  })
  const [viewerName, setViewerName] = useState('')

  const [repos, setRepos] = useState<RepoRecord[]>([])
  const [activeRepo, setActiveRepo] = useState<ActiveRepo | null>(null)
  const [generated, setGenerated] = useState<AiSuggestions | null>(null)

  const [step, setStep] = useState<Step>('pick')
  const [pane, setPane] = useState<ComparePane>('current')

  const [writeSelection, setWriteSelection] = useState<WriteSelection>(NOTHING_SELECTED)
  const [draftDescription, setDraftDescription] = useState('')
  const [draftTopics, setDraftTopics] = useState('')
  const [draftHomepage, setDraftHomepage] = useState('')

  const [tone, setTone] = useState<ToneId>('fun')
  const [notes, setNotes] = useState('')
  const [refinement, setRefinement] = useState('')

  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [busy, setBusy] = useState<'' | 'generate' | 'metadata' | 'refine'>('')
  const [isWriting, setIsWriting] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(() => {
    const error = readAuthFragment().error
    return error ? { message: error, tone: 'error' } : null
  })
  const [debugRaw, setDebugRaw] = useState<string | null>(null)

  /** Guards against a slow request for a previously selected repo landing late. */
  const selectionRef = useRef(0)
  const inFlightRef = useRef<AbortController | null>(null)

  const notify = useCallback((message: string, tone: ToastTone = 'error') => {
    setToast({ message, tone })
  }, [])

  useEffect(() => {
    applyTheme(theme)
    writeStored(THEME_KEY, theme)

    if (theme !== 'system' || !window.matchMedia) return

    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => {
    applyFont(font)
    writeStored(FONT_KEY, font)
  }, [font])

  // Persist the token handed over in the fragment, then scrub the URL.
  useEffect(() => {
    const { token, error } = readAuthFragment()
    if (!token && !error) return

    if (token) writeStored(TOKEN_KEY, token)
    window.history.replaceState({}, '', window.location.pathname + window.location.search)
  }, [])

  useEffect(() => {
    if (!toast || toast.tone !== 'success') return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const loadRepos = useCallback(
    async (token: string) => {
      setIsLoadingRepos(true)

      try {
        const [viewer, repoResponses] = await Promise.all([
          fetchViewer(token),
          fetchRepositories(token),
        ])

        setViewerName(viewer.login || viewer.name || '')
        setRepos(repoResponses.map((repo) => normalizeGitHubRepo(repo)))
      } catch (error) {
        notify(errorMessage(error, 'Could not load your repositories.'))
      } finally {
        setIsLoadingRepos(false)
      }
    },
    [notify],
  )

  useEffect(() => {
    if (!githubToken) return
    // Fetching on token change is exactly the "sync with an external system"
    // case effects exist for; the loading flag it sets is unavoidable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRepos(githubToken)
  }, [githubToken, loadRepos])

  const selectRepo = useCallback(
    async (repo: RepoRecord) => {
      if (!githubToken) return

      inFlightRef.current?.abort()
      const controller = new AbortController()
      inFlightRef.current = controller

      const selectionId = ++selectionRef.current
      const isCurrent = () => selectionRef.current === selectionId

      setGenerated(null)
      setWriteSelection(NOTHING_SELECTED)
      setRefinement('')
      setNotes('')
      setPane('current')
      setDebugRaw(null)
      setDraftDescription(repo.description)
      setDraftTopics(repo.topics.join(', '))
      setDraftHomepage(repo.homepage)
      setActiveRepo({ repo, readme: '', codeContext: '', isLoading: true })
      setStep('review')

      const { owner, name } = splitFullName(repo.fullName)

      try {
        const [details, readme] = await Promise.all([
          fetchRepositoryDetails(owner, name, githubToken, controller.signal),
          fetchRepositoryReadme(owner, name, githubToken, controller.signal),
        ])

        if (!isCurrent()) return

        const readmeText = readme?.decodedContent ?? ''
        const normalized = normalizeGitHubRepo(details, countWords(readmeText))

        setDraftDescription(normalized.description)
        setDraftTopics(normalized.topics.join(', '))
        setDraftHomepage(normalized.homepage)
        setActiveRepo({
          repo: normalized,
          readme: readmeText,
          readmePath: readme?.path,
          readmeSha: readme?.sha,
          codeContext: '',
          isLoading: false,
        })
        setRepos((current) =>
          current.map((item) => (item.id === normalized.id ? normalized : item)),
        )

        // With no README, fall back to a digest of the repo's config and docs
        // so the model has something real to work from.
        if (!readmeText) {
          fetchRepositoryContextText(
            owner,
            name,
            details.default_branch,
            githubToken,
            controller.signal,
          )
            .then((context) => {
              if (isCurrent()) {
                setActiveRepo((current) =>
                  current ? { ...current, codeContext: context } : current,
                )
              }
            })
            .catch(() => undefined)
        }
      } catch (error) {
        if (controller.signal.aborted || !isCurrent()) return
        notify(errorMessage(error, 'Could not load that repository.'))
        setActiveRepo((current) => (current ? { ...current, isLoading: false } : current))
      }
    },
    [githubToken, notify],
  )

  const runGeneration = useCallback(
    async (mode: GenerationMode, refinementInput?: string) => {
      if (!activeRepo || activeRepo.isLoading) return

      const job = mode === 'metadata' ? 'metadata' : refinementInput ? 'refine' : 'generate'
      setBusy(job)
      setDebugRaw(null)

      const sourceText = activeRepo.readme || activeRepo.codeContext

      try {
        const response = await generateSuggestions(
          {
            repos: [toGenerationInput(activeRepo.repo, sourceText)],
            mode,
            context: {
              projectGoal:
                mode === 'metadata'
                  ? 'Write an accurate GitHub description and topics for this repository.'
                  : 'Make this repository clear, clickable, and portfolio-ready.',
              audience: 'students, recruiters, collaborators, and indie builders',
              deployTarget:
                draftHomepage || activeRepo.repo.homepage || 'Vercel if this is a web app',
              tone: toToneString(tone),
              extraNotes: notes.trim()
                ? `User notes: ${notes.trim()}`
                : 'Do not invent features. Use only the repository metadata and existing README.',
            },
            ...(refinementInput && generated
              ? { refinementInput, currentReadmeMd: generated.readmeMd }
              : {}),
          },
          { token: githubToken },
        )

        const preview = response.previews[0]
        if (!preview) {
          notify('The AI returned no suggestions. Try again.')
          return
        }

        setGenerated((current) =>
          mode === 'metadata' && current
            ? { ...current, ...preview, readmeMd: current.readmeMd }
            : preview,
        )

        if (preview.description) setDraftDescription(preview.description)
        if (preview.topics.length > 0) setDraftTopics(preview.topics.join(', '))
        if (!draftHomepage && preview.deploySuggestion) {
          // Only prefill a homepage when the suggestion is an actual URL.
          const url = preview.deploySuggestion.match(/https?:\/\/\S+/)?.[0]
          if (url) setDraftHomepage(url)
        }

        setWriteSelection({
          readme: mode === 'full',
          description: Boolean(preview.description),
          topics: preview.topics.length > 0,
          homepage: false,
        })

        if (mode === 'full') setPane('generated')
        setRefinement('')
        notify(
          mode === 'metadata'
            ? 'Description and topics drafted.'
            : refinementInput
              ? 'README refined.'
              : 'README generated.',
          'success',
        )
      } catch (error) {
        if (error instanceof AiClientError && error.rawContent) {
          setDebugRaw(error.rawContent)
          notify('The AI response could not be parsed. Try generating again.')
        } else {
          notify(errorMessage(error, 'AI generation failed.'))
        }
      } finally {
        setBusy('')
      }
    },
    [activeRepo, draftHomepage, generated, githubToken, notes, notify, tone],
  )

  function toggleSelection(field: keyof WriteSelection) {
    setWriteSelection((current) => ({ ...current, [field]: !current[field] }))
  }

  const parsedTopics = draftTopics
    .split(',')
    .map((topic) => topic.trim().toLowerCase())
    .filter(Boolean)

  const selectedCount = Object.values(writeSelection).filter(Boolean).length

  function requestApply() {
    if (!activeRepo || selectedCount === 0) return

    const { owner, name } = splitFullName(activeRepo.repo.fullName)
    const items: string[] = []

    if (writeSelection.readme) items.push('Replace README.md with the generated version')
    if (writeSelection.description) items.push(`Description → "${draftDescription}"`)
    if (writeSelection.topics) items.push(`Topics → ${parsedTopics.join(', ') || 'none'}`)
    if (writeSelection.homepage) items.push(`Homepage → ${draftHomepage || 'cleared'}`)

    setPendingAction({
      title: `Write to ${activeRepo.repo.fullName}?`,
      items,
      confirmLabel: `Apply ${selectedCount} change${selectedCount === 1 ? '' : 's'}`,
      run: async () => {
        if (writeSelection.readme && generated) {
          await updateRepositoryReadme({
            owner,
            repo: name,
            token: githubToken,
            content: generated.readmeMd,
            path: activeRepo.readmePath,
            sha: activeRepo.readmeSha,
          })
        }

        // Only selected fields are sent. Omitted keys mean "leave unchanged" —
        // passing a cached value would silently revert edits made elsewhere.
        if (writeSelection.description || writeSelection.topics || writeSelection.homepage) {
          await updateRepositoryMetadata({
            owner,
            repo: name,
            token: githubToken,
            ...(writeSelection.description ? { description: draftDescription } : {}),
            ...(writeSelection.topics ? { topics: parsedTopics } : {}),
            ...(writeSelection.homepage ? { homepage: draftHomepage.trim() } : {}),
          })
        }

        await selectRepo(activeRepo.repo)
      },
    })
  }

  async function runPendingAction() {
    if (!pendingAction) return

    setIsWriting(true)
    try {
      await pendingAction.run()
      setPendingAction(null)
      notify('Changes written to GitHub.', 'success')
      setStep('review')
    } catch (error) {
      notify(errorMessage(error, 'The GitHub write failed.'))
    } finally {
      setIsWriting(false)
    }
  }

  async function handleCopy() {
    if (!generated?.readmeMd) return
    try {
      await copyText(generated.readmeMd)
      notify('README copied to clipboard.', 'success')
    } catch {
      notify('Could not access the clipboard. Use Download instead.')
    }
  }

  function handleDownload() {
    if (!generated?.readmeMd) return

    const blob = new Blob([generated.readmeMd], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeRepo?.repo.name ?? 'README'}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    // Revoking immediately can cancel the download in Safari.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  function disconnect() {
    inFlightRef.current?.abort()
    removeStored(TOKEN_KEY)
    setGithubToken('')
    setViewerName('')
    setRepos([])
    setActiveRepo(null)
    setGenerated(null)
    setStep('pick')
  }

  // Live score reflecting unsaved drafts, so the health panel responds as you type.
  const liveScore = activeRepo
    ? scoreRepository({
        description: writeSelection.description ? draftDescription : activeRepo.repo.description,
        homepage: writeSelection.homepage ? draftHomepage : activeRepo.repo.homepage,
        topics: writeSelection.topics ? parsedTopics : activeRepo.repo.topics,
        readmeWordCount:
          writeSelection.readme && generated
            ? countWords(generated.readmeMd)
            : activeRepo.repo.readmeWordCount,
      })
    : null

  const reachable: Step[] = activeRepo ? (generated ? STEPS.map((s) => s.id) : ['pick', 'review']) : ['pick']

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 sm:px-6">
      <Header
        viewerName={viewerName}
        hasToken={Boolean(githubToken)}
        theme={theme}
        font={font}
        onThemeChange={setTheme}
        onFontChange={setFont}
        onDisconnect={disconnect}
      />

      {toast ? (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      ) : null}

      {!githubToken ? (
        <SignedOut />
      ) : (
        <main className="flex flex-1 flex-col pb-2">
          {/* Wraps rather than overflowing once the stepper and repo name no
              longer fit side by side on a very narrow screen. */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <Stepper
              current={step}
              reachable={reachable}
              onNavigate={(next) => {
                if (next === 'pick') setActiveRepo(null)
                setStep(next)
              }}
            />
            {activeRepo ? (
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <span className="truncate text-sm font-medium">{activeRepo.repo.name}</span>
                <ScorePill score={liveScore?.score ?? activeRepo.repo.score} />
              </span>
            ) : null}
          </div>

          {step === 'pick' || !activeRepo ? (
            <Card className="animate-rise flex-1 p-4 sm:p-5">
              <RepoPicker
                repos={repos}
                activeRepoId={activeRepo?.repo.id ?? null}
                isLoading={isLoadingRepos}
                onSelect={(repo) => void selectRepo(repo)}
                onRefresh={() => void loadRepos(githubToken)}
              />
            </Card>
          ) : step === 'review' ? (
            <ReviewStep
              activeRepo={activeRepo}
              generated={generated}
              busy={busy}
              pane={pane}
              tone={tone}
              notes={notes}
              refinement={refinement}
              checklist={liveScore?.checklist ?? activeRepo.repo.checklist}
              score={liveScore?.score ?? activeRepo.repo.score}
              debugRaw={debugRaw}
              onPaneChange={setPane}
              onToneChange={setTone}
              onNotesChange={setNotes}
              onRefinementChange={setRefinement}
              onGenerate={() => void runGeneration('full')}
              onGenerateMetadata={() => void runGeneration('metadata')}
              onRefine={() => void runGeneration('full', refinement.trim())}
              onDismissDebug={() => setDebugRaw(null)}
              onContinue={() => setStep('apply')}
              onCopy={() => void handleCopy()}
              onDownload={handleDownload}
            />
          ) : (
            <ApplyStep
              repo={activeRepo.repo}
              generated={generated}
              selection={writeSelection}
              description={draftDescription}
              topics={draftTopics}
              homepage={draftHomepage}
              parsedTopics={parsedTopics}
              selectedCount={selectedCount}
              onToggle={toggleSelection}
              onDescriptionChange={setDraftDescription}
              onTopicsChange={setDraftTopics}
              onHomepageChange={setDraftHomepage}
              onBack={() => setStep('review')}
              onApply={requestApply}
            />
          )}
        </main>
      )}

      {pendingAction ? (
        <ConfirmDialog
          action={pendingAction}
          isWriting={isWriting}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void runPendingAction()}
        />
      ) : null}
    </div>
  )
}

function Header({
  viewerName,
  hasToken,
  theme,
  font,
  onThemeChange,
  onFontChange,
  onDisconnect,
}: {
  viewerName: string
  hasToken: boolean
  theme: Theme
  font: FontChoice
  onThemeChange: (theme: Theme) => void
  onFontChange: (font: FontChoice) => void
  onDisconnect: () => void
}) {
  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-violet-700 text-sm font-bold text-white"
        >
          GT
        </span>
        <span className="truncate text-base font-semibold tracking-tight">GitTidy</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SettingsMenu
          theme={theme}
          font={font}
          onThemeChange={onThemeChange}
          onFontChange={onFontChange}
        />
        {hasToken ? (
          <Button onClick={onDisconnect} title="Sign out of GitHub">
            <span className="max-w-28 truncate">@{viewerName || 'GitHub'}</span>
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              window.location.href = '/api/github/oauth/start'
            }}
          >
            Sign in
          </Button>
        )}
      </div>
    </header>
  )
}

function SignedOut() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-2 py-12 text-center">
      <div
        aria-hidden="true"
        className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-violet-400 to-violet-700 text-3xl font-bold text-white shadow-xl shadow-violet-600/25"
      >
        GT
      </div>
      <h1 className="mt-7 max-w-sm text-3xl font-bold tracking-tight sm:text-4xl">
        Polish the repo before anyone clicks it.
      </h1>
      <p className="mt-3 max-w-sm text-base leading-relaxed">
        <Muted>
          GitTidy scores your repositories, drafts a better README, description and
          topics, then writes back only the parts you tick.
        </Muted>
      </p>
      <Button
        variant="primary"
        className="mt-7 px-6"
        onClick={() => {
          window.location.href = '/api/github/oauth/start'
        }}
      >
        Sign in with GitHub
      </Button>
      <p className="mt-4 max-w-xs text-xs">
        <Muted>Nothing is written to GitHub without an explicit confirmation.</Muted>
      </p>
    </main>
  )
}

function ReviewStep({
  activeRepo,
  generated,
  busy,
  pane,
  tone,
  notes,
  refinement,
  checklist,
  score,
  debugRaw,
  onPaneChange,
  onToneChange,
  onNotesChange,
  onRefinementChange,
  onGenerate,
  onGenerateMetadata,
  onRefine,
  onDismissDebug,
  onContinue,
  onCopy,
  onDownload,
}: {
  activeRepo: ActiveRepo
  generated: AiSuggestions | null
  busy: '' | 'generate' | 'metadata' | 'refine'
  pane: ComparePane
  tone: ToneId
  notes: string
  refinement: string
  checklist: RepoRecord['checklist']
  score: number
  debugRaw: string | null
  onPaneChange: (pane: ComparePane) => void
  onToneChange: (tone: ToneId) => void
  onNotesChange: (value: string) => void
  onRefinementChange: (value: string) => void
  onGenerate: () => void
  onGenerateMetadata: () => void
  onRefine: () => void
  onDismissDebug: () => void
  onContinue: () => void
  onCopy: () => void
  onDownload: () => void
}) {
  const isBusy = busy !== ''

  return (
    <div className="animate-rise flex flex-1 flex-col">
      <Card className="flex-1 p-4 sm:p-5">
        {/* On phones the README leads and the controls follow, so the thing
            the user came to read is on the first screen. The sidebar returns to
            the left at xl, where there is room for both. */}
        <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
          <div className="order-2 space-y-3 xl:order-1">
            <Checklist checklist={checklist} score={score} />

            <details className="rounded-2xl border border-slate-200 dark:border-white/10">
              <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-sm font-medium">
                Generation options
              </summary>
              <div className="space-y-3 px-4 pb-4">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
                    <Muted>Tone</Muted>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TONE_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onToneChange(id)}
                        aria-pressed={tone === id}
                        className={`min-h-11 rounded-lg px-3 text-xs font-medium capitalize transition ${
                          tone === id
                            ? 'bg-violet-600 text-white dark:bg-violet-500'
                            : 'border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
                        }`}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                </div>
                <TextArea
                  value={notes}
                  onChange={(event) => onNotesChange(event.target.value)}
                  placeholder="Extra context or constraints for the AI…"
                  rows={3}
                  aria-label="Extra context for the AI"
                />
              </div>
            </details>

            {/* Metadata-only path: fixes description and topics without spending
                a README generation, which is the flakiest and slowest call. */}
            <Button
              onClick={onGenerateMetadata}
              disabled={isBusy || activeRepo.isLoading}
              className="w-full"
            >
              {busy === 'metadata' ? (
                <>
                  <Spinner className="h-4 w-4" /> Drafting…
                </>
              ) : (
                'Suggest description + topics only'
              )}
            </Button>
          </div>

          <div className="order-1 min-w-0 xl:order-2">
            <ReadmeCompare
              current={activeRepo.readme || activeRepo.codeContext}
              generated={generated?.readmeMd ?? ''}
              isLoading={activeRepo.isLoading}
              pane={pane}
              onPaneChange={onPaneChange}
            />

            {generated?.model ? (
              <p className="mt-2 text-xs">
                <Muted>Drafted by {generated.model}</Muted>
              </p>
            ) : null}

            {generated ? (
              <div className="mt-3 space-y-2">
                <TextArea
                  value={refinement}
                  onChange={(event) => onRefinementChange(event.target.value)}
                  placeholder="Ask for a change: add a contributing section, make it shorter…"
                  rows={2}
                  aria-label="Refinement instructions"
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onRefine} disabled={isBusy || !refinement.trim()}>
                    {busy === 'refine' ? (
                      <>
                        <Spinner className="h-4 w-4" /> Refining…
                      </>
                    ) : (
                      'Refine'
                    )}
                  </Button>
                  <Button onClick={onCopy}>Copy</Button>
                  <Button onClick={onDownload}>Download</Button>
                </div>
              </div>
            ) : null}

            {debugRaw ? (
              <div className="mt-3 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm dark:border-rose-400/30 dark:bg-rose-500/10">
                <div className="mb-1.5 flex items-center justify-between font-semibold">
                  <span>Raw AI response</span>
                  <button type="button" onClick={onDismissDebug} className="text-xs underline">
                    Dismiss
                  </button>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs opacity-80">
                  {debugRaw}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <ActionBar
        hint={
          generated
            ? 'Choose what to write on the next step.'
            : 'Or skip the README and just fix the description and topics.'
        }
      >
        {generated ? (
          <>
            <Button onClick={onGenerate} disabled={isBusy} className="flex-1">
              {busy === 'generate' ? <Spinner className="h-4 w-4" /> : 'Regenerate'}
            </Button>
            <Button variant="primary" onClick={onContinue} className="flex-1">
              Choose changes →
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={onGenerate} disabled={isBusy || activeRepo.isLoading} className="flex-1">
              {busy === 'generate' ? (
                <>
                  <Spinner className="h-4 w-4" /> Generating…
                </>
              ) : (
                'Generate README'
              )}
            </Button>
            <Button onClick={onContinue} className="shrink-0">
              Skip →
            </Button>
          </>
        )}
      </ActionBar>
    </div>
  )
}

function ApplyStep({
  repo,
  generated,
  selection,
  description,
  topics,
  homepage,
  parsedTopics,
  selectedCount,
  onToggle,
  onDescriptionChange,
  onTopicsChange,
  onHomepageChange,
  onBack,
  onApply,
}: {
  repo: RepoRecord
  generated: AiSuggestions | null
  selection: WriteSelection
  description: string
  topics: string
  homepage: string
  parsedTopics: string[]
  selectedCount: number
  onToggle: (field: keyof WriteSelection) => void
  onDescriptionChange: (value: string) => void
  onTopicsChange: (value: string) => void
  onHomepageChange: (value: string) => void
  onBack: () => void
  onApply: () => void
}) {
  const invalidTopics = parsedTopics.filter((topic) => !/^[a-z0-9][a-z0-9-]*$/.test(topic))

  return (
    <div className="animate-rise flex flex-1 flex-col">
      <Card className="flex-1 p-4 sm:p-5">
        <h2 className="text-base font-semibold">What should GitTidy write?</h2>
        <p className="mt-1 text-sm">
          <Muted>Everything is off by default unless it has a draft ready.</Muted>
        </p>

        <div className="mt-4 space-y-3">
          <WriteRow
            checked={selection.readme}
            onToggle={() => onToggle('readme')}
            disabled={!generated?.readmeMd}
            label="README.md"
            summary={
              generated?.readmeMd
                ? `Replaces the current README with the ${countWords(generated.readmeMd)}-word draft.`
                : 'Generate a README on the previous step to enable this.'
            }
          />

          <WriteRow
            checked={selection.description}
            onToggle={() => onToggle('description')}
            label="Description"
            summary={`Currently: ${repo.description || 'not set'}`}
          >
            <TextField
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="One sentence describing the project"
              maxLength={350}
              aria-label="Repository description"
            />
            <p className="mt-1 text-xs">
              <Muted>
                {description.length}/160 shown on GitHub
                {description.length > 160 ? ' — the rest is truncated in listings' : ''}
              </Muted>
            </p>
          </WriteRow>

          <WriteRow
            checked={selection.topics}
            onToggle={() => onToggle('topics')}
            label="Topics"
            summary={`Currently: ${repo.topics.join(', ') || 'none'}`}
          >
            <TextField
              value={topics}
              onChange={(event) => onTopicsChange(event.target.value)}
              placeholder="react, typescript, github-api"
              aria-label="Repository topics, comma separated"
            />
            {parsedTopics.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parsedTopics.map((topic) => (
                  <span
                    key={topic}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      /^[a-z0-9][a-z0-9-]*$/.test(topic)
                        ? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200'
                    }`}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            ) : null}
            {invalidTopics.length > 0 ? (
              <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-300">
                GitHub only accepts lowercase letters, numbers and hyphens. Fix:{' '}
                {invalidTopics.join(', ')}
              </p>
            ) : null}
          </WriteRow>

          <WriteRow
            checked={selection.homepage}
            onToggle={() => onToggle('homepage')}
            label="Homepage / deploy link"
            summary={`Currently: ${repo.homepage || 'not set'}`}
          >
            <TextField
              value={homepage}
              onChange={(event) => onHomepageChange(event.target.value)}
              placeholder="https://your-project.vercel.app"
              type="url"
              inputMode="url"
              aria-label="Homepage URL"
            />
          </WriteRow>
        </div>
      </Card>

      <ActionBar
        hint={
          selectedCount === 0
            ? 'Tick at least one item to continue.'
            : `${selectedCount} change${selectedCount === 1 ? '' : 's'} ready to review.`
        }
      >
        <Button onClick={onBack} className="shrink-0">
          ← Back
        </Button>
        <Button
          variant="primary"
          onClick={onApply}
          disabled={selectedCount === 0 || invalidTopics.length > 0}
          className="flex-1"
        >
          Review &amp; apply
        </Button>
      </ActionBar>
    </div>
  )
}

function WriteRow({
  checked,
  disabled,
  label,
  summary,
  onToggle,
  children,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  summary: string
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-2xl border p-3 transition ${
        checked
          ? 'border-violet-400 bg-violet-50/60 dark:border-violet-400/50 dark:bg-violet-400/[0.07]'
          : 'border-slate-200 dark:border-white/10'
      } ${disabled ? 'opacity-55' : ''}`}
    >
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="mt-0.5 h-5 w-5 shrink-0 accent-violet-600"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block truncate text-xs">
            <Muted>{summary}</Muted>
          </span>
        </span>
      </label>
      {checked && children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof GitHubClientError || error instanceof AiClientError) {
    return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
