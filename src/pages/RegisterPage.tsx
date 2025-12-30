import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { Copy, Check, Bookmark, Share2, Shield, AlertCircle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatHashForDisplay, generateAccountHash } from '@/lib/hash-auth'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [accountHash, setAccountHash] = useState('')
  const [copied, setCopied] = useState(false)
  const [hashSaved, setHashSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Generate hash client-side (Mullvad-style)
  useEffect(() => {
    const hash = generateAccountHash()
    setAccountHash(hash)

    // Immediately add to valid hashes so it can be used for login
    try {
      const validHashesStr = localStorage.getItem('omnicore_valid_hashes')
      const validHashes: string[] = validHashesStr ? JSON.parse(validHashesStr) : []

      if (!validHashes.includes(hash)) {
        validHashes.push(hash)
        localStorage.setItem('omnicore_valid_hashes', JSON.stringify(validHashes))
        console.log('[Register] Hash added to valid hashes:', hash.substring(0, 8) + '...')
      }
    } catch (err) {
      console.error('[Register] Failed to store hash in valid hashes:', err)
    }
  }, [])

  const handleCopyHash = async () => {
    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(accountHash)
      setCopied(true)
      toast({
        title: t('pages.register.copied'),
        description: t('pages.register.copiedDesc')
      })
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      // Fallback to legacy method
      try {
        const textArea = document.createElement('textarea')
        textArea.value = accountHash
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (successful) {
          setCopied(true)
          toast({
            title: t('pages.register.copied'),
            description: t('pages.register.copiedDesc')
          })
          setTimeout(() => setCopied(false), 3000)
        } else {
          throw new Error('Copy command failed')
        }
      } catch (fallbackErr) {
        console.error('Failed to copy:', fallbackErr)
        toast({
          title: t('pages.register.copyFailed'),
          description: t('pages.register.copyFailedDesc'),
          variant: 'destructive'
        })
      }
    }
  }

  const handleGenerateNew = () => {
    setCopied(false)
    setHashSaved(false)
    const hash = generateAccountHash()
    setAccountHash(hash)
  }

  const handleSaveAndContinue = () => {
    // Store the generated hash in localStorage as a valid hash
    try {
      const validHashes = JSON.parse(localStorage.getItem('omnicore_valid_hashes') || '[]')
      if (!validHashes.includes(accountHash)) {
        validHashes.push(accountHash)
        localStorage.setItem('omnicore_valid_hashes', JSON.stringify(validHashes))
      }

      // Also store as the current user's hash for auto-login
      localStorage.setItem('omnicore_user_hash', accountHash)

      setHashSaved(true)

      // Redirect to login with the hash pre-filled
      setTimeout(() => {
        navigate(`/login?hash=${accountHash}`)
      }, 1500)
    } catch (error) {
      // Failed to save - fallback to redirect to login
      setHashSaved(true)
      setTimeout(() => {
        navigate('/login')
      }, 1500)
    }
  }

  const formattedHash = formatHashForDisplay(accountHash)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Bookmark className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t('pages.register.title')}
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            {t('pages.register.subtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!hashSaved ? (
            <>
              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* CRITICAL WARNING - TOP OF PAGE */}
              <div className="bg-red-100 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-600 rounded-lg p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="animate-bounce">
                    <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400 flex-shrink-0" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-lg font-bold text-red-900 dark:text-red-100">
                      {'⚠️ '}{t('pages.register.criticalWarning')}
                    </h3>
                    <div className="space-y-1.5">
                      <p className="text-base text-red-800 dark:text-red-200 font-semibold">
                        {t('pages.register.onlyWay')}
                      </p>
                      <p className="text-base text-red-800 dark:text-red-200">
                        <strong className="text-red-900 dark:text-red-100">{t('pages.register.noRecovery')}</strong> {t('pages.register.noRecoveryDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hash Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('pages.register.yourBookmarkCode')}
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {loading ? t('pages.register.generating') : accountHash ? t('pages.register.clickCopy') + ' →' : t('pages.register.readyToGenerate')}
                  </span>
                </div>
                <div className="relative">
                  <div className="bg-gray-50 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-md p-4 font-mono text-base break-all text-gray-900 dark:text-gray-100 min-h-[60px] flex items-center">
                    {loading ? t('pages.register.generatingFromServer') : accountHash ? formattedHash : t('pages.register.failedToGenerate')}
                  </div>
                </div>
                {accountHash && (
                  <Button
                    type="button"
                    onClick={handleCopyHash}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-base"
                    size="lg"
                  >
                    {copied ? (
                      <>
                        <Check className="h-5 w-5 mr-2 text-green-300" />
                        {t('pages.register.copiedToClipboard')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-5 w-5 mr-2" />
                        {t('pages.register.copyHash')}
                      </>
                    )}
                  </Button>
                )}
                {copied && (
                  <p className="text-sm text-green-600 dark:text-green-400 font-semibold text-center">
                    {'✓'} {t('pages.register.hashCopied')}
                  </p>
                )}
              </div>

              {/* What This Is */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {t('pages.register.whatIsThis')}
                </h3>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-start gap-2">
                    <Bookmark className="h-4 w-4 mt-0.5 text-blue-500" />
                    <span>{t('pages.register.bookmarkDesc')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Share2 className="h-4 w-4 mt-0.5 text-green-500" />
                    <span>{t('pages.register.collaborationDesc')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 mt-0.5 text-purple-500" />
                    <span>{t('pages.register.noPersonalData')}</span>
                  </div>
                </div>
              </div>

              {/* Final Warning */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium text-center">
                  {'🚫'} {t('pages.register.finalWarning')}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleGenerateNew}
                  variant="outline"
                  disabled={loading}
                  className="w-full border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? t('pages.register.generating') : t('pages.register.generateNew')}
                </Button>

                <Button
                  onClick={handleSaveAndContinue}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!copied || loading || !accountHash}
                >
                  {copied && accountHash ? t('pages.register.iveSavedContinue') : loading ? t('pages.register.generatingHash') : t('pages.register.copyHashFirst')}
                </Button>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {t('pages.register.hashSaved')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('pages.register.redirecting')}
                </p>
              </div>
            </div>
          )}

          {/* Access Link */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('pages.register.alreadyHaveHash')}{' '}
            <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
              {t('pages.register.accessWork')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}