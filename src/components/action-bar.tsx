import type { ReactNode } from 'react'

/**
 * Sticky bottom bar holding the primary action for the current step.
 *
 * The old layout put Generate and Apply at the end of a long scroll, so on a
 * phone the main action was usually offscreen. Pinning it means the next step
 * is always one thumb tap away, and the safe-area padding keeps it clear of the
 * iPhone home indicator.
 */
export function ActionBar({
  children,
  hint,
}: {
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-4 border-t border-slate-200 bg-[var(--app-bg)]/92 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 dark:border-white/10">
      {hint ? (
        <p className="mb-2 text-center text-xs text-slate-600 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
      <div className="flex min-w-0 items-center gap-2">{children}</div>
    </div>
  )
}
