'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check, Bookmark, Share2, Shield, AlertCircle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { generateBookmarkHash, formatHashForDisplay } from '@/lib/hash-auth'

export default function RegisterPage() {
  const router = useRouter()
  const [accountHash, setAccountHash] = useState(() => generateBookmarkHash())
  const [copied, setCopied] = useState(false)
  const [hashSaved, setHashSaved] = useState(false)

  const handleCopyHash = async () => {
    try {
      await navigator.clipboard.writeText(accountHash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Failed to copy - continue silently
    }
  }

  const handleGenerateNew = () => {
    setAccountHash(generateBookmarkHash())
    setCopied(false)
    setHashSaved(false)
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
        router.push(`/login?hash=${accountHash}`)
      }, 1500)
    } catch (error) {
      // Failed to save - fallback to redirect to login
      setHashSaved(true)
      setTimeout(() => {
        router.push('/login')
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
            Generate Bookmark Code
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Save your work and collaborate with this unique code
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!hashSaved ? (
            <>
              {/* Hash Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Your Bookmark Code
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Click the copy button →
                  </span>
                </div>
                <div className="relative">
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md p-3 font-mono text-sm break-all">
                    {formattedHash}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyHash}
                    className="absolute right-2 top-2 h-6 w-6 p-0"
                    title={copied ? "Copied!" : "Copy hash to clipboard"}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                {copied && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    ✓ Hash copied! Now save it in your password manager.
                  </p>
                )}
              </div>

              {/* Important Notice */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <h3 className="font-medium text-amber-800 dark:text-amber-200">
                      ⚠️ Critical: Save This Hash Now
                    </h3>
                    <div className="space-y-1">
                      <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                        This is your ONLY way to access saved analyses.
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        <strong>No recovery possible</strong> if lost. Save in a password manager immediately.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* What This Is */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  What is this hash?
                </h3>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-start gap-2">
                    <Bookmark className="h-4 w-4 mt-0.5 text-blue-500" />
                    <span>A <strong>bookmark</strong> to return to your saved analyses</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Share2 className="h-4 w-4 mt-0.5 text-green-500" />
                    <span>A <strong>collaboration key</strong> to share reports with others</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 mt-0.5 text-purple-500" />
                    <span><strong>No personal data</strong> required or stored</span>
                  </div>
                </div>
              </div>

              {/* Final Warning */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium text-center">
                  🚫 NO RECOVERY • LOST CODE = LOST WORK • SAVE THIS CODE
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleGenerateNew}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate New Hash
                </Button>
                
                <Button
                  onClick={handleSaveAndContinue}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!copied}
                >
                  {copied ? "✓ I've Saved My Hash - Continue" : "Copy Hash First"}
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
                  Hash Saved!
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Redirecting to access page...
                </p>
              </div>
            </div>
          )}

          {/* Access Link */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            Already have a hash?{' '}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
              Access Work
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}