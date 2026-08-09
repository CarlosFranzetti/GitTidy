import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Markdown } from './markdown'

describe('Markdown', () => {
  it('renders ordinary markdown', () => {
    render(<Markdown># Hello</Markdown>)
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument()
  })

  it('renders GitHub-flavoured tables', () => {
    render(<Markdown>{'| a | b |\n| - | - |\n| 1 | 2 |'}</Markdown>)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('escapes a raw script tag instead of executing it', () => {
    const { container } = render(
      <Markdown>{'<script>window.__pwned = true</script>'}</Markdown>,
    )

    expect(container.querySelector('script')).toBeNull()
    expect(
      (window as unknown as Record<string, unknown>).__pwned,
    ).toBeUndefined()
  })

  it('does not render an img with an inline error handler', () => {
    const { container } = render(
      <Markdown>{'<img src=x onerror="window.__pwned = true">'}</Markdown>,
    )

    expect(container.querySelector('img[onerror]')).toBeNull()
  })

  it('strips javascript: URLs from links', () => {
    const { container } = render(
      <Markdown>{'[click me](javascript:alert(1))'}</Markdown>,
    )

    const link = container.querySelector('a')
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
  })

  it('opens external links safely', () => {
    const { container } = render(<Markdown>{'[docs](https://example.com)'}</Markdown>)

    const link = container.querySelector('a')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
    expect(link?.getAttribute('rel')).toContain('noreferrer')
  })

  it('wraps tables so wide content scrolls instead of breaking the page', () => {
    const { container } = render(<Markdown>{'| a | b |\n| - | - |\n| 1 | 2 |'}</Markdown>)

    const wrapper = container.querySelector('table')?.parentElement
    expect(wrapper?.className).toContain('overflow-x-auto')
  })

  it('gives images an alt attribute even when the markdown omits one', () => {
    const { container } = render(<Markdown>{'![](https://example.com/a.png)'}</Markdown>)
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })
})
