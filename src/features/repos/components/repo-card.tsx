import { ScoreRing } from '../../../components/score-ring'
import { StatusBadge } from '../../../components/status-badge'
import type { RepoRecord } from '../../../types/repo'
import { formatUpdatedAt } from '../../../lib/utils'

type RepoCardProps = {
  repo: RepoRecord
  selected: boolean
  onSelect: (repoId: number) => void
}

export function RepoCard({ repo, selected, onSelect }: RepoCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(repo.id)}
      className={`group flex h-full flex-col rounded-3xl border p-5 text-left transition duration-200 ${
        selected
          ? 'border-cyan-300/60 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.2)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{repo.name}</h3>
            <StatusBadge tone={repo.private ? 'warn' : 'success'}>
              {repo.private ? 'Private' : 'Public'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm text-slate-400">{repo.fullName}</p>
        </div>
        <ScoreRing score={repo.score} />
      </div>

      <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-6 text-slate-300">
        {repo.description || 'No description yet.'}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <StatusBadge>{repo.language}</StatusBadge>
        <StatusBadge tone={repo.homepage ? 'success' : 'danger'}>
          {repo.homepage ? 'Live link' : 'No homepage'}
        </StatusBadge>
        <StatusBadge tone={repo.topics.length ? 'neutral' : 'danger'}>
          {repo.topics.length} topics
        </StatusBadge>
        <StatusBadge tone={repo.readmeLoaded ? 'success' : 'warn'}>
          {repo.readmeLoaded ? 'README scanned' : 'README pending'}
        </StatusBadge>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Top issue
            </p>
            <p className="mt-2 text-sm text-slate-200">
              {repo.issues[0]?.label ?? 'Presentation basics are in place.'}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Updated {formatUpdatedAt(repo.updatedAt)}
          </p>
        </div>
      </div>
    </button>
  )
}
