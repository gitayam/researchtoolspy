import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types/auth'

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithOidc } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check for error from backend OIDC callback
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(errorParam)
      return
    }

    const token = searchParams.get('token')
    const userParam = searchParams.get('user')
    const rawRedirect = searchParams.get('redirect') || '/dashboard'
    // Prevent open redirect: only allow relative paths starting with /
    const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/dashboard'

    if (!token || !userParam) {
      setError(
        'Missing authentication parameters. The SSO authentication may have failed or the link is invalid.'
      )
      return
    }

    try {
      // Decode base64url-encoded user JSON (reverse URL-safe base64)
      const b64 = userParam.replace(/-/g, '+').replace(/_/g, '/')
      const userJson = atob(b64)
      const userData: User = JSON.parse(userJson)

      // Validate minimum required fields
      if (!userData.id) {
        setError('Invalid user data received from SSO provider.')
        return
      }

      // Store credentials and update auth state via Zustand
      loginWithOidc(token, userData)

      // Scrub token from URL before navigating (prevents leaks via history/Referer)
      window.history.replaceState({}, '', '/auth/callback')

      // Redirect to dashboard (or original destination)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      console.error('Failed to process SSO callback:', err)
      setError(
        'Failed to process the authentication response. Please try again.'
      )
    }
  }, [searchParams, navigate, loginWithOidc])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-center text-gray-900 dark:text-gray-100">
              Authentication Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Back to Access Page
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state while processing the callback
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Completing authentication...
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Please wait while we verify your credentials.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default AuthCallbackPage
