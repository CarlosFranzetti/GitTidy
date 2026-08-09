import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog, type PendingAction } from './confirm-dialog'

function action(overrides: Partial<PendingAction> = {}): PendingAction {
  return {
    title: 'Write to octo/demo?',
    items: ['Description → "A tidy demo"', 'Topics → react, typescript'],
    confirmLabel: 'Apply 2 changes',
    run: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('ConfirmDialog', () => {
  it('lists every pending change as its own item', () => {
    render(
      <ConfirmDialog
        action={action()}
        isWriting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    // The old implementation joined these with \n into a single <p>, which CSS
    // collapsed into one run-on line.
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Description')
    expect(items[1]).toHaveTextContent('Topics')
  })

  it('states that unlisted items are left untouched', () => {
    render(
      <ConfirmDialog action={action()} isWriting={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(screen.getByText(/left untouched/i)).toBeInTheDocument()
  })

  it('is exposed as a modal dialog to assistive technology', () => {
    render(
      <ConfirmDialog action={action()} isWriting={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Write to octo/demo?')
  })

  it('confirms only on an explicit click', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog action={action()} isWriting={false} onCancel={vi.fn()} onConfirm={onConfirm} />,
    )

    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Apply 2 changes' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog action={action()} isWriting={false} onCancel={onCancel} onConfirm={vi.fn()} />,
    )

    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })

  it('locks both buttons while a write is in flight', () => {
    render(
      <ConfirmDialog action={action()} isWriting onCancel={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /writing/i })).toBeDisabled()
  })

  it('ignores Escape while writing so a half-finished write is not abandoned', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog action={action()} isWriting onCancel={onCancel} onConfirm={vi.fn()} />)

    await userEvent.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('moves focus to the confirm button on open', () => {
    render(
      <ConfirmDialog action={action()} isWriting={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: 'Apply 2 changes' })).toHaveFocus()
  })
})
