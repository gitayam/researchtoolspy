import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { useTranslation } from 'react-i18next'

export function ActivityPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('pages.activity.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('pages.activity.subtitle')}
        </p>
      </div>
      <ActivityFeed />
    </div>
  )
}
