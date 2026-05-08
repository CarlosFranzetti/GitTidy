import { useState } from 'react'
import { generateSuggestions, inferContext } from './features/ai/client'
import type { AiSuggestions, RepoGenerationInput } from './features/ai/types'
import {
  fetchRepositories,
  fetchRepositoryContextText,
  fetchViewer,
  GitHubClientError,
} from './features/github/client'
import { normalizeGitHubRepo } from './features/github/normalize'
import { mockRepos } from './features/repos/mock-data'
import { copyText } from './lib/clipboard'
import type { RepoRecord } from './types/repo'

const STORAGE_KEY = 'gittidy.github-token'

type ContextForm = {
  projectGoal: string
  audience: string
  deployTarget: string
  tone: string
  extraNotes: string
}

const defaultContext: ContextForm = {
  projectGoal: '',
  audience: 'recruiters, collaborators, and portfolio visitors',
  deployTarget: '',
  tone: 'clear, concise, and professional',
  extraNotes: '',
}

function App() {
  const [githubToken, setGithubToken] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  })
  const [tokenDraft, setTokenDraft] = useState(githubToken)
  const [viewerName, setViewerName] = useState('')
  const [repos, setRepos] = useState<RepoRecord[]>(mockRepos)
  const [selectedRepoIds, setSelectedRepoIds] = useState<number[]>([
    mockRepos[0]?.id ?? 0,
  ])
  const [context, setContext] = useState<ContextForm>(defaultContext)
  const [activeMode, setActiveMode] = useState<'mock' | 'live'>('mock')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isInferring, setIsInferring] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [previews, setPreviews] = useState<AiSuggestions[]>([])
  const [copyMessage, setCopyMessage] = useState('')

  const selectedRepos = repos.filter((repo) => selectedRepoIds.includes(repo.id))
  const canGenerate = selectedRepos.length > 0 && !isGenerating && !isInferring

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">GitTidy</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Prepare repo updates before you commit.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Connect GitHub, choose repos, add context, generate improvements,
              and review the exact preview before any commit step.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600">
            {activeMode === 'live'
              ? `Connected${viewerName ? ` as @${viewerName}` : ''}`
              : 'Demo mode'}
          </div>
        </header>

        {message ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {message}
          </div>
        ) : null}

        <div className="space-y-4">
          <Section number="1" title="Connect GitHub">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <label>
                <span className="sr-only">GitHub token</span>
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={(event) => setTokenDraft(event.target.value)}
                  placeholder="GitHub token with repo read access"
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleConnect()}
                disabled={isConnecting || !tokenDraft.trim()}
                className="h-11 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
              <button
                type="button"
                onClick={useDemoRepos}
                className="h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800"
              >
                Demo
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              MVP auth uses a GitHub token. OAuth can replace this later without
              changing the repo selection and preview flow.
            </p>
          </Section>

          <Section number="2" title="Select repos">
            <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {repos.map((repo) => {
                const checked = selectedRepoIds.includes(repo.id)

                return (
                  <label
                    key={repo.id}
                    className="flex cursor-pointer items-start gap-3 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRepo(repo.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {repo.fullName}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {repo.language} · score {repo.score} ·{' '}
                        {repo.issues.length
                          ? repo.issues.map((issue) => issue.label).join(', ')
                          : 'ready for polish'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {selectedRepos.length} selected
            </p>
          </Section>

          <Section number="3" title="Add context">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-slate-600">
                Let AI prefill this from selected repo metadata and README
                markdown, then edit anything that feels off.
              </p>
              <button
                type="button"
                onClick={() => void handleInferContext()}
                disabled={selectedRepos.length === 0 || isInferring}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isInferring ? 'Inferring...' : 'Infer from repos'}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="What should these repos communicate?"
                value={context.projectGoal}
                placeholder="Example: portfolio-ready student projects"
                onChange={(value) => updateContext('projectGoal', value)}
              />
              <Field
                label="Who is the audience?"
                value={context.audience}
                onChange={(value) => updateContext('audience', value)}
              />
              <Field
                label="Preferred deploy target"
                value={context.deployTarget}
                placeholder="Example: Vercel, GitHub Pages, Render"
                onChange={(value) => updateContext('deployTarget', value)}
              />
              <Field
                label="Tone"
                value={context.tone}
                onChange={(value) => updateContext('tone', value)}
              />
            </div>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-slate-700">
                Extra notes
              </span>
              <textarea
                value={context.extraNotes}
                onChange={(event) => updateContext('extraNotes', event.target.value)}
                placeholder="Anything the AI should know before writing previews."
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </label>
          </Section>

          <Section number="4" title="Generate and preview">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-slate-600">
                GitTidy will generate preview text only. Nothing is committed
                until you explicitly add write support later.
              </p>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                className="h-11 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isGenerating ? 'Generating...' : 'Generate previews'}
              </button>
            </div>

            {previews.length > 0 ? (
              <div className="mt-4 space-y-3">
                {previews.map((preview) => (
                  <PreviewCard
                    key={preview.repoName}
                    preview={preview}
                    onCopy={(value) => void handleCopy(value)}
                  />
                ))}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <button
                    type="button"
                    disabled
                    className="h-10 rounded-md bg-slate-300 px-4 text-sm font-medium text-white"
                  >
                    Commit changes
                  </button>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Commit support is intentionally gated. Next step is adding a
                    write-scope GitHub flow and showing a final file diff before
                    this button is enabled.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                Generated previews will appear here.
              </div>
            )}

            {copyMessage ? (
              <p className="mt-3 text-sm text-emerald-700">{copyMessage}</p>
            ) : null}
          </Section>
        </div>
      </div>
    </main>
  )

  async function handleConnect() {
    const nextToken = tokenDraft.trim()

    if (!nextToken) {
      return
    }

    setIsConnecting(true)
    setMessage('')

    try {
      const [viewer, repoResponses] = await Promise.all([
        fetchViewer(nextToken),
        fetchRepositories(nextToken),
      ])
      const nextRepos = repoResponses.map((repo) => ({
        ...normalizeGitHubRepo(repo),
        readmeLoaded: false,
      }))

      setGithubToken(nextToken)
      window.localStorage.setItem(STORAGE_KEY, nextToken)
      setViewerName(viewer.login || viewer.name || '')
      setRepos(nextRepos)
      setSelectedRepoIds(nextRepos.slice(0, 3).map((repo) => repo.id))
      setActiveMode('live')
      setPreviews([])
    } catch (error: unknown) {
      setMessage(
        error instanceof GitHubClientError || error instanceof Error
          ? error.message
          : 'GitHub connection failed.',
      )
    } finally {
      setIsConnecting(false)
    }
  }

  function useDemoRepos() {
    setActiveMode('mock')
    setViewerName('')
    setRepos(mockRepos)
    setSelectedRepoIds([mockRepos[0]?.id ?? 0])
    setPreviews([])
    setMessage('')
  }

  function toggleRepo(repoId: number) {
    setSelectedRepoIds((current) =>
      current.includes(repoId)
        ? current.filter((id) => id !== repoId)
        : [...current, repoId],
    )
  }

  function updateContext(key: keyof ContextForm, value: string) {
    setContext((current) => ({ ...current, [key]: value }))
  }

  async function handleGenerate() {
    if (!canGenerate) {
      return
    }

    setIsGenerating(true)
    setMessage('')
    setPreviews([])

    try {
      const enrichedRepos = await hydrateRepoContext(selectedRepos)
      const response = await generateSuggestions({
        repos: enrichedRepos.map(toGenerationInput),
        context,
      })

      setPreviews(response.previews)
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : 'AI generation failed.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleInferContext() {
    if (selectedRepos.length === 0) {
      return
    }

    setIsInferring(true)
    setMessage('')

    try {
      const enrichedRepos = await hydrateRepoContext(selectedRepos)
      const response = await inferContext({
        repos: enrichedRepos.map(toGenerationInput),
      })

      setContext(response.context)
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : 'Context inference failed.',
      )
    } finally {
      setIsInferring(false)
    }
  }

  async function hydrateRepoContext(nextRepos: RepoRecord[]) {
    if (activeMode !== 'live' || !githubToken) {
      return nextRepos
    }

    const hydrated = await Promise.all(
      nextRepos.map(async (repo) => {
        if (repo.readmeLoaded && repo.readmeExcerpt) {
          return repo
        }

        const [owner, repoName] = repo.fullName.split('/')
        const repoContextText = await fetchRepositoryContextText(
          owner,
          repoName,
          repo.defaultBranch,
          githubToken,
        )
        const readmeWordCount = countWords(repoContextText)

        return {
          ...normalizeGitHubRepo(
            {
              id: repo.id,
              name: repo.name,
              full_name: repo.fullName,
              description: repo.description,
              private: repo.private,
              language: repo.language,
              updated_at: repo.updatedAt,
              homepage: repo.homepage,
              topics: repo.topics,
              default_branch: repo.defaultBranch,
            },
            readmeWordCount,
          ),
          readmeLoaded: true,
          readmeExcerpt: truncateForPrompt(repoContextText),
        }
      }),
    )

    setRepos((current) =>
      current.map((repo) => hydrated.find((item) => item.id === repo.id) ?? repo),
    )

    return hydrated
  }

  async function handleCopy(value: string) {
    try {
      await copyText(value)
      setCopyMessage('Copied.')
      window.setTimeout(() => setCopyMessage(''), 1500)
    } catch {
      setCopyMessage('Clipboard write failed.')
    }
  }
}

type SectionProps = {
  number: string
  title: string
  children: React.ReactNode
}

function Section({ number, title, children }: SectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-950 text-sm font-medium text-white">
          {number}
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

type FieldProps = {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}

function Field({ label, value, placeholder, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
      />
    </label>
  )
}

type PreviewCardProps = {
  preview: AiSuggestions
  onCopy: (value: string) => void
}

function PreviewCard({ preview, onCopy }: PreviewCardProps) {
  const readmePreview =
    preview.suggestedReadme.length > 900
      ? `${preview.suggestedReadme.slice(0, 900)}...`
      : preview.suggestedReadme

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">{preview.repoName}</h3>
          <p className="mt-1 text-sm text-slate-600">
            Commit summary: {preview.commitSummary}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onCopy(formatPreview(preview))}
          className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium"
        >
          Copy preview
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <PreviewBlock title="Description" body={preview.suggestedDescription} />
        <PreviewBlock title="Topics" body={preview.suggestedTopics.join(', ')} />
        <PreviewBlock
          title="Deploy suggestions"
          body={preview.deploySuggestions.join('\n')}
        />
        <PreviewBlock title="README preview" body={readmePreview} prewrap />
      </div>
    </article>
  )
}

type PreviewBlockProps = {
  title: string
  body: string
  prewrap?: boolean
}

function PreviewBlock({ title, body, prewrap = false }: PreviewBlockProps) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <p
        className={`mt-2 text-sm leading-6 text-slate-800 ${prewrap ? 'whitespace-pre-wrap' : ''}`}
      >
        {body}
      </p>
    </div>
  )
}

function toGenerationInput(repo: RepoRecord): RepoGenerationInput {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    language: repo.language,
    description: repo.description,
    homepage: repo.homepage,
    topics: repo.topics,
    readmeWordCount: repo.readmeWordCount,
    readmeExcerpt: repo.readmeExcerpt ?? '',
    issues: repo.issues.map((issue) => `${issue.label}: ${issue.detail}`),
  }
}

function formatPreview(preview: AiSuggestions) {
  return [
    `Repo: ${preview.repoName}`,
    `Commit summary: ${preview.commitSummary}`,
    '',
    `Description:\n${preview.suggestedDescription}`,
    '',
    `Topics:\n${preview.suggestedTopics.join(', ')}`,
    '',
    `Deploy suggestions:\n${preview.deploySuggestions.join('\n')}`,
    '',
    `README:\n${preview.suggestedReadme}`,
  ].join('\n')
}

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0
}

function truncateForPrompt(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 4000 ? `${trimmed.slice(0, 4000)}...` : trimmed
}

export default App
