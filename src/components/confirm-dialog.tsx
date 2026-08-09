import { useEffect, useRef } from 'react'
import { Button, Spinner } from './ui'

export type PendingAction = {
  title: string
  /** Rendered as a bulleted list so the user sees exactly what will change. */
  items: string[]
  note?: string
  confirmLabel: string
  run: () => Promise<void>
}

type Props = {
  action: PendingAction
  isWriting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ action, isWriting, onCancel, onConfirm }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isWriting) {
        onCancel()
        return
      }

      if (event.key !== 'Tab') return

      // Keeps keyboard focus inside the dialog while it is open.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isWriting, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isWriting) onCancel()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="animate-rise max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-5 dark:border-white/10 dark:bg-[#111a2b] dark:text-slate-100"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-white/20" />

        <h2 id="confirm-title" className="text-lg font-semibold">
          {action.title}
        </h2>

        <ul className="mt-3 space-y-1.5">
          {action.items.map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <span aria-hidden="true" className="text-violet-500">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {action.note ? (
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{action.note}</p>
        ) : null}

        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
          Anything not listed above is left untouched. GitTidy never writes on its own.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} disabled={isWriting}>
            Cancel
          </Button>
          <Button ref={confirmRef} variant="primary" onClick={onConfirm} disabled={isWriting}>
            {isWriting ? (
              <>
                <Spinner className="h-4 w-4" />
                Writing…
              </>
            ) : (
              action.confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
