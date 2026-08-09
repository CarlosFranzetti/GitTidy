import { useEffect, useRef, useState } from 'react'
import { FONT_OPTIONS, type FontChoice } from '../lib/fonts'
import type { Theme } from '../lib/theme'
import { Button } from './ui'

type Props = {
  theme: Theme
  font: FontChoice
  onThemeChange: (theme: Theme) => void
  onFontChange: (font: FontChoice) => void
}

export function SettingsMenu({ theme, font, onThemeChange, onFontChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <Button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Appearance settings"
        className="w-11 px-0"
      >
        <span aria-hidden="true">Aa</span>
      </Button>

      {open ? (
        <div
          role="menu"
          className="animate-rise absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#111a2b]"
        >
          <Group label="Appearance">
            <Segmented
              value={theme}
              options={[
                { id: 'light', label: 'Light' },
                { id: 'dark', label: 'Dark' },
                { id: 'system', label: 'Auto' },
              ]}
              onChange={onThemeChange}
            />
          </Group>

          <Group label="Typeface">
            <div className="space-y-1">
              {FONT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={font === option.id}
                  onClick={() => onFontChange(option.id)}
                  className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left transition ${
                    font === option.id
                      ? 'bg-violet-100 text-violet-900 dark:bg-violet-400/15 dark:text-violet-200'
                      : 'hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span>
                    <span
                      className="block text-sm font-medium"
                      style={{ fontFamily: option.stack }}
                    >
                      {option.label}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {option.hint}
                    </span>
                  </span>
                  {font === option.id ? <span aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>
          </Group>
        </div>
      ) : null}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      {children}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-xl bg-slate-950/[0.06] p-0.5 dark:bg-white/[0.07]">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="menuitemradio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={`min-h-11 flex-1 rounded-[10px] text-xs font-medium transition ${
            value === option.id
              ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
