import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Without this, any render-time throw leaves the user staring at a blank page
 * with no way back. Reloading is the one recovery action that always works.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('GitTidy crashed:', error, info.componentStack)
    }
  }

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">GitTidy hit an unexpected error.</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Nothing was written to GitHub. Reloading usually clears it.
        </p>
        <pre className="max-h-40 w-full overflow-auto rounded-xl bg-slate-950/5 p-3 text-left text-xs dark:bg-white/5">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-xl bg-violet-600 px-5 text-sm font-medium text-white"
        >
          Reload GitTidy
        </button>
      </div>
    )
  }
}
