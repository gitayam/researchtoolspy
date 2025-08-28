'use client'

import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-gray-600 dark:text-gray-400" />
          </div>
          <CardTitle className="text-xl text-gray-900 dark:text-gray-100">You're Offline</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            It looks like you've lost your internet connection. Some features may not be available.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2 text-gray-900 dark:text-gray-100">You can still:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-900 dark:text-gray-100">
              <li>View cached analysis frameworks</li>
              <li>Work on existing drafts</li>
              <li>Use basic tools offline</li>
            </ul>
          </div>
          
          <div className="pt-4 space-y-2">
            <Button 
              onClick={handleRetry} 
              className="w-full"
              variant="default"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            
            <Button 
              onClick={() => window.history.back()} 
              className="w-full"
              variant="outline"
            >
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}