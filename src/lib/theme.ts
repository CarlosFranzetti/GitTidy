export type Theme = 'light' | 'dark' | 'system'

const DEFAULT_THEME: Theme = 'system'

export function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveTheme(value: string | null): Theme {
  return isTheme(value) ? value : DEFAULT_THEME
}

export function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Toggles the `dark` class the Tailwind custom variant keys off. */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return

  const isDark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', isDark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark ? '#070b12' : '#f6f7f9')
}
