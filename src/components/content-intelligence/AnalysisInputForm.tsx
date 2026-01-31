import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Link2,
  Loader2,
  Search,
  Sparkles,
  ExternalLink,
  AlertCircle,
  GitBranch,
  Video,
  FileText,
} from 'lucide-react'
import {
  useAnalysisStore,
  useAnalysisProcessing,
  useAnalysisData,
  useAnalysisActions,
  useAnalyzeUrl,
  useCountryLookup,
} from '@/hooks/content-intelligence'

interface AnalysisInputFormProps {
  onAnalysisComplete?: () => void
}

// URL type detection patterns
const URL_PATTERNS = {
  socialMedia: /^https?:\/\/(www\.)?(twitter|x|facebook|instagram|tiktok|youtube|linkedin|reddit)\./i,
  gitRepo: /^https?:\/\/(www\.)?(github|gitlab|bitbucket)\./i,
  video: /^https?:\/\/(www\.)?(youtube|vimeo|dailymotion|twitch)\./i,
}

// Social media platform names for display
const SOCIAL_PLATFORMS: Record<string, string> = {
  twitter: 'Twitter/X',
  x: 'Twitter/X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
}

// Git platform names for display
const GIT_PLATFORMS: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
}

type UrlType = 'socialMedia' | 'gitRepo' | 'video' | 'standard'

export function AnalysisInputForm({ onAnalysisComplete }: AnalysisInputFormProps) {
  const { t } = useTranslation()

  // Store selectors for performance
  const { processing, progress, currentStep, status } = useAnalysisProcessing()
  const { url, mode, bypassUrls } = useAnalysisData()
  const { setUrl, setMode, setBypassUrls } = useAnalysisActions()

  // API mutations
  const analyzeUrlMutation = useAnalyzeUrl()
  const countryLookupMutation = useCountryLookup()

  // Local state for input field (allows typing without triggering store updates on every keystroke)
  const [inputValue, setInputValue] = useState(url)

  // Sync input value with store URL
  useEffect(() => {
    setInputValue(url)
  }, [url])

  // Detect URL type for badge display
  const urlType = useMemo((): UrlType => {
    if (!inputValue) return 'standard'
    if (URL_PATTERNS.socialMedia.test(inputValue)) return 'socialMedia'
    if (URL_PATTERNS.gitRepo.test(inputValue)) return 'gitRepo'
    if (URL_PATTERNS.video.test(inputValue)) return 'video'
    return 'standard'
  }, [inputValue])

  // Get platform name for display
  const platformName = useMemo((): string | null => {
    if (!inputValue) return null

    // Check social media
    const socialMatch = inputValue.match(/(twitter|x|facebook|instagram|tiktok|youtube|linkedin|reddit)/i)
    if (socialMatch) {
      return SOCIAL_PLATFORMS[socialMatch[1].toLowerCase()] || socialMatch[1]
    }

    // Check git repos
    const gitMatch = inputValue.match(/(github|gitlab|bitbucket)/i)
    if (gitMatch) {
      return GIT_PLATFORMS[gitMatch[1].toLowerCase()] || gitMatch[1]
    }

    return null
  }, [inputValue])

  // Handle URL input change
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }, [])

  // Handle URL blur - sync to store
  const handleUrlBlur = useCallback(() => {
    setUrl(inputValue)
  }, [inputValue, setUrl])

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: 'quick' | 'normal' | 'full') => {
      setMode(newMode)
    },
    [setMode]
  )

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    const targetUrl = inputValue.trim()
    if (!targetUrl) return

    // Sync URL to store
    setUrl(targetUrl)

    // Generate bypass URLs immediately
    const encoded = encodeURIComponent(targetUrl)
    setBypassUrls({
      '12ft': `https://12ft.io/proxy?q=${encoded}`,
      wayback: `https://web.archive.org/web/*/${targetUrl}`,
      archive_is: `https://archive.is/${targetUrl}`,
    })

    // Trigger analysis
    await analyzeUrlMutation.mutateAsync({ url: targetUrl, mode })

    // Trigger country lookup in background (non-blocking)
    countryLookupMutation.mutate(targetUrl)

    // Callback on completion
    onAnalysisComplete?.()
  }, [inputValue, mode, setUrl, setBypassUrls, analyzeUrlMutation, countryLookupMutation, onAnalysisComplete])

  // Handle enter key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !processing) {
        handleSubmit()
      }
    },
    [processing, handleSubmit]
  )

  // URL type badge component
  const urlTypeBadge = useMemo(() => {
    if (!inputValue || urlType === 'standard') return null

    const badges: Record<Exclude<UrlType, 'standard'>, { icon: typeof Video; label: string; className: string }> = {
      socialMedia: {
        icon: Sparkles,
        label: platformName || 'Social Media',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      },
      gitRepo: {
        icon: GitBranch,
        label: platformName || 'Git Repository',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      },
      video: {
        icon: Video,
        label: platformName || 'Video',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      },
    }

    const config = badges[urlType]
    const Icon = config.icon

    return (
      <Badge variant="outline" className={`${config.className} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }, [inputValue, urlType, platformName])

  // Determine if we should show bypass URLs
  const showBypassUrls = useMemo(() => {
    return status === 'error' && Object.keys(bypassUrls).length > 0
  }, [status, bypassUrls])

  return (
    <div className="space-y-4">
      {/* Input Card */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* URL Input Row */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('pages.contentIntelligence.urlPlaceholder')}
                value={inputValue}
                onChange={handleUrlChange}
                onBlur={handleUrlBlur}
                onKeyDown={handleKeyDown}
                className="pl-10 flex-1"
                disabled={processing}
              />
            </div>
            {urlTypeBadge}
          </div>

          {/* Mode Selection and Analyze Button */}
          <div className="flex gap-2 items-center justify-between flex-wrap">
            <div className="flex gap-2">
              <Button
                variant={mode === 'quick' ? 'default' : 'outline'}
                onClick={() => handleModeChange('quick')}
                size="sm"
                disabled={processing}
              >
                <Search className="h-3 w-3 mr-1" />
                {t('pages.contentIntelligence.modes.quick')}
              </Button>
              <Button
                variant={mode === 'normal' ? 'default' : 'outline'}
                onClick={() => handleModeChange('normal')}
                size="sm"
                disabled={processing}
              >
                {t('pages.contentIntelligence.modes.normal')}
              </Button>
              <Button
                variant={mode === 'full' ? 'default' : 'outline'}
                onClick={() => handleModeChange('full')}
                size="sm"
                disabled={processing}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {t('pages.contentIntelligence.modes.full')}
              </Button>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={processing || !inputValue.trim()}
              data-analyze-button
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('pages.contentIntelligence.analyzing')}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('pages.contentIntelligence.analyzeContent')}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Processing Status Card */}
      {processing && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border-2 border-blue-400 dark:border-blue-600">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-blue-900 dark:text-blue-100">
                  {currentStep || 'Processing...'}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {t('pages.contentIntelligence.processingTime')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {progress}%
                </div>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </Card>
      )}

      {/* Bypass URLs Alert (shown on error) */}
      {showBypassUrls && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p className="font-medium">
              Unable to access the content directly. Try one of these bypass methods:
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(bypassUrls).map(([key, value]) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  asChild
                  className="bg-white dark:bg-gray-900"
                >
                  <a href={value} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {key === '12ft'
                      ? '12ft.io'
                      : key === 'wayback'
                      ? 'Wayback Machine'
                      : key === 'archive_is'
                      ? 'Archive.is'
                      : key}
                  </a>
                </Button>
              ))}
            </div>
            <p className="text-xs opacity-80">
              Copy the content from one of these services and paste it into a new document for analysis.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* URL Type Hint */}
      {urlType !== 'standard' && !processing && (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            {urlType === 'socialMedia' && (
              <>
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span>
                  Social media content detected. Analysis will include engagement metrics and author information.
                </span>
              </>
            )}
            {urlType === 'gitRepo' && (
              <>
                <GitBranch className="h-4 w-4 text-green-600" />
                <span>
                  Git repository detected. Analysis will include code statistics and contributor information.
                </span>
              </>
            )}
            {urlType === 'video' && (
              <>
                <Video className="h-4 w-4 text-red-600" />
                <span>
                  Video content detected. Analysis may include transcript extraction if available.
                </span>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default AnalysisInputForm
