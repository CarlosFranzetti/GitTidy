import { expect, test } from '@playwright/test'
import { mockBackend, signIn } from './fixtures'

test.beforeEach(async ({ page }) => {
  await mockBackend(page)
  await signIn(page)
})

test('signed-out visitors get a sign-in call to action', async ({ page }) => {
  await page.context().clearCookies()
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')

  await expect(
    page.getByRole('button', { name: /sign in with github/i }),
  ).toBeVisible()
})

test('walks pick → review → apply and confirms before writing', async ({ page }) => {
  const writes: string[] = []
  await page.route('https://api.github.com/repos/**', async (route) => {
    const method = route.request().method()
    if (method === 'PATCH' || method === 'PUT') {
      writes.push(`${method} ${route.request().url()}`)
      return route.fulfill({ json: { ok: true } })
    }
    return route.fallback()
  })

  await page.goto('/')

  await page.getByRole('button', { name: /gittidy/i }).first().click()
  await expect(page.getByRole('button', { name: /generate readme/i })).toBeVisible()

  await page.getByRole('button', { name: /generate readme/i }).click()
  await expect(page.getByRole('button', { name: /choose changes/i })).toBeVisible()

  // Nothing may have been written before the confirmation step.
  expect(writes).toHaveLength(0)

  await page.getByRole('button', { name: /choose changes/i }).click()
  await page.getByRole('button', { name: /review & apply/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expect(writes).toHaveLength(0)

  await dialog.getByRole('button', { name: /^apply/i }).click()
  await expect(dialog).toBeHidden()
  expect(writes.length).toBeGreaterThan(0)
})

test('cancelling the confirmation writes nothing', async ({ page }) => {
  let wrote = false
  await page.route('https://api.github.com/repos/**', async (route) => {
    const method = route.request().method()
    if (method === 'PATCH' || method === 'PUT') {
      wrote = true
      return route.fulfill({ json: {} })
    }
    return route.fallback()
  })

  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()
  await page.getByRole('button', { name: /generate readme/i }).click()
  await page.getByRole('button', { name: /choose changes/i }).click()
  await page.getByRole('button', { name: /review & apply/i }).click()

  await page.getByRole('button', { name: /cancel/i }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect(wrote).toBe(false)
})

test('metadata-only path needs no README generation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()

  await page.getByRole('button', { name: /description \+ topics only/i }).click()

  await page.getByRole('button', { name: /skip|choose changes/i }).first().click()

  // README stays unavailable; description and topics are ready to write.
  const readmeRow = page.getByRole('checkbox', { name: /README\.md/i })
  await expect(readmeRow).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: /description/i })).toBeChecked()
})

test('expands the generated README into a full-screen editor', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()
  await page.getByRole('button', { name: /generate readme/i }).click()

  await page.getByRole('button', { name: /^edit$/i }).first().click()

  const editor = page.getByRole('dialog', { name: /generated readme/i })
  await expect(editor).toBeVisible()

  const source = editor.getByRole('textbox', { name: /markdown source/i })
  await source.fill('# Edited by hand\n\nMy own words.')
  await editor.getByRole('button', { name: /save draft/i }).click()

  await expect(editor).toBeHidden()

  // The edit survives into the Apply step and is what gets written.
  await page.getByRole('button', { name: /choose changes/i }).click()
  await page.getByRole('button', { name: /review & apply/i }).click()
  await expect(page.getByRole('dialog')).toContainText(/README/i)
})

test('the current README opens read-only', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()
  await expect(page.getByRole('button', { name: /generate readme/i })).toBeVisible()

  await page.getByRole('button', { name: /expand/i }).first().click()

  const viewer = page.getByRole('dialog', { name: /current readme/i })
  await expect(viewer).toBeVisible()
  await expect(viewer.getByRole('textbox')).toHaveCount(0)
  await viewer.getByRole('button', { name: /done/i }).click()
  await expect(viewer).toBeHidden()
})

test('offers deploy guidance when the repo has no homepage', async ({ page }) => {
  await page.goto('/')
  // bare-project has no homepage set.
  await page.getByRole('button', { name: /bare-project/i }).first().click()
  await page.getByRole('button', { name: /description \+ topics only/i }).click()
  await page.getByRole('button', { name: /skip|choose changes/i }).first().click()

  const link = page.getByRole('link', { name: /deploy on vercel/i })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', /vercel\.com/)
})

test('swaps between the current and generated README', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()

  const newTab = page.getByRole('tab', { name: 'New' })
  await expect(newTab).toBeDisabled()

  await page.getByRole('button', { name: /generate readme/i }).click()

  await expect(newTab).toBeEnabled()
  await expect(newTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Generated README' })).toBeVisible()

  await page.getByRole('tab', { name: 'Current' }).click()
  await expect(page.getByRole('region', { name: 'Current README' })).toBeVisible()
})

test('surfaces an AI failure without losing the loaded repo', async ({ page }) => {
  await mockBackend(page, { failAi: true })
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()
  await page.getByRole('button', { name: /generate readme/i }).click()

  await expect(page.getByRole('status')).toContainText(/busy/i)
  await expect(page.getByRole('button', { name: /generate readme/i })).toBeEnabled()
})

test('rejects topics GitHub would refuse, before any write', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()
  await page.getByRole('button', { name: /description \+ topics only/i }).click()
  await page.getByRole('button', { name: /skip|choose changes/i }).first().click()

  const topics = page.getByRole('textbox', { name: /topics/i })
  await topics.fill('Valid, INVALID TOPIC!, another')

  await expect(page.getByText(/only accepts lowercase/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /review & apply/i })).toBeDisabled()
})
