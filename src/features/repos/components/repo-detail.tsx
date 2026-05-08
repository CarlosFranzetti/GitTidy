import { Panel } from '../../../components/panel'
import { ScoreRing } from '../../../components/score-ring'
import { StatusBadge } from '../../../components/status-badge'
import type { RepoRecord } from '../../../types/repo'
import { AiOutputPanel } from '../../ai/components/ai-output-panel'
import type { AiSuggestions } from '../../ai/types'

type RepoDetailProps = {
  repo: RepoRecord
  readmeLoading?: boolean
  aiSuggestions: AiSuggestions | null
  aiLoading?: boolean
  aiErrorMessage?: string
  onGenerateAi: () => void
}

const scoreLabels: Record<keyof RepoRecord['scoreBreakdown'], string> = {
  readme: 'README',
  description: 'Description',
  homepage: 'Homepage',
  topics: 'Topics',
}

export function RepoDetail({
  repo,
  readmeLoading = false,
  aiSuggestions,
  aiLoading = false,
  aiErrorMessage = '',
  onGenerateAi,
}: RepoDetailProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel className="p-6 sm:p-7">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-white">{repo.name}</h2>
              <StatusBadge>{repo.language}</StatusBadge>
              <StatusBadge tone={repo.homepage ? 'success' : 'danger'}>
                {repo.homepage ? 'Has homepage' : 'Needs homepage'}
              </StatusBadge>
              <StatusBadge tone={repo.readmeLoaded ? 'success' : 'warn'}>
                {readmeLoading
                  ? 'Scanning README'
                  : repo.readmeLoaded
                    ? 'README scored'
                    : 'README pending'}
              </StatusBadge>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {repo.description || 'This repository is missing a public-facing description.'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <ScoreRing score={repo.score} size="lg" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Quality score
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Weighted from README depth, metadata quality, homepage presence,
                and topic coverage.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Score breakdown
            </p>
            <div className="mt-4 space-y-4">
              {Object.entries(repo.scoreBreakdown).map(([key, value]) => (
                <div key={key}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-200">
                      {scoreLabels[key as keyof typeof scoreLabels]}
                    </span>
                    <span className="font-medium text-white">{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-emerald-300"
                      style={{ width: `${Math.max(8, value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Immediate cleanup targets
            </p>
            <div className="mt-4 space-y-3">
              {repo.issues.length > 0 ? (
                repo.issues.map((issue) => (
                  <div
                    key={issue.type}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <p className="font-medium text-white">{issue.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {issue.detail}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="font-medium text-white">No urgent cleanup gaps</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Metadata basics are in place. Phase 3 can focus on stronger
                    README polish and sharper positioning.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </Panel>

      <div className="grid gap-5">
        <Panel className="p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Repo scan
          </p>
          <div className="mt-4 space-y-4">
            {repo.insights.map((insight) => (
              <div
                key={insight.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-sm font-medium text-white">{insight.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {insight.value}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <AiOutputPanel
          suggestions={aiSuggestions}
          loading={aiLoading}
          errorMessage={aiErrorMessage}
          onGenerate={onGenerateAi}
        />
      </div>
    </div>
  )
}
