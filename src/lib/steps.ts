export type Step = 'pick' | 'review' | 'apply'

export const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'pick', label: 'Pick' },
  { id: 'review', label: 'Review' },
  { id: 'apply', label: 'Apply' },
]
