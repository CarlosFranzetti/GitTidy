import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from 'react'

/**
 * Every interactive control is at least 44px tall, the minimum comfortable
 * touch target on iOS and Android.
 */
const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium transition ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-violet-500 focus-visible:ring-offset-[var(--app-bg)]'

const VARIANTS = {
  primary:
    'bg-violet-600 text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500 ' +
    'dark:bg-violet-500 dark:hover:bg-violet-400',
  secondary:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 ' +
    'dark:border-white/12 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]',
  ghost:
    'text-slate-600 hover:bg-slate-950/5 dark:text-slate-300 dark:hover:bg-white/[0.08]',
  danger:
    'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 ' +
    'dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20',
} as const

export type ButtonVariant = keyof typeof VARIANTS

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  /** React 19 passes ref through as an ordinary prop. */
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

const FIELD_BASE =
  'min-h-11 w-full rounded-xl border px-3 text-base outline-none transition sm:text-sm ' +
  'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 ' +
  'focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 ' +
  'dark:border-white/12 dark:bg-black/25 dark:text-slate-100 dark:placeholder:text-slate-500 ' +
  'dark:focus:border-violet-400/70'

export function TextField({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_BASE} ${className}`} {...rest} />
}

export function TextArea({
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${FIELD_BASE} resize-none py-2.5 leading-6 ${className}`}
      {...rest}
    />
  )
}

export function Card({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={
        'rounded-2xl border border-slate-200 bg-white shadow-sm ' +
        'dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none ' +
        className
      }
    >
      {children}
    </div>
  )
}

export function Muted({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span className={`text-slate-600 dark:text-slate-400 ${className}`}>{children}</span>
  )
}

export function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 80
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300'
      : score >= 50
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200'
        : 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200'

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}
      aria-label={`Repository score ${score} out of 100`}
    >
      {score}
    </span>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={{ animation: 'gt-spin 0.9s steps(12, end) infinite' }}
      aria-hidden="true"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <line
          key={index}
          x1="12"
          y1="3.5"
          x2="12"
          y2="7"
          strokeWidth="2.4"
          strokeLinecap="round"
          stroke="currentColor"
          opacity={(index + 1) / 12}
          transform={`rotate(${index * 30} 12 12)`}
        />
      ))}
    </svg>
  )
}
