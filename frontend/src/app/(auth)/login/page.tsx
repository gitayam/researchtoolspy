'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertCircle, Key, Copy, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth'
import type { HashLoginRequest } from '@/types/auth'
import { isValidHash, cleanHashInput, formatHashForDisplay, TEST_ACCOUNT_HASH_FORMATTED } from '@/lib/hash-auth'

const hashLoginSchema = z.object({
  account_hash: z.string()
    .min(1, 'Account hash is required')
    .refine((value) => isValidHash(value), {
      message: 'Invalid account hash format. Please enter a 32-character hexadecimal hash.',
    }),
})

export default function LoginPage() {
  const router = useRouter()
  const { loginWithHash, isLoading, error, clearError } = useAuthStore()
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

  const watchedHash = watch('account_hash', '')

  const onSubmit = async (data: HashLoginRequest) => {
    try {
      clearError()
      const cleanedHash = cleanHashInput(data.account_hash)
      await loginWithHash({ account_hash: cleanedHash })
      router.push('/dashboard')
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
            Welcome to ResearchTools
          </CardTitle>
          <CardDescription className="text-center">
            Research Analysis Platform • Free for IrregularChat Community
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
                placeholder="1234 5678 9012 3456 abcd efgh ijkl mnop"
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
                Enter your 32-character account hash (spaces will be ignored)
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
              <span className="text-gray-600">Don't have an account? </span>
              <Link href="/register" className="text-blue-600 hover:underline">
                Sign up
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