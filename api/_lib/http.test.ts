import { describe, expect, it } from 'vitest'
import { HttpError, parseModelJson, previewText, resolveStatus } from './http.js'

describe('parseModelJson', () => {
  const expected = { readme_md: '# Hi', description: 'd', topics: ['a'] }

  it('parses a clean JSON object', () => {
    expect(parseModelJson(JSON.stringify(expected))).toEqual(expected)
  })

  it('tolerates surrounding whitespace and newlines', () => {
    expect(parseModelJson(`\n\n  ${JSON.stringify(expected)}  \n`)).toEqual(expected)
  })

  it('unwraps a ```json fenced block', () => {
    expect(parseModelJson('```json\n' + JSON.stringify(expected) + '\n```')).toEqual(
      expected,
    )
  })

  it('unwraps a bare ``` fenced block', () => {
    expect(parseModelJson('```\n' + JSON.stringify(expected) + '\n```')).toEqual(expected)
  })

  it('extracts an object buried in commentary', () => {
    const noisy = `Sure! Here is the JSON you asked for:\n${JSON.stringify(expected)}\nLet me know if you need changes.`
    expect(parseModelJson(noisy)).toEqual(expected)
  })

  it('keeps fenced code blocks that live inside a string value', () => {
    const withCode = { readme_md: 'Install:\n```sh\nnpm i\n```\nDone.' }
    expect(parseModelJson(JSON.stringify(withCode))).toEqual(withCode)
  })

  it('throws with the raw content attached when nothing parses', () => {
    expect.assertions(3)
    try {
      parseModelJson('I am afraid I cannot do that.')
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(502)
      expect((error as HttpError).rawContent).toBe('I am afraid I cannot do that.')
    }
  })

  it('throws on empty output rather than returning undefined', () => {
    expect(() => parseModelJson('')).toThrow(HttpError)
  })
})

describe('resolveStatus', () => {
  it('reads the status off an HttpError', () => {
    expect(resolveStatus(new HttpError('nope', 429))).toBe(429)
  })

  it('defaults an unknown throw to 500', () => {
    expect(resolveStatus(new Error('boom'))).toBe(500)
    expect(resolveStatus('a string')).toBe(500)
    expect(resolveStatus(null)).toBe(500)
  })
})

describe('previewText', () => {
  it('truncates long bodies', () => {
    expect(previewText('x'.repeat(500))).toHaveLength(240)
  })

  it('describes an empty body instead of returning nothing', () => {
    expect(previewText('   ')).toBe('No response body.')
  })
})
