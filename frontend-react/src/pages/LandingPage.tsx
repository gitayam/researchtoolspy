import { useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, Brain, Sparkles, Zap, Users, BarChart3, Target, Unlock, KeyRound } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTranslation } from 'react-i18next'

export function LandingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Check if authenticated - placeholder for now
  const isAuthenticated = false

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

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
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded bg-blue-600 flex items-center justify-center">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
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
                  <span className="md:hidden">Login</span>
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

      {/* Hero Section - Enhanced mobile typography and touch targets */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center">
          <div className="mb-4 sm:mb-6">
            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/20 px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-medium text-blue-800 dark:text-blue-300">
              🎉 {t('landing.freeForCommunity')}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 px-4">
            <span className="text-blue-600 dark:text-blue-500">ResearchTools</span>
            <span className="block mt-2 text-gray-900 dark:text-white">{t('landing.advancedPlatform')}</span>
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-3xl mx-auto px-4">
            {t('landing.tagline')} <strong className="text-green-600 dark:text-green-400">{t('landing.freeAndPublic')}</strong> {t('landing.forCommunity')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center px-4">
            <Link to="/dashboard" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100 transition-all flex items-center justify-center gap-2 min-h-[3rem]">
                <Target className="h-5 w-5 sm:h-6 sm:w-6" />
                <span>{t('landing.browseFrameworks')}</span>
                <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4 sm:mt-5 px-4">
            <Link to="/login" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto text-sm sm:text-base px-6 sm:px-7 py-3 sm:py-3 border-2 border-green-600 dark:border-green-500 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 active:bg-green-100 dark:active:bg-green-900/30 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[2.75rem]">
                <Unlock className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>{t('landing.accessSavedWork')}</span>
              </button>
            </Link>
            <Link to="/register" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto text-sm sm:text-base px-6 sm:px-7 py-3 sm:py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[2.75rem]">
                <KeyRound className="h-4 w-4" />
                <span>{t('landing.createAccount')}</span>
              </button>
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
              t('frameworks.swot'),
              t('frameworks.cog'),
              t('frameworks.pmesiipt'),
              t('frameworks.ach'),
              t('frameworks.dotmlpf'),
              t('frameworks.deception'),
              t('frameworks.behavior'),
              t('frameworks.starbursting'),
              t('frameworks.causeway'),
              t('frameworks.dime')
            ].map((framework, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white text-xs sm:text-sm font-bold">{index + 1}</span>
                </div>
                <h3 className="font-medium text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                  {framework}
                </h3>
              </div>
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
            <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">ResearchTools</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Research Analysis Platform • Free for IrregularChat Community
          </p>
        </div>
      </footer>
    </div>
  )
}