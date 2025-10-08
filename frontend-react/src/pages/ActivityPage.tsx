import { ActivityFeed } from '@/components/activity/ActivityFeed'

export function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workspace Activity</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track team collaboration and framework updates
        </p>
      </div>
      <ActivityFeed />
    </div>
  )
}
