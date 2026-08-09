import { describe, expect, it } from 'vitest'
import {
  PROMPT_CHAR_LIMIT,
  splitFullName,
  toGenerationInput,
  toToneString,
  truncateForPrompt,
} from './prompt'
import type { RepoRecord } from '../../types/repo'

describe('splitFullName', () => {
  it('splits owner and name', () => {
    expect(splitFullName('octocat/hello-world')).toEqual({
      owner: 'octocat',
      name: 'hello-world',
    })
  })

  it('keeps everything after the first slash as the name', () => {
    expect(splitFullName('owner/weird/name')).toEqual({
      owner: 'owner',
      name: 'weird/name',
    })
  })

  it('handles a value with no slash without producing undefined', () => {
    expect(splitFullName('lonely')).toEqual({ owner: 'lonely', name: '' })
  })
})

describe('truncateForPrompt', () => {
  it('leaves short content untouched', () => {
    expect(truncateForPrompt('short')).toBe('short')
  })

  it('trims surrounding whitespace', () => {
    expect(truncateForPrompt('  padded  ')).toBe('padded')
  })

  it('caps long content at the shared limit', () => {
    const result = truncateForPrompt('x'.repeat(PROMPT_CHAR_LIMIT + 500))
    expect(result).toHaveLength(PROMPT_CHAR_LIMIT + 1)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('toToneString', () => {
  it('maps every known tone to a distinct instruction', () => {
    const tones = ['fun', 'professional', 'minimal', 'technical'].map(toToneString)
    expect(new Set(tones).size).toBe(4)
  })

  it('falls back to the friendly tone for an unknown value', () => {
    expect(toToneString('nonsense')).toBe(toToneString('fun'))
  })
})

describe('toGenerationInput', () => {
  const repo: RepoRecord = {
    id: 1,
    name: 'demo',
    fullName: 'octo/demo',
    description: 'A demo',
    private: false,
    language: 'TypeScript',
    updatedAt: '2026-01-01T00:00:00Z',
    homepage: '',
    topics: ['a'],
    defaultBranch: 'main',
    readmeWordCount: 3,
    score: 40,
    scoreBreakdown: { readme: 0, description: 20, homepage: 0, topics: 8 },
    checklist: {
      hasReadme: false,
      hasDetailedReadme: false,
      hasDescription: true,
      hasHomepage: false,
      hasTopics: false,
    },
    issues: [{ type: 'homepage', label: 'No deploy link', detail: 'Add one.' }],
  }

  it('derives the word count from the supplied text, not the stale record', () => {
    const input = toGenerationInput(repo, 'one two three four five')
    expect(input.readmeWordCount).toBe(5)
  })

  it('flattens issues into prompt-ready strings', () => {
    expect(toGenerationInput(repo, '').issues).toEqual(['No deploy link: Add one.'])
  })

  it('truncates oversized README content before it reaches the network', () => {
    const input = toGenerationInput(repo, 'y'.repeat(PROMPT_CHAR_LIMIT + 1000))
    expect(input.existingReadme.length).toBeLessThanOrEqual(PROMPT_CHAR_LIMIT + 1)
  })
})
