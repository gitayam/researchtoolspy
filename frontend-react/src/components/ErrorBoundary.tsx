import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We encountered an error. Please refresh the page or try again later.
            </p>
            {this.state.error && (
              <details className="text-sm text-gray-500 dark:text-gray-500">
                <summary className="cursor-pointer font-medium mb-2">Error details</summary>
                <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}