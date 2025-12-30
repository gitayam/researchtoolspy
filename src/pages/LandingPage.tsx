import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, Brain, Sparkles, Zap, Users, BarChart3, Target, Unlock, KeyRound, Search, Link2, Loader2 } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if authenticated - placeholder for now
  const isAuthenticated = false

  // URL analysis state
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [detectedFramework, setDetectedFramework] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const isValidUrl = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString)

      // Check if protocol is http or https
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return false
      }

      // Check if hostname has at least one dot (e.g., example.com) or is localhost
      const hostname = urlObj.hostname
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return true
      }

      // Check for IP address pattern
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
      if (ipPattern.test(hostname)) {
        return true
      }

      // Hostname must have at least one dot and valid TLD
      if (!hostname.includes('.')) {
        return false
      }

      // Check for valid domain structure (at least domain.tld)
      const parts = hostname.split('.')
      if (parts.length < 2) {
        return false
      }

      // Check that TLD is at least 2 characters
      const tld = parts[parts.length - 1]
      if (tld.length < 2) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  // Framework keyword detection with regex
  const detectFramework = (input: string): { route: string; name: string } | null => {
    const trimmedInput = input.trim().toLowerCase()

    // Framework patterns (case-insensitive)
    const frameworkPatterns: Array<{ pattern: RegExp; route: string; name: string }> = [
      { pattern: /^swot(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/swot-dashboard', name: 'SWOT' },
      { pattern: /^ach(\s+analysis)?(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/ach-dashboard', name: 'ACH' },
      { pattern: /^cog(\s+analysis)?(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/cog', name: 'COG' },
      { pattern: /^pmesii(-|\s)?pt(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/pmesii-pt', name: 'PMESII-PT' },
      { pattern: /^dotmlpf(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/dotmlpf', name: 'DOTMLPF' },
      { pattern: /^dime(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/dime', name: 'DIME' },
      { pattern: /^pest(\s+analysis)?(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/pest', name: 'PEST' },
      { pattern: /^deception(\s+analysis)?(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/deception', name: 'Deception' },
      { pattern: /^behavior(\s+analysis)?(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/behavior', name: 'Behavior' },
      { pattern: /^com(-|\s)?b(\s+analysis)?(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/comb-analysis', name: 'COM-B' },
      { pattern: /^starbursting(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/starbursting', name: 'Starbursting' },
      { pattern: /^causeway(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/causeway', name: 'Causeway' },
      { pattern: /^stakeholder(\s+analysis)?(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/stakeholder', name: 'Stakeholder' },
      { pattern: /^surveillance(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/surveillance', name: 'Surveillance' },
      { pattern: /^fundamental(\s+|-)?flow(\s+framework)?$/i, route: '/dashboard/analysis-frameworks/fundamental-flow', name: 'Fundamental Flow' },
    ]

    for (const { pattern, route, name } of frameworkPatterns) {
      if (pattern.test(trimmedInput)) {
        return { route, name }
      }
    }

    return null
  }

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setUrlError(t('landing.pleaseEnterUrl'))
      return
    }

    // Check if input is a framework keyword
    const framework = detectFramework(url)
    if (framework) {
      setUrlError('')
      setAnalyzing(true)
      navigate(framework.route)
      return
    }

    // Validate URL format
    if (!isValidUrl(url.trim())) {
      setUrlError(t('landing.invalidUrl'))
      return
    }

    // Clear error and proceed
    setUrlError('')
    setAnalyzing(true)

    // Store URL in localStorage for Content Intelligence page to pick up
    localStorage.setItem('pending_url_analysis', url)

    // Navigate to Content Intelligence page
    navigate('/dashboard/tools/content-intelligence')
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUrl(value)

    // Clear error when user starts typing
    if (urlError) {
      setUrlError('')
    }

    // Detect framework as user types
    const framework = detectFramework(value)
    setDetectedFramework(framework ? framework.name : null)
  }

  const features = useMemo(() => [
    {
      icon: Brain,
      title: t('landing.analysisFrameworks'),
      description: t('landing.frameworksDesc')
    },
    {
      icon: Zap,
      title: t('landing.aiPoweredInsights'),
      description: t('landing.aiDesc')
    },
    {
      icon: BarChart3,
      title: t('landing.researchToolsTitle'),
      description: t('landing.researchToolsDesc')
    },
    {
      icon: Users,
      title: t('landing.collaborationTitle'),
      description: t('landing.collaborationDesc')
    },
    {
      icon: Sparkles,
      title: t('landing.publicAndFree'),
      description: t('landing.publicDesc')
    },
    {
      icon: Target,
      title: t('landing.exportReporting'),
      description: t('landing.exportDesc')
    }
  ], [t])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Public Access Banner */}
      <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
        <div className="container mx-auto px-4 py-3 text-center">
          <p className="text-green-800 dark:text-green-300 font-medium text-sm sm:text-base">
            ✨ {t('landing.publicBanner')}
          </p>
        </div>
      </div>

      {/* Header - Improved mobile responsiveness */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="ResearchTools Logo" className="h-8 w-8 sm:h-10 sm:w-10 rounded" />
              <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                ResearchTools
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
              <ThemeToggle />
              <LanguageSwitcher />
              <Link to="/login" className="hidden sm:block">
                <button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 sm:px-6 sm:py-2.5 rounded-lg shadow-md transition-colors flex items-center gap-2 text-sm sm:text-base">
                  <Unlock className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden md:inline">{t('landing.accessSavedWork')}</span>
                  <span className="md:hidden">{t('landing.login')}</span>
                </button>
              </Link>
              <Link to="/register" className="hidden md:block">
                <button className="border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium px-4 py-2.5 sm:px-6 sm:py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm sm:text-base">
                  <KeyRound className="h-4 w-4" />
                  {t('landing.createAccount')}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Google-style minimalist */}
      <section className="min-h-[70vh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl mx-auto text-center space-y-8">
          {/* Logo and Title */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white">
              <span className="text-blue-600 dark:text-blue-500">ResearchTools</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400">
              {t('landing.researchAnalysisPlatform')}
            </p>
          </div>

          {/* URL Input - Google-style search box */}
          <div className="w-full max-w-2xl mx-auto">
            <div className={`bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-shadow border ${
              urlError ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex items-center px-5 py-3">
                <Search className={`h-5 w-5 mr-3 flex-shrink-0 ${urlError ? 'text-red-500' : 'text-gray-400'}`} />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={t('landing.urlPlaceholder')}
                  value={url}
                  onChange={handleUrlChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  className="flex-1 border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                  disabled={analyzing}
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={!url.trim() || analyzing}
                  className="ml-3 rounded-full bg-blue-600 hover:bg-blue-700 px-6"
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('landing.analyze')
                  )}
                </Button>
              </div>
            </div>

            {/* Error message display */}
            {urlError && (
              <div className="mt-3 flex items-start gap-2 text-red-600 dark:text-red-400 text-sm px-2">
                <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">{urlError}</span>
              </div>
            )}

            {/* Framework detected hint */}
            {!urlError && detectedFramework && (
              <div className="mt-3 flex items-start gap-2 text-blue-600 dark:text-blue-400 text-sm px-2 animate-in fade-in duration-200">
                <Brain className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span className="font-medium">
                  {t('landing.frameworkDetected', { framework: detectedFramework })}
                </span>
              </div>
            )}
          </div>

          {/* One-line framework callout */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Target className="h-4 w-4 text-blue-600" />
            <span>
              {t('landing.frameworkLinks')}
            </span>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1">
              <Brain className="h-4 w-4" />
              {t('landing.browseFrameworks')}
            </Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link to="/login" className="text-green-600 hover:text-green-700 dark:text-green-400 font-medium flex items-center gap-1">
              <Unlock className="h-4 w-4" />
              {t('landing.accessSavedWork')}
            </Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link to="/register" className="text-gray-600 hover:text-gray-700 dark:text-gray-400 font-medium flex items-center gap-1">
              <KeyRound className="h-4 w-4" />
              {t('landing.createAccount')}
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid - Optimized for mobile */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-8 sm:mb-12 px-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              {t('landing.everythingYouNeed')}
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('landing.providesTools')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-5 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                  <feature.icon className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Frameworks Showcase - Improved mobile grid */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-800/50">
        <div className="container mx-auto">
          <div className="text-center mb-8 sm:mb-12 px-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              {t('landing.professionalFrameworks')}
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
              {t('landing.industryStandard')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {[
              { name: t('frameworks.swot'), route: '/dashboard/analysis-frameworks/swot-dashboard' },
              { name: t('frameworks.cog'), route: '/dashboard/analysis-frameworks/cog' },
              { name: t('frameworks.pmesiipt'), route: '/dashboard/analysis-frameworks/pmesii-pt' },
              { name: t('frameworks.ach'), route: '/dashboard/analysis-frameworks/ach-dashboard' },
              { name: t('frameworks.dotmlpf'), route: '/dashboard/analysis-frameworks/dotmlpf' },
              { name: t('frameworks.deception'), route: '/dashboard/analysis-frameworks/deception' },
              { name: t('frameworks.behavior'), route: '/dashboard/analysis-frameworks/behavior' },
              { name: t('frameworks.starbursting'), route: '/dashboard/analysis-frameworks/starbursting' },
              { name: t('frameworks.causeway'), route: '/dashboard/analysis-frameworks/causeway' },
              { name: t('frameworks.dime'), route: '/dashboard/analysis-frameworks/dime' }
            ].map((framework, index) => (
              <Link
                key={index}
                to={framework.route}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 text-center shadow-sm hover:shadow-md hover:border-blue-500 dark:hover:border-blue-400 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white text-xs sm:text-sm font-bold">{index + 1}</span>
                </div>
                <h3 className="font-medium text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                  {framework.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Enhanced for mobile */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 rounded-lg p-6 sm:p-8 lg:p-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-white px-4">
              {t('landing.readyToTransform')}
            </h2>
            <p className="text-blue-100 dark:text-blue-200 mb-6 sm:mb-8 text-base sm:text-lg px-4">
              {t('landing.browseAllFrameworks')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Link to="/dashboard" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto text-base sm:text-lg px-8 py-3.5 sm:py-4 bg-white hover:bg-gray-100 active:bg-gray-200 text-blue-700 font-bold rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 min-h-[3rem]">
                  <Target className="h-5 w-5" />
                  <span>{t('landing.browseNow')}</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto text-base sm:text-lg px-8 py-3.5 sm:py-4 border-2 border-white text-white hover:bg-white/10 active:bg-white/20 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[3rem]">
                  <Unlock className="h-5 w-5" />
                  <span>{t('landing.accessSaved')}</span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo.png" alt="ResearchTools Logo" className="h-6 w-6 rounded" />
            <span className="font-bold text-gray-900 dark:text-white">ResearchTools</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            {t('landing.footerTagline')}
          </p>
        </div>
      </footer>
    </div>
  )
}