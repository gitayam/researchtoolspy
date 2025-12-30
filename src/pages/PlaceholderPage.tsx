import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'

interface PlaceholderPageProps {
  title: string
  description: string
  icon?: React.ElementType
}

export function PlaceholderPage({ title, description, icon: Icon = Construction }: PlaceholderPageProps) {
  const { t } = useTranslation(['placeholder'])
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('placeholder:backToDashboard')}
        </Button>
      </div>

      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-500" />
            {t('placeholder:underDevelopment')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">{t('placeholder:status.title')}</h3>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li>✅ {t('placeholder:status.route')}</li>
              <li>✅ {t('placeholder:status.layout')}</li>
              <li>🚧 {t('placeholder:status.feature')}</li>
              <li>🚧 {t('placeholder:status.api')}</li>
            </ul>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>{t('placeholder:checkBack')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}