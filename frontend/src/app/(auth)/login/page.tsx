'use client'

// Force dynamic rendering to avoid useSearchParams build issues
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Safe wrapper for useSearchParams during build
function useSearchParamsSafe() {
  try {
    return useSearchParams()
  } catch (error) {
    return null
  }
}
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertCircle, Key } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore, useAuthLoading, useAuthError, useIsAuthenticated } from '@/stores/auth'
import { AuthGuard } from '@/components/auth/auth-guard'
// import { useAutoSaveActions } from '@/stores/auto-save' // Temporarily disabled
// import { MigrationPrompt } from '@/components/auto-save/migration-prompt' // Temporarily disabled
import type { HashLoginRequest } from '@/types/auth'
import { isValidHash, cleanHashInput, formatHashForDisplay } from '@/lib/hash-auth'

const hashLoginSchema = z.object({
  account_hash: z.string()
    .min(1, 'Bookmark hash is required')
    .refine((value) => {
      const cleaned = cleanHashInput(value)
      // Accept both 16-digit numbers and 32-character hex (for migration)
      return isValidHash(value) || /^[0-9a-f]{32}$/.test(cleaned)
    }, {
      message: 'Invalid hash format. Please enter a 16-digit number or 32-character hex hash.',
    }),
})

export default function AccessPage() {
  const router = useRouter()
  const searchParams = useSearchParamsSafe()
  
  // Use proper auth store
  const { loginWithHash, clearError } = useAuthStore()
  const isLoading = useAuthLoading()
  const error = useAuthError()
  const isAuthenticated = useIsAuthenticated()
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('Login page: User already authenticated, redirecting to dashboard')
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])
  // const { preserveWorkForAuthentication } = useAutoSaveActions() // Temporarily disabled
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
    watch
  } = useForm<HashLoginRequest>({
    resolver: zodResolver(hashLoginSchema)
  })

  // Pre-fill hash if redirected from registration
  useEffect(() => {
    if (searchParams) {
      const hashFromUrl = searchParams.get('hash')
      if (hashFromUrl) {
        const formatted = formatHashForDisplay(hashFromUrl)
        setValue('account_hash', formatted)
      }
    }
    
  }, [searchParams, setValue])

  const onSubmit = async (data: HashLoginRequest) => {
    try {
      clearError()
      const cleanedHash = cleanHashInput(data.account_hash)
      
      // Use the auth store's loginWithHash method
      await loginWithHash({ account_hash: cleanedHash })
      
      // Redirect to original page or dashboard
      const redirect = searchParams?.get('redirect')
      if (redirect) {
        router.push(redirect)
      } else {
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string }
      // Error is already handled by the store
      if (error?.status === 401) {
        setError('account_hash', { 
          type: 'manual', 
          message: 'Invalid bookmark hash' 
        })
      }
    }
  }


  const formatHashInput = (value: string) => {
    const cleaned = cleanHashInput(value)
    return formatHashForDisplay(cleaned)
  }

  return (
    <AuthGuard>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
            Return to Your Work
          </CardTitle>
          <CardDescription className="text-center text-gray-600 dark:text-gray-400">
            Enter your bookmark hash to return to saved work or collaborate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {typeof error === 'string' ? error : 'An error occurred during login'}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="account_hash" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Key className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  Bookmark Hash
                </label>
              </div>
              <Input
                id="account_hash"
                type="text"
                placeholder="1234 5678 9012 3456"
                {...register('account_hash', {
                  onChange: (e) => {
                    const formatted = formatHashInput(e.target.value)
                    e.target.value = formatted
                  }
                })}
                className={`font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${errors.account_hash ? 'border-red-500 dark:border-red-400' : ''}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              {errors.account_hash && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.account_hash.message}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Enter your 16-digit bookmark code (spaces will be ignored)
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accessing...
                </>
              ) : (
                'Access Work'
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Don&apos;t have a hash? </span>
              <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
                Generate one
              </Link>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
    </AuthGuard>
  )
}