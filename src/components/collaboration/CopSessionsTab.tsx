import { Card, CardContent } from '@/components/ui/card'
import { Radio } from 'lucide-react'

interface CopSessionsTabProps {
  workspaceId: string
  userRole: string
}

export function CopSessionsTab({ workspaceId }: CopSessionsTabProps) {
  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardContent className="p-6 text-center">
        <Radio className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-200 mb-2">COP Sessions</h3>
        <p className="text-sm text-gray-400">
          Browse COP sessions in this workspace. Coming soon.
        </p>
      </CardContent>
    </Card>
  )
}
