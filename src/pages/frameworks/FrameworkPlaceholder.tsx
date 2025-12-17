import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Download, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FrameworkPlaceholderProps {
  title: string
  description: string
  frameworkType: string
}

export function FrameworkPlaceholder({ title, description, frameworkType }: FrameworkPlaceholderProps) {
  const params = useParams()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-gray-500">{description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title} Analysis Framework
          </CardTitle>
          <CardDescription>
            Framework Type: {frameworkType}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="max-w-md mx-auto space-y-4">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">Framework Migration In Progress</h3>
            <p className="text-gray-500">
              This analysis framework is being migrated from Next.js to React + Vite.
              Full functionality will be available soon.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Current Implementation Status:
              </p>
              <ul className="text-left space-y-1 text-blue-800 dark:text-blue-200">
                <li>✅ Dashboard layout and navigation</li>
                <li>✅ Authentication system</li>
                <li>✅ API integration structure</li>
                <li>🚧 Framework-specific UI components</li>
                <li>🚧 Data persistence and auto-save</li>
                <li>🚧 Export functionality</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
