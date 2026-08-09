import { expect, test, type Page } from '@playwright/test'
import { mockBackend, signIn } from './fixtures'

test.beforeEach(async ({ page }) => {
  await mockBackend(page)
  await signIn(page)
})

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    // A 1px tolerance absorbs sub-pixel rounding.
    return doc.scrollWidth > doc.clientWidth + 1
  })
}

const VIEWPORTS = [
  { name: '320px (smallest phone)', width: 320, height: 640 },
  { name: '375px (iPhone SE)', width: 375, height: 667 },
  { name: '768px (tablet)', width: 768, height: 1024 },
  { name: '1440px (desktop)', width: 1440, height: 900 },
]

for (const viewport of VIEWPORTS) {
  test(`no horizontal scrolling at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')

    expect(await hasHorizontalOverflow(page)).toBe(false)

    await page.getByRole('button', { name: /gittidy/i }).first().click()
    await expect(page.getByRole('button', { name: /generate readme/i })).toBeVisible()
    expect(await hasHorizontalOverflow(page)).toBe(false)

    // A README with a wide table must scroll inside its own pane.
    await page.getByRole('button', { name: /generate readme/i }).click()
    await page.getByRole('button', { name: /choose changes/i }).click()
    expect(await hasHorizontalOverflow(page)).toBe(false)
  })
}

test('the primary action stays reachable without scrolling on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()

  const generate = page.getByRole('button', { name: /generate readme/i })
  await expect(generate).toBeInViewport()

  // Still pinned after scrolling the content underneath it.
  await page.mouse.wheel(0, 2000)
  await expect(generate).toBeInViewport()
})

test('interactive controls meet the 44px touch target minimum', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()
  await expect(page.getByRole('button', { name: /generate readme/i })).toBeVisible()

  const undersized = await page.evaluate(() => {
    const results: string[] = []
    const nodes = document.querySelectorAll('button, a[href], input[type="checkbox"]')

    for (const node of nodes) {
      const box = node.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      // Checkboxes are wrapped in a label that provides the real hit area.
      if (node instanceof HTMLInputElement && node.closest('label')) continue
      // 0.5px tolerance for sub-pixel layout rounding of a 44px target.
      if (box.height < 43.5) {
        results.push(`${node.tagName}:${node.textContent?.trim().slice(0, 24)}=${box.height.toFixed(1)}px`)
      }
    }
    return results
  })

  expect(undersized).toEqual([])
})

test('respects the dark and light preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.emulateMedia({ colorScheme: 'light' })
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('survives localStorage being unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    // Mirrors Safari private mode with strict settings.
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('SecurityError')
      },
    })
  })

  await page.goto('/')
  await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible()
})

test('the OAuth token never remains in the visible URL', async ({ page }) => {
  await page.goto('/#github_token=gho_secret_value')
  await expect(page.getByRole('button', { name: /octocat|github/i }).last()).toBeVisible()

  expect(page.url()).not.toContain('gho_secret_value')
  expect(page.url()).not.toContain('github_token')
})
