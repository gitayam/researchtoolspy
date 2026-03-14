import { Card, CardContent } from '@/components/ui/card'
import { Wrench } from 'lucide-react'

interface ToolsTabProps {
  workspaceId: string
  userRole: string
}

export function ToolsTab({ workspaceId }: ToolsTabProps) {
  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardContent className="p-6 text-center">
        <Wrench className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Tools</h3>
        <p className="text-sm text-gray-400">
          Workspace tools and utilities. Coming soon.
        </p>
      </CardContent>
    </Card>
  )
}
