import type { ReactNode } from 'react'

type StatusBadgeProps = {
  tone?: 'neutral' | 'success' | 'warn' | 'danger'
  children: ReactNode
}

const toneClasses: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  neutral: 'border-white/12 bg-white/6 text-slate-200',
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  warn: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  danger: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
}

export function StatusBadge({
  tone = 'neutral',
  children,
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}
