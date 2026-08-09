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
  /** Opens the full-screen reader/editor for the given document. */
  onExpand: (pane: ComparePane) => void
}

/**
 * A single README viewport with a segmented Current/New switch.
 *
 * Showing one pane at a time is what keeps the mobile layout to one screen —
 * the previous side-by-side pair stacked into a double-height column on phones.
 * The pane itself is deliberately short: tapping it opens the full-screen
 * editor, which is where reading and rewriting actually happen.
 */
export function ReadmeCompare({
  current,
  generated,
  isLoading,
  pane,
  onPaneChange,
  onExpand,
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
      </div>

      {/* Mobile and tablet: one pane, switched by the control above. */}
      <div className="xl:hidden">
        <Pane
          label={pane === 'current' ? 'Current README' : 'Generated README'}
          value={pane === 'current' ? current : generated}
          isLoading={isLoading && pane === 'current'}
          canEdit={pane === 'generated' && hasGenerated}
          onExpand={() => onExpand(pane)}
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
          canEdit={false}
          onExpand={() => onExpand('current')}
          emptyText="This repo has no README yet."
        />
        <Pane
          label="Generated README"
          value={generated}
          isLoading={false}
          canEdit={hasGenerated}
          onExpand={() => onExpand('generated')}
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
  canEdit,
  emptyText,
  onExpand,
}: {
  label: string
  value: string
  isLoading: boolean
  canEdit: boolean
  emptyText: string
  onExpand: () => void
}) {
  const body = value.trim()
  const isInteractive = Boolean(body) && !isLoading

  return (
    <section aria-label={label} className="relative">
      <div
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-[#0c121c] dark:text-slate-300"
        style={{ height: 'clamp(160px, 26dvh, 320px)' }}
      >
        <div className="h-full overflow-hidden p-4">
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
        </div>

        {/* Fades the clipped text so it reads as "there is more", not "cut off". */}
        {isInteractive ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-2xl bg-gradient-to-t from-white to-transparent dark:from-[#0c121c]"
          />
        ) : null}
      </div>

      {isInteractive ? (
        <button
          type="button"
          onClick={onExpand}
          className="absolute bottom-2 right-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-3 text-xs font-semibold shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-white/15 dark:bg-[#111a2b]/95 dark:hover:bg-[#162034]"
        >
          <span aria-hidden="true">{canEdit ? '✎' : '⤢'}</span>
          {canEdit ? 'Edit' : 'Expand'}
        </button>
      ) : null}
    </section>
  )
}
