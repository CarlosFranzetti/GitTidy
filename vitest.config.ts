import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Test files sit outside tsconfig.app.json (which covers the production
  // build only), so the JSX runtime is declared here rather than inherited.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // Playwright specs live in e2e/ and are run by `npm run test:e2e`.
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}', 'api/**/*.ts'],
      exclude: ['src/main.tsx', 'src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    },
  },
})
