import { useState } from 'react'
import { Panel } from '../../../components/panel'
import { StatusBadge } from '../../../components/status-badge'
import { copyText } from '../../../lib/clipboard'
import type { AiSuggestions } from '../types'

type AiOutputPanelProps = {
  suggestions: AiSuggestions | null
  loading: boolean
  errorMessage: string
  onGenerate: () => void
  disabled?: boolean
}

export function AiOutputPanel({
  suggestions,
  loading,
  errorMessage,
  onGenerate,
  disabled = false,
}: AiOutputPanelProps) {
  const [copyMessage, setCopyMessage] = useState('')

  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            AI improvement output
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            OpenRouter suggestions are generated on demand so Phase 3 stays
            cheap and scoped.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled || loading}
          className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge tone="warn">Phase 3</StatusBadge>
        <StatusBadge>{suggestions ? 'Generated result' : 'No output yet'}</StatusBadge>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      {copyMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {copyMessage}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        <AiSection
          title="Suggested description"
          body={
            suggestions?.description ??
            'Sharper GitHub summary tuned for first-time visitors.'
          }
          onCopy={
            suggestions?.description
              ? () => void handleCopy('Description copied.', suggestions.description)
              : undefined
          }
        />
        <AiSection
          title="README rewrite"
          body={
            suggestions?.readmeMd ??
            'Improved project overview, setup, feature list, and demo guidance.'
          }
          prewrap
          onCopy={
            suggestions?.readmeMd
              ? () => void handleCopy('README copied.', suggestions.readmeMd)
              : undefined
          }
        />
        <AiSection
          title="Topics"
          body={
            suggestions
              ? suggestions.topics.join(', ')
              : 'Relevant tags based on the repository language and use case.'
          }
          onCopy={
            suggestions?.topics
              ? () =>
                  void handleCopy(
                    'Topics copied.',
                    suggestions.topics.join(', '),
                  )
              : undefined
          }
        />
        <AiSection
          title="Deploy ideas"
          body={
            suggestions
              ? suggestions.deploySuggestion
              : 'Hosting or demo recommendations based on the repository type.'
          }
          prewrap
          onCopy={
            suggestions?.deploySuggestion
              ? () =>
                  void handleCopy(
                    'Deploy suggestions copied.',
                    suggestions.deploySuggestion,
                  )
              : undefined
          }
        />
      </div>
    </Panel>
  )

  async function handleCopy(successMessage: string, value: string) {
    try {
      await copyText(value)
      setCopyMessage(successMessage)
      window.setTimeout(() => setCopyMessage(''), 1800)
    } catch {
      setCopyMessage('Clipboard write failed in this browser context.')
    }
  }
}

type AiSectionProps = {
  title: string
  body: string
  prewrap?: boolean
  onCopy?: () => void
}

function AiSection({ title, body, prewrap = false, onCopy }: AiSectionProps) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-white">{title}</p>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:bg-white/[0.08]"
          >
            Copy
          </button>
        ) : null}
      </div>
      <p
        className={`mt-2 text-sm leading-6 text-slate-300 ${prewrap ? 'whitespace-pre-wrap' : ''}`}
      >
        {body}
      </p>
    </div>
  )
}
