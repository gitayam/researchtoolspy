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

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                ResearchTools
              </span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <LanguageSwitcher />
              <Link to="/login">
                <button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md transition-colors flex items-center gap-2">
                  <Unlock className="h-5 w-5" />
                  {t('landing.accessSavedWork')}
                </button>
              </Link>
              <Link to="/register">
                <button className="border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  {t('landing.createAccount')}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center">
          <div className="mb-6">
            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/20 px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-300">
              🎉 {t('landing.freeForCommunity')}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            <span className="text-blue-600">ResearchTools</span>
            <span className="block text-gray-900 dark:text-white">{t('landing.advancedPlatform')}</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            {t('landing.tagline')} <strong className="text-green-600 dark:text-green-400">{t('landing.freeAndPublic')}</strong> {t('landing.forCommunity')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/dashboard" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto text-lg px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2">
                <Target className="h-6 w-6" />
                {t('landing.browseFrameworks')}
                <ArrowRight className="h-6 w-6" />
              </button>
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
            <Link to="/login">
              <button className="text-base px-6 py-2.5 border-2 border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 font-semibold rounded-lg transition-colors flex items-center gap-2">
                <Unlock className="h-5 w-5" />
                {t('landing.accessSavedWork')}
              </button>
            </Link>
            <Link to="/register">
              <button className="text-base px-6 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-lg transition-colors flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                {t('landing.createAccount')}
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need for Research Analysis
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              From strategic planning to threat assessment, ResearchTools provides the tools
              and frameworks professional analysts trust.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-base text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Frameworks Showcase */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-800/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Professional Analysis Frameworks
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Industry-standard research analysis methodologies at your fingertips
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              "SWOT Analysis",
              "COG Analysis",
              "PMESII-PT",
              "ACH Analysis",
              "DOTMLPF",
              "Deception Detection",
              "Behavioral Analysis",
              "Starbursting",
              "Causeway",
              "DIME Framework"
            ].map((framework, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white text-sm font-bold">{index + 1}</span>
                </div>
                <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {framework}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 rounded-lg p-8 text-center">
            <h2 className="text-3xl font-bold mb-4 text-white">
              Ready to Transform Your Analysis Workflow?
            </h2>
            <p className="text-blue-100 dark:text-blue-200 mb-6 text-lg">
              Browse all 13 frameworks for free • No login required • Optional account to save your work
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/dashboard">
                <button className="text-lg px-8 py-3 bg-white hover:bg-gray-100 text-blue-700 font-bold rounded-lg shadow-md transition-colors flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Browse Frameworks Now
                  <ArrowRight className="h-5 w-5" />
                </button>
              </Link>
              <Link to="/login">
                <button className="text-lg px-8 py-3 border-2 border-white text-white hover:bg-white/10 font-semibold rounded-lg transition-colors flex items-center gap-2">
                  <Unlock className="h-5 w-5" />
                  Access Saved Work
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