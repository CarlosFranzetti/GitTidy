import type { ReactNode } from 'react'
import { StatusBadge } from './status-badge'

type AppShellProps = {
  children: ReactNode
  modeLabel: string
  metrics: Array<{ label: string; value: string }>
}

export function AppShell({ children, modeLabel, metrics }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.1),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#0f172a_40%,_#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-white/10 bg-slate-950/60 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <StatusBadge tone="success">Scoped MVP</StatusBadge>
                <StatusBadge>{modeLabel}</StatusBadge>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                GitTidy
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Clean up weak GitHub repo presentation fast. Find the obvious
                gaps, score them, and prepare AI-generated upgrades without
                building backend overhead first.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <Metric
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                />
              ))}
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}

type MetricProps = {
  label: string
  value: string
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="min-w-[132px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}
