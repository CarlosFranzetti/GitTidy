import { useMemo, useState } from 'react'
import type { RepoRecord } from '../types/repo'
import { Button, Muted, ScorePill, Spinner, TextField } from './ui'

type Props = {
  repos: RepoRecord[]
  activeRepoId: number | null
  isLoading: boolean
  onSelect: (repo: RepoRecord) => void
  onRefresh: () => void
}

export function RepoPicker({
  repos,
  activeRepoId,
  isLoading,
  onSelect,
  onRefresh,
}: Props) {
  const [filter, setFilter] = useState('')
  const [worstFirst, setWorstFirst] = useState(true)

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const filtered = needle
      ? repos.filter(
          (repo) =>
            repo.fullName.toLowerCase().includes(needle) ||
            repo.description.toLowerCase().includes(needle) ||
            repo.language.toLowerCase().includes(needle),
        )
      : repos

    return [...filtered].sort((a, b) =>
      worstFirst ? a.score - b.score : b.score - a.score,
    )
  }, [repos, filter, worstFirst])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Choose a repository</h2>
          <p className="text-sm">
            <Muted>
              {isLoading
                ? 'Loading your repositories…'
                : `${shown.length} of ${repos.length} shown`}
            </Muted>
          </p>
        </div>
        <Button onClick={onRefresh} disabled={isLoading} aria-label="Refresh repositories">
          {isLoading ? <Spinner className="h-4 w-4" /> : 'Refresh'}
        </Button>
      </div>

      <div className="flex gap-2">
        <TextField
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by name, language or description"
          aria-label="Filter repositories"
          type="search"
        />
        <Button
          onClick={() => setWorstFirst((value) => !value)}
          className="shrink-0"
          aria-label={
            worstFirst ? 'Sorted lowest score first' : 'Sorted highest score first'
          }
        >
          {worstFirst ? '↑ Score' : '↓ Score'}
        </Button>
      </div>

      {isLoading && repos.length === 0 ? (
        <SkeletonList />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm dark:border-white/15">
          <Muted>
            {repos.length === 0
              ? 'No repositories found on this account.'
              : 'No repositories match that filter.'}
          </Muted>
        </p>
      ) : (
        <ul className="-mx-1 max-h-[min(58dvh,560px)] space-y-2 overflow-y-auto px-1 pb-1">
          {shown.map((repo) => (
            <li key={repo.id}>
              <RepoRow
                repo={repo}
                active={repo.id === activeRepoId}
                onSelect={() => onSelect(repo)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RepoRow({
  repo,
  active,
  onSelect,
}: {
  repo: RepoRecord
  active: boolean
  onSelect: () => void
}) {
  return (
    <div
      className={`flex items-stretch gap-1 rounded-2xl border transition ${
        active
          ? 'border-violet-500 bg-violet-50 dark:border-violet-400/60 dark:bg-violet-400/10'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className="flex min-h-14 flex-1 flex-col justify-center gap-0.5 rounded-l-2xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
      >
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{repo.name}</span>
          <ScorePill score={repo.score} />
          {repo.private ? (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-300 dark:text-slate-400 dark:ring-white/15">
              Private
            </span>
          ) : null}
        </span>
        <span className="truncate text-xs">
          <Muted>
            {repo.language}
            {repo.description ? ` · ${repo.description}` : ' · No description yet'}
          </Muted>
        </span>
      </button>
      <a
        href={`https://github.com/${repo.fullName}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${repo.fullName} on GitHub`}
        aria-label={`Open ${repo.fullName} on GitHub`}
        className="flex w-12 shrink-0 items-center justify-center rounded-r-2xl text-slate-500 transition hover:bg-slate-950/5 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
      >
        ↗
      </a>
    </div>
  )
}

function SkeletonList() {
  return (
    <ul className="space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <li
          key={index}
          className="h-14 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/[0.06]"
        />
      ))}
    </ul>
  )
}
