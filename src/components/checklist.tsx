import type { ScoreChecklist } from '../types/repo'
import { Muted } from './ui'

const LABELS: Array<[keyof ScoreChecklist, string]> = [
  ['hasReadme', 'README exists'],
  ['hasDetailedReadme', 'README has enough detail'],
  ['hasDescription', 'Description set'],
  ['hasHomepage', 'Deploy link set'],
  ['hasTopics', 'At least 3 topics'],
]

export function Checklist({
  checklist,
  score,
}: {
  checklist: ScoreChecklist
  score: number
}) {
  const done = LABELS.filter(([key]) => checklist[key]).length

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Repo health</h3>
        <span className="text-xs tabular-nums">
          <Muted>
            {done}/{LABELS.length} · {score}/100
          </Muted>
        </span>
      </div>

      <div
        className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Repository score"
      >
        <div
          className="h-full rounded-full bg-violet-500 transition-[width] duration-500"
          style={{ width: `${score}%` }}
        />
      </div>

      <ul className="space-y-2">
        {LABELS.map(([key, label]) => (
          <li key={key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${
                checklist[key]
                  ? 'bg-emerald-500 text-white dark:bg-emerald-400/20 dark:text-emerald-300'
                  : 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500'
              }`}
            >
              {checklist[key] ? '✓' : '·'}
            </span>
            <span className={checklist[key] ? '' : 'text-slate-600 dark:text-slate-400'}>
              {label}
            </span>
            <span className="sr-only">{checklist[key] ? 'done' : 'not done'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
