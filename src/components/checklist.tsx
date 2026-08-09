import type { ScoreChecklist } from '../types/repo'
import { Muted } from './ui'

const LABELS: Array<[keyof ScoreChecklist, string]> = [
  ['hasReadme', 'README exists'],
  ['hasDetailedReadme', 'README has enough detail'],
  ['hasDescription', 'Description set'],
  ['hasHomepage', 'Deploy link set'],
  ['hasTopics', 'At least 3 topics'],
]

/**
 * Only the unmet items are listed.
 *
 * A row saying "Description set ✓" costs vertical space to tell the user
 * nothing actionable, and on a phone that space is the difference between the
 * README being on screen or not. The count and bar still convey overall state.
 */
export function Checklist({
  checklist,
  score,
}: {
  checklist: ScoreChecklist
  score: number
}) {
  const missing = LABELS.filter(([key]) => !checklist[key])
  const done = LABELS.length - missing.length

  return (
    <div className="rounded-2xl border border-slate-200 p-3.5 dark:border-white/10">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Repo health</h3>
        <span className="text-xs tabular-nums">
          <Muted>
            {done}/{LABELS.length} · {score}/100
          </Muted>
        </span>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
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

      {missing.length === 0 ? (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          ✓ Everything checks out.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {missing.map(([key, label]) => (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-400"
              >
                ·
              </span>
              <span className="text-slate-600 dark:text-slate-400">{label}</span>
            </li>
          ))}
        </ul>
      )}

      {/* The full state stays available to assistive technology. */}
      <ul className="sr-only">
        {LABELS.map(([key, label]) => (
          <li key={key}>{`${label}: ${checklist[key] ? 'done' : 'not done'}`}</li>
        ))}
      </ul>
    </div>
  )
}
