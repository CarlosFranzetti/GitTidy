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

test('opens in dark mode even when the OS prefers light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('the theme choice persists across reloads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.getByRole('button', { name: /appearance settings/i }).click()
  await page.getByRole('menuitemradio', { name: 'Light' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  // Auto hands control back to the operating system.
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.getByRole('button', { name: /appearance settings/i }).click()
  await page.getByRole('menuitemradio', { name: 'Auto' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('the typeface choice persists across reloads', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /appearance settings/i }).click()
  await page.getByRole('menuitemradio', { name: /outfit/i }).click()

  const fontOf = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim(),
    )

  expect(await fontOf()).toContain('Outfit')
  await page.reload()
  expect(await fontOf()).toContain('Outfit')
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

test('the review step fits within about one phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()
  await expect(page.getByRole('button', { name: /generate readme/i })).toBeVisible()

  const overflow = async () =>
    page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)

  // Before generating there should be nothing to scroll at all.
  expect(await overflow()).toBeLessThanOrEqual(8)

  // After generating, a little scroll is acceptable but not a second screen.
  await page.getByRole('button', { name: /generate readme/i }).click()
  await expect(page.getByRole('button', { name: /choose changes/i })).toBeVisible()
  expect(await overflow()).toBeLessThan(200)
})

test('the README editor takes the whole screen without page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  await page.getByRole('button', { name: /gittidy/i }).first().click()
  await page.getByRole('button', { name: /generate readme/i }).click()
  await page.getByRole('button', { name: /^edit$/i }).first().click()

  const editor = page.getByRole('dialog', { name: /generated readme/i })
  await expect(editor).toBeVisible()

  const box = await editor.boundingBox()
  expect(box?.height).toBeGreaterThan(700)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
})
