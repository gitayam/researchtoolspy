import { useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertCircle, Key } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore, useAuthLoading, useAuthError } from '@/stores/auth'
import type { HashLoginRequest } from '@/types/auth'
import { isValidHash, cleanHashInput, formatHashForDisplay } from '@/lib/hash-auth'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Use proper auth store
  const { loginWithHash, clearError } = useAuthStore()
  const isLoading = useAuthLoading()
  const error = useAuthError()

  const hashLoginSchema = z.object({
    account_hash: z.string()
      .min(1, t('auth.hashRequired'))
      .refine((value) => {
        const cleaned = cleanHashInput(value)
        // Accept both 16-digit numbers and 32-character hex (for migration)
        return isValidHash(value) || /^[0-9a-f]{32}$/.test(cleaned)
      }, {
        message: t('auth.invalidHashFormat'),
      }),
  })

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

  // const watchedHash = watch('account_hash', '')

  const onSubmit = async (data: HashLoginRequest) => {
    try {
      clearError()
      const cleanedHash = cleanHashInput(data.account_hash)

      // Use the auth store's loginWithHash method
      await loginWithHash({ account_hash: cleanedHash })

      // Redirect to original page or dashboard
      const redirect = searchParams.get('redirect')
      if (redirect) {
        navigate(redirect)
      } else {
        navigate('/dashboard')
      }
    } catch (error: any) {
      // Error is already handled by the store
      if (error?.status === 401) {
        setError('account_hash', {
          type: 'manual',
          message: t('auth.invalidHash')
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
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
            {t('auth.returnToWork')}
          </CardTitle>
          <CardDescription className="text-center text-gray-600 dark:text-gray-400">
            {t('auth.returnToWorkDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {typeof error === 'string' ? error : t('auth.loginError')}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="account_hash" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Key className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('auth.bookmarkHash')}
                </label>
              </div>
              <Input
                id="account_hash"
                type="text"
                placeholder={t('auth.hashPlaceholder')}
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
                {t('auth.hashHelperText')}
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
                  {t('auth.accessing')}
                </>
              ) : (
                t('auth.accessWork')
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t('auth.noHash')} </span>
              <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('auth.generateHash')}
              </Link>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}