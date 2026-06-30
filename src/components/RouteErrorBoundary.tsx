/**
 * RouteErrorBoundary
 *
 * Used as the `errorElement` on React Router v6 routes. Catches errors thrown
 * during rendering, data loading, or actions and shows a branded fallback.
 * Logs to /api/client-error (fire-and-forget) following the same pattern as
 * the existing ErrorBoundary class component.
 */

import { useEffect } from 'react'
import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unexpected error occurred.'
}

function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack?.slice(0, 1500)
  return undefined
}

export function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()

  useEffect(() => {
    // Best-effort report — must never throw
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: getErrorMessage(error),
          source: 'RouteErrorBoundary',
          context: {
            stack: getErrorStack(error),
            url: typeof window !== 'undefined' ? window.location?.href : undefined,
          },
        }),
      }).catch(() => {})
    } catch {
      // ignore — an error reporter must not throw
    }
  }, [error])

  const isDev = import.meta.env.DEV
  const message = getErrorMessage(error)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-xl w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
              <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-3">
            Something went wrong
          </h1>

          {/* User-facing message */}
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            This page encountered an error. Try refreshing, or go back to the dashboard.
          </p>

          {/* Dev-only error detail */}
          {isDev && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 dark:text-red-400 mb-1">
                Error Details (Development Only)
              </p>
              <pre className="text-xs text-red-700 dark:text-red-300 font-mono overflow-x-auto whitespace-pre-wrap break-words">
                {message}
                {getErrorStack(error) ? `\n\n${getErrorStack(error)}` : ''}
              </pre>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh page
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded transition-colors"
            >
              <Home className="h-4 w-4" />
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
