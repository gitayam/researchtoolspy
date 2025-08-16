'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<ErrorFallbackProps>
}

interface ErrorFallbackProps {
  error?: Error
  errorInfo?: React.ErrorInfo
  resetError: () => void
}

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => {
  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Something went wrong
          </CardTitle>
          <CardDescription>
            We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDevelopment && error && (
            <details className="rounded-lg bg-gray-100 p-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-700">
                Error Details (Development)
              </summary>
              <div className="mt-2 text-xs text-gray-600">
                <p className="font-medium">{error.name}</p>
                <p className="mt-1">{error.message}</p>
                {error.stack && (
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
          
          <div className="flex flex-col gap-2">
            <Button onClick={resetError} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.location.href = '/dashboard'}
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>

          <div className="text-center">
            <Button 
              variant="link" 
              className="text-sm text-gray-500"
              onClick={() => {
                const body = `Error: ${error?.message || 'Unknown error'}\nUser Agent: ${navigator.userAgent}\nURL: ${window.location.href}`
                window.open(`mailto:support@example.com?subject=ResearchTools Error Report&body=${encodeURIComponent(body)}`)
              }}
            >
              <Bug className="mr-1 h-3 w-3" />
              Report Issue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
      // Here you would typically send to error monitoring service like Sentry
      // Example: Sentry.captureException(error, { extra: errorInfo })
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
        />
      )
    }

    return this.props.children
  }
}

// Hook for functional components to access error boundary functionality
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: string) => {
    console.error('Application Error:', error)
    
    // In a real application, you would send this to an error monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: errorMonitoringService.captureException(error, { extra: { errorInfo } })
    }
    
    // For now, we'll throw the error to trigger the error boundary
    throw error
  }
}

// Higher-order component to wrap components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<ErrorFallbackProps>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

export default ErrorBoundary