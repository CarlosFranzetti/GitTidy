import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/error-boundary'
import { applyFont, resolveFont } from './lib/fonts'
import { readStored } from './lib/storage'
import { applyTheme, resolveTheme } from './lib/theme'

// Applied before the first paint so the page never flashes the wrong theme.
applyTheme(resolveTheme(readStored('gittidy.theme')))
applyFont(resolveFont(readStored('gittidy.font')))

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
        <Analytics />
      </ErrorBoundary>
    </StrictMode>,
  )
}
