import { STEPS, type Step } from '../lib/steps'

export function Stepper({
  current,
  reachable,
  onNavigate,
}: {
  current: Step
  /** Steps the user has unlocked; later steps stay disabled until then. */
  reachable: Step[]
  onNavigate: (step: Step) => void
}) {
  const currentIndex = STEPS.findIndex((step) => step.id === current)

  return (
    <nav aria-label="Progress" className="flex items-center gap-1.5">
      {STEPS.map((step, index) => {
        const isCurrent = step.id === current
        const isDone = index < currentIndex
        const canGo = reachable.includes(step.id)

        return (
          <button
            key={step.id}
            type="button"
            disabled={!canGo}
            aria-current={isCurrent ? 'step' : undefined}
            onClick={() => onNavigate(step.id)}
            className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              isCurrent
                ? 'bg-violet-600 text-white dark:bg-violet-500'
                : isDone
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300'
                  : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                isCurrent
                  ? 'bg-white/25'
                  : isDone
                    ? 'bg-violet-600 text-white dark:bg-violet-400 dark:text-slate-900'
                    : 'bg-slate-200 dark:bg-white/10'
              }`}
            >
              {isDone ? '✓' : index + 1}
            </span>
            {step.label}
          </button>
        )
      })}
    </nav>
  )
}
