import { describe, expect, it } from 'vitest'
import { countWords, scoreRepository, scoreReadme, scoreTopics } from './scoring'

const EMPTY = { description: '', homepage: '', topics: [], readmeWordCount: 0 }

describe('scoreReadme', () => {
  it.each([
    [0, 0],
    [19, 0],
    [20, 14],
    [79, 14],
    [80, 26],
    [179, 26],
    [180, 35],
    [10_000, 35],
  ])('scores %i words as %i', (words, expected) => {
    expect(scoreReadme(words)).toBe(expected)
  })
})

describe('scoreTopics', () => {
  it.each([
    [0, 0],
    [1, 8],
    [2, 16],
    [3, 16],
    [4, 25],
    [12, 25],
  ])('scores %i topics as %i', (count, expected) => {
    expect(scoreTopics(count)).toBe(expected)
  })
})

describe('scoreRepository', () => {
  it('gives a fully empty repo zero', () => {
    const result = scoreRepository(EMPTY)
    expect(result.score).toBe(0)
    expect(Object.values(result.checklist).every((value) => value === false)).toBe(true)
  })

  it('caps a fully populated repo at exactly 100', () => {
    const result = scoreRepository({
      description: 'A real description',
      homepage: 'https://example.com',
      topics: ['a', 'b', 'c', 'd'],
      readmeWordCount: 500,
    })

    expect(result.score).toBe(100)
    expect(result.issues).toHaveLength(0)
    expect(Object.values(result.checklist).every(Boolean)).toBe(true)
  })

  it('never exceeds 100 for any input combination', () => {
    for (const words of [0, 20, 80, 180, 5000]) {
      for (const topics of [0, 1, 2, 4, 30]) {
        const result = scoreRepository({
          description: 'x',
          homepage: 'https://x.dev',
          topics: Array.from({ length: topics }, (_, i) => `t${i}`),
          readmeWordCount: words,
        })
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
      }
    }
  })

  it('treats whitespace-only metadata as missing', () => {
    const result = scoreRepository({
      ...EMPTY,
      description: '   ',
      homepage: '\t\n ',
    })

    expect(result.checklist.hasDescription).toBe(false)
    expect(result.checklist.hasHomepage).toBe(false)
    expect(result.scoreBreakdown.description).toBe(0)
    expect(result.scoreBreakdown.homepage).toBe(0)
  })

  it('requires three topics for the checklist even though two already score', () => {
    const two = scoreRepository({ ...EMPTY, topics: ['a', 'b'] })
    expect(two.scoreBreakdown.topics).toBe(16)
    expect(two.checklist.hasTopics).toBe(false)

    const three = scoreRepository({ ...EMPTY, topics: ['a', 'b', 'c'] })
    expect(three.checklist.hasTopics).toBe(true)
  })

  it('reports a missing README rather than a thin one when there is none', () => {
    const none = scoreRepository(EMPTY)
    expect(none.issues.find((issue) => issue.type === 'readme')?.label).toBe('No README')

    const thin = scoreRepository({ ...EMPTY, readmeWordCount: 30 })
    expect(thin.issues.find((issue) => issue.type === 'readme')?.label).toBe('Thin README')
  })

  it('breakdown always sums to the reported score', () => {
    const result = scoreRepository({
      description: 'x',
      homepage: '',
      topics: ['a', 'b'],
      readmeWordCount: 100,
    })
    const sum = Object.values(result.scoreBreakdown).reduce((a, b) => a + b, 0)
    expect(sum).toBe(result.score)
  })
})

describe('countWords', () => {
  it.each([
    ['', 0],
    ['   ', 0],
    ['one', 1],
    ['one two three', 3],
    ['  padded   words  ', 2],
    ['line\nbreak\ttab', 3],
  ])('counts %j as %i', (input, expected) => {
    expect(countWords(input)).toBe(expected)
  })
})
