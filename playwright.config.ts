import { existsSync, readdirSync } from 'node:fs'
import { defineConfig, devices, type Project } from '@playwright/test'

const PORT = 4173

/**
 * Some environments ship a pre-installed Chromium whose build number does not
 * match the pinned @playwright/test. Pointing at it directly avoids a download
 * and keeps the suite runnable; elsewhere Playwright resolves its own browser.
 */
const SYSTEM_CHROMIUM = '/opt/pw-browsers/chromium'
const chromiumLaunch = existsSync(SYSTEM_CHROMIUM)
  ? { launchOptions: { executablePath: SYSTEM_CHROMIUM } }
  : {}

/**
 * Firefox and WebKit need `npx playwright install firefox webkit`. Sandboxes
 * that cannot download them would otherwise fail the whole run, so their
 * projects are dropped when the engine is absent. CI installs all three and
 * gets the full matrix.
 */
function isInstalled(engine: 'firefox' | 'webkit'): boolean {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || ''
  if (!root || !existsSync(root)) return true

  try {
    return readdirSync(root).some((entry) => entry.startsWith(engine))
  } catch {
    return false
  }
}

const chromiumProjects: Project[] = [
  {
    name: 'chromium-desktop',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 },
      ...chromiumLaunch,
    },
  },
  {
    name: 'chromium-mobile',
    // 375x667 is the narrowest mainstream phone still in wide use. The device
    // preset defaults to WebKit, so the engine is pinned explicitly.
    use: { ...devices['iPhone SE'], browserName: 'chromium', ...chromiumLaunch },
  },
  {
    name: 'chromium-tablet',
    use: { ...devices['Galaxy Tab S4'], browserName: 'chromium', ...chromiumLaunch },
  },
]

const firefoxProjects: Project[] = isInstalled('firefox')
  ? [{ name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } }]
  : []

const webkitProjects: Project[] = isInstalled('webkit')
  ? [
      { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
      { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
    ]
  : []

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [...chromiumProjects, ...firefoxProjects, ...webkitProjects],
})
