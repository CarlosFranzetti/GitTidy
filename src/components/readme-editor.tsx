import { useEffect, useRef, useState } from 'react'
import { Markdown } from './markdown'
import { Button, Muted } from './ui'

type Props = {
  title: string
  value: string
  /** Omitted for the read-only current README. */
  onSave?: (value: string) => void
  onClose: () => void
}

/**
 * Full-screen README view.
 *
 * The inline pane is deliberately short so the review step fits one phone
 * screen; this is where you go to actually read or rewrite the document. It
 * takes the whole viewport because a markdown editor in a 200px box is unusable
 * on a phone.
 */
export function ReadmeEditor({ title, value, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(value)
  const [mode, setMode] = useState<'preview' | 'edit'>(onSave ? 'edit' : 'preview')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDirty = draft !== value
  const canEdit = Boolean(onSave)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      // Cmd/Ctrl+Enter saves, matching most comment boxes.
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && onSave) {
        event.preventDefault()
        onSave(draft)
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [draft, onClose, onSave])

  // Stops the page behind the overlay from scrolling on iOS.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    if (mode === 'edit') textareaRef.current?.focus()
  }, [mode])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--app-bg)]"
    >
      <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-white/10">
        <Button onClick={onClose} aria-label="Close editor" className="shrink-0 px-3">
          ✕
        </Button>

        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>

        {canEdit ? (
          <div className="flex shrink-0 rounded-xl bg-slate-950/[0.06] p-0.5 dark:bg-white/[0.07]">
            {(['edit', 'preview'] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
                className={`min-h-9 rounded-[10px] px-3 text-xs font-medium capitalize transition ${
                  mode === id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {mode === 'edit' && canEdit ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            aria-label={`${title} markdown source`}
            className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-6 outline-none"
          />
        ) : (
          <div className="p-4 text-sm leading-6">
            {draft.trim() ? (
              <Markdown>{draft}</Markdown>
            ) : (
              <p className="text-slate-400 dark:text-slate-500">Nothing to show yet.</p>
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-slate-200 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-white/10">
        {canEdit ? (
          <>
            <span className="min-w-0 flex-1 truncate text-xs">
              <Muted>
                {isDirty ? 'Unsaved changes' : `${countWords(draft)} words`}
              </Muted>
            </span>
            <Button onClick={onClose} className="shrink-0">
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!isDirty}
              onClick={() => {
                onSave?.(draft)
                onClose()
              }}
              className="shrink-0"
            >
              Save draft
            </Button>
          </>
        ) : (
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        )}
      </footer>
    </div>
  )
}

function countWords(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}
