export type Theme = 'light' | 'dark' | 'system'

/**
 * GitTidy opens in dark mode. A first-time visitor with no stored preference
 * gets dark regardless of their OS setting; choosing "Auto" opts into following
 * the system instead.
 */
const DEFAULT_THEME: Theme = 'dark'

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

export function isDarkTheme(theme: Theme): boolean {
  return theme === 'dark' || (theme === 'system' && prefersDark())
}

/** Toggles the `dark` class the Tailwind custom variant keys off. */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return

  const dark = isDarkTheme(theme)
  document.documentElement.classList.toggle('dark', dark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#070b12' : '#f6f7f9')
}
