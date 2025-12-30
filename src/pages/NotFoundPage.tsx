import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-700">404</h1>
        <div className="mt-4 space-y-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('pages.notFound.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {t('pages.notFound.description')}
          </p>
          <div className="flex gap-4 justify-center mt-8">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('pages.notFound.goBack')}
            </Button>
            <Button asChild>
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                {t('pages.notFound.goHome')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
