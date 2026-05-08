import type { ReactNode } from 'react'

type PanelProps = {
  children: ReactNode
  className?: string
}

export function Panel({ children, className = '' }: PanelProps) {
  return (
    <section
      className={`rounded-3xl border border-white/10 bg-slate-950/55 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur ${className}`}
    >
      {children}
    </section>
  )
}
