import { Markdown } from './markdown'
import { Muted, Spinner } from './ui'

export type ComparePane = 'current' | 'generated'

type Props = {
  current: string
  generated: string
  isLoading: boolean
  /** Forces a pane; used to jump to the new README once generation finishes. */
  pane: ComparePane
  onPaneChange: (pane: ComparePane) => void
}

/**
 * A single README viewport with a segmented Current/New switch.
 *
 * Showing one pane at a time is what keeps the mobile layout to one screen —
 * the previous side-by-side pair stacked into a double-height column on phones.
 * On wide screens both panes are shown together, since the room is there.
 */
export function ReadmeCompare({
  current,
  generated,
  isLoading,
  pane,
  onPaneChange,
}: Props) {
  const hasGenerated = Boolean(generated.trim())

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="README version"
          className="inline-flex rounded-xl bg-slate-950/[0.06] p-0.5 dark:bg-white/[0.07] xl:hidden"
        >
          <PaneTab
            id="current"
            active={pane === 'current'}
            onSelect={onPaneChange}
            label="Current"
          />
          <PaneTab
            id="generated"
            active={pane === 'generated'}
            onSelect={onPaneChange}
            label="New"
            disabled={!hasGenerated}
          />
        </div>
        <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] xl:block">
          <Muted>README</Muted>
        </span>
        {hasGenerated ? (
          <span className="min-w-0 truncate text-xs xl:hidden">
            <Muted>
              {pane === 'current' ? 'Showing what is on GitHub' : 'Showing the draft'}
            </Muted>
          </span>
        ) : null}
      </div>

      {/* Mobile and tablet: one pane, switched by the control above. */}
      <div className="xl:hidden">
        <Pane
          label={pane === 'current' ? 'Current README' : 'Generated README'}
          value={pane === 'current' ? current : generated}
          isLoading={isLoading && pane === 'current'}
          emptyText={
            pane === 'current'
              ? 'This repo has no README yet.'
              : 'Generate a README to preview it here.'
          }
        />
      </div>

      {/* Desktop: both panes side by side. */}
      <div className="hidden gap-3 xl:grid xl:grid-cols-2">
        <Pane
          label="Current README"
          value={current}
          isLoading={isLoading}
          emptyText="This repo has no README yet."
        />
        <Pane
          label="Generated README"
          value={generated}
          isLoading={false}
          emptyText="Generate a README to preview it here."
        />
      </div>
    </div>
  )
}

function PaneTab({
  id,
  label,
  active,
  disabled,
  onSelect,
}: {
  id: ComparePane
  label: string
  active: boolean
  disabled?: boolean
  onSelect: (pane: ComparePane) => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={() => onSelect(id)}
      className={`min-h-11 rounded-[10px] px-4 text-sm font-medium transition disabled:opacity-40 ${
        active
          ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
          : 'text-slate-600 dark:text-slate-400'
      }`}
    >
      {label}
    </button>
  )
}

function Pane({
  label,
  value,
  isLoading,
  emptyText,
}: {
  label: string
  value: string
  isLoading: boolean
  emptyText: string
}) {
  const body = value.trim()

  return (
    <section
      aria-label={label}
      className="min-h-[220px] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-black/15 dark:text-slate-300"
      style={{ maxHeight: 'min(52vh, 480px)' }}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Spinner className="h-4 w-4" />
          <span>Reading the repository…</span>
        </div>
      ) : body ? (
        <Markdown>{body}</Markdown>
      ) : (
        <p className="text-slate-400 dark:text-slate-500">{emptyText}</p>
      )}
    </section>
  )
}
