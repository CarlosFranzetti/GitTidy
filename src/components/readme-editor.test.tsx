import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReadmeEditor } from './readme-editor'

describe('ReadmeEditor', () => {
  it('opens in edit mode when saving is allowed', () => {
    render(
      <ReadmeEditor
        title="Generated README"
        value="# Draft"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox', { name: /markdown source/i })).toHaveValue('# Draft')
  })

  it('is read-only for the current README', () => {
    render(<ReadmeEditor title="Current README" value="# Live" onClose={vi.fn()} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
  })

  it('keeps Save disabled until the draft actually changes', async () => {
    render(
      <ReadmeEditor title="t" value="original" onSave={vi.fn()} onClose={vi.fn()} />,
    )

    const save = screen.getByRole('button', { name: /save draft/i })
    expect(save).toBeDisabled()

    await userEvent.type(screen.getByRole('textbox'), ' edited')
    expect(save).toBeEnabled()
  })

  it('passes the edited markdown back and closes', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <ReadmeEditor title="t" value="start" onSave={onSave} onClose={onClose} />,
    )

    await userEvent.type(screen.getByRole('textbox'), '!')
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))

    expect(onSave).toHaveBeenCalledWith('start!')
    expect(onClose).toHaveBeenCalled()
  })

  it('discards the draft on cancel', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<ReadmeEditor title="t" value="start" onSave={onSave} onClose={onClose} />)

    await userEvent.type(screen.getByRole('textbox'), ' throwaway')
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<ReadmeEditor title="t" value="x" onClose={onClose} />)

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders the markdown when switched to preview', async () => {
    render(
      <ReadmeEditor title="t" value="# Hello" onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'preview' }))
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument()
  })

  it('previews unsaved edits, not the original text', async () => {
    render(
      <ReadmeEditor title="t" value="# Old" onSave={vi.fn()} onClose={vi.fn()} />,
    )

    const textarea = screen.getByRole('textbox')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, '# New')
    await userEvent.click(screen.getByRole('button', { name: 'preview' }))

    expect(screen.getByRole('heading', { name: 'New' })).toBeInTheDocument()
  })

  it('restores page scrolling when unmounted', () => {
    const { unmount } = render(
      <ReadmeEditor title="t" value="x" onClose={vi.fn()} />,
    )

    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
