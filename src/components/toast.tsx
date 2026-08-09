export type ToastTone = 'error' | 'success'

const TONES = {
  error:
    'border-amber-300 bg-amber-50/95 text-amber-900 dark:border-amber-400/30 dark:bg-[#1a1408]/95 dark:text-amber-100',
  success:
    'border-emerald-300 bg-emerald-50/95 text-emerald-900 dark:border-emerald-400/30 dark:bg-[#04160f]/95 dark:text-emerald-100',
} as const

export function Toast({
  message,
  tone,
  onDismiss,
}: {
  message: string
  tone: ToastTone
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      /* Anchored to both edges so a long message wraps instead of overflowing a
         375px screen, then constrained to a card width on larger displays. */
      className={`animate-rise fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md sm:inset-x-auto sm:left-auto sm:right-4 sm:top-20 ${TONES[tone]}`}
    >
      <span aria-hidden="true" className="mt-px font-semibold">
        {tone === 'error' ? '!' : '✓'}
      </span>
      <span className="flex-1 leading-5">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-my-2 -mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg opacity-60 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        ✕
      </button>
    </div>
  )
}
