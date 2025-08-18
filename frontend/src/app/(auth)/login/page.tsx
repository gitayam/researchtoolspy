'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertCircle, Key, Copy, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// import { useAuthStore } from '@/stores/auth' // Temporarily disabled
// import { useAutoSaveActions } from '@/stores/auto-save' // Temporarily disabled
// import { MigrationPrompt } from '@/components/auto-save/migration-prompt' // Temporarily disabled
import type { HashLoginRequest } from '@/types/auth'
import { isValidHash, cleanHashInput, formatHashForDisplay, TEST_ACCOUNT_HASH_FORMATTED, TEST_ACCOUNT_HASH } from '@/lib/hash-auth'

const hashLoginSchema = z.object({
  account_hash: z.string()
    .min(1, 'Account hash is required')
    .refine((value) => isValidHash(value), {
      message: 'Invalid account hash format. Please enter a 16-digit account number.',
    }),
})

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Hash-based authentication with localStorage
  const [isLoading, setIsLoading] = useState(false)
  const [error, setAuthError] = useState<string | null>(null)
  const clearError = () => setAuthError(null)
  const loginWithHash = async (credentials: HashLoginRequest) => {
    setIsLoading(true)
    setAuthError(null)
    
    try {
      const cleanedHash = cleanHashInput(credentials.account_hash)
      
      // Check if hash is valid by looking in localStorage
      const validHashes = JSON.parse(localStorage.getItem('omnicore_valid_hashes') || '[]')
      
      if (validHashes.includes(cleanedHash)) {
        // Valid hash - store as current user and redirect
        localStorage.setItem('omnicore_user_hash', cleanedHash)
        localStorage.setItem('omnicore_authenticated', 'true')
        
        setTimeout(() => {
          setIsLoading(false)
          router.push('/dashboard')
        }, 1000)
      } else {
        // Invalid hash
        setIsLoading(false)
        setAuthError('Invalid hash. Please check your hash and try again.')
      }
    } catch (err) {
      setIsLoading(false)
      setAuthError('Login failed. Please check your hash format.')
    }
  }
  // const { preserveWorkForAuthentication } = useAutoSaveActions() // Temporarily disabled
  const [copied, setCopied] = useState(false)
  
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
    const hashFromUrl = searchParams.get('hash')
    if (hashFromUrl) {
      const formatted = formatHashForDisplay(hashFromUrl)
      setValue('account_hash', formatted)
    }
    
    // Ensure test hash is always available in localStorage
    const validHashes = JSON.parse(localStorage.getItem('omnicore_valid_hashes') || '[]')
    if (!validHashes.includes(TEST_ACCOUNT_HASH)) {
      validHashes.push(TEST_ACCOUNT_HASH)
      localStorage.setItem('omnicore_valid_hashes', JSON.stringify(validHashes))
    }
  }, [searchParams, setValue])

  const watchedHash = watch('account_hash', '')

  const onSubmit = async (data: HashLoginRequest) => {
    try {
      clearError()
      const cleanedHash = cleanHashInput(data.account_hash)
      await loginWithHash({ account_hash: cleanedHash })
      
      // Redirect to original page or dashboard
      const redirect = searchParams.get('redirect')
      if (redirect) {
        router.push(redirect)
      } else {
        router.push('/dashboard')
      }
    } catch (error: any) {
      // Error is already handled by the store
      if (error?.status === 401) {
        setError('account_hash', { 
          type: 'manual', 
          message: 'Invalid account hash' 
        })
      }
    }
  }

  const copyTestHash = async () => {
    try {
      await navigator.clipboard.writeText(TEST_ACCOUNT_HASH_FORMATTED)
      setValue('account_hash', TEST_ACCOUNT_HASH_FORMATTED)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      setValue('account_hash', TEST_ACCOUNT_HASH_FORMATTED)
    }
  }

  const formatHashInput = (value: string) => {
    const cleaned = cleanHashInput(value)
    return formatHashForDisplay(cleaned)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Access Your Analyses
          </CardTitle>
          <CardDescription className="text-center">
            Enter your analysis hash to access saved reports and collaborate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="account_hash" className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Account Hash
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyTestHash}
                  className="text-xs h-auto p-1 text-blue-600 hover:text-blue-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Use Test Hash
                    </>
                  )}
                </Button>
              </div>
              <Input
                id="account_hash"
                type="text"
                placeholder="1234 5678 9012 3456"
                {...register('account_hash')}
                className={`font-mono ${errors.account_hash ? 'border-red-500' : ''}`}
                onChange={(e) => {
                  const formatted = formatHashInput(e.target.value)
                  e.target.value = formatted
                  register('account_hash').onChange(e)
                }}
              />
              {errors.account_hash && (
                <p className="text-sm text-red-600">{errors.account_hash.message}</p>
              )}
              <p className="text-xs text-gray-500">
                Enter your 16-digit account number (spaces will be ignored)
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
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-gray-600">Don't have a hash? </span>
              <Link href="/register" className="text-blue-600 hover:underline">
                Generate one
              </Link>
            </div>

            <div className="text-center">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                  Test Account Hash:
                </p>
                <p className="text-xs font-mono text-blue-800 dark:text-blue-200 bg-white dark:bg-gray-800 px-2 py-1 rounded">
                  {TEST_ACCOUNT_HASH_FORMATTED}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Click "Use Test Hash" or copy the hash above
                </p>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}