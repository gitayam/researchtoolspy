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
import { useAuthStore, useAuthLoading, useAuthError } from '@/stores/auth'
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
  const searchParams = useSearchParams()
  
  // Use proper auth store
  const { loginWithHash, clearError } = useAuthStore()
  const isLoading = useAuthLoading()
  const error = useAuthError()
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
    
  }, [searchParams, setValue])

  const watchedHash = watch('account_hash', '')

  const onSubmit = async (data: HashLoginRequest) => {
    try {
      clearError()
      const cleanedHash = cleanHashInput(data.account_hash)
      
      // Use the auth store's loginWithHash method
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Return to Your Work
          </CardTitle>
          <CardDescription className="text-center">
            Enter your bookmark hash to return to saved work or collaborate
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
                  Bookmark Hash
                </label>
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
              <span className="text-gray-600">Don't have a hash? </span>
              <Link href="/register" className="text-blue-600 hover:underline">
                Generate one
              </Link>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}