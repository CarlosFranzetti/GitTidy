export type FontChoice = 'inter' | 'outfit' | 'system'

export type FontOption = {
  id: FontChoice
  label: string
  hint: string
  /** Value assigned to the --font-ui custom property. */
  stack: string
}

export const FONT_OPTIONS: readonly FontOption[] = [
  {
    id: 'inter',
    label: 'Inter',
    hint: 'Neutral and dense',
    stack: "'Inter'",
  },
  {
    id: 'outfit',
    label: 'Outfit',
    hint: 'Rounded and friendly',
    stack: "'Outfit'",
  },
  {
    id: 'system',
    label: 'System',
    hint: 'Matches your OS',
    stack:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto",
  },
] as const

const DEFAULT_FONT: FontChoice = 'inter'

export function isFontChoice(value: string | null): value is FontChoice {
  return FONT_OPTIONS.some((option) => option.id === value)
}

export function resolveFont(value: string | null): FontChoice {
  return isFontChoice(value) ? value : DEFAULT_FONT
}

export function applyFont(choice: FontChoice) {
  const option = FONT_OPTIONS.find((entry) => entry.id === choice)
  if (!option || typeof document === 'undefined') return

  document.documentElement.style.setProperty('--font-ui', option.stack)
}
