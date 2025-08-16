'use client'

import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorStateProps {
  title?: string
  description?: string
  error?: Error | string
  onRetry?: () => void
  showHomeButton?: boolean
}

export function ErrorState({ 
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  error,
  onRetry,
  showHomeButton = false
}: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <CardTitle className="text-xl font-semibold text-gray-900">
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
        {errorMessage && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
            {errorMessage}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          {showHomeButton && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.location.href = '/dashboard'}
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}