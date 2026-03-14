import { Card, CardContent } from '@/components/ui/card'
import { Database } from 'lucide-react'

interface EntitiesTabProps {
  workspaceId: string
  userRole: string
}

export function EntitiesTab({ workspaceId }: EntitiesTabProps) {
  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardContent className="p-6 text-center">
        <Database className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Entities</h3>
        <p className="text-sm text-gray-400">
          Browse and manage entities in this workspace. Coming soon.
        </p>
      </CardContent>
    </Card>
  )
}
