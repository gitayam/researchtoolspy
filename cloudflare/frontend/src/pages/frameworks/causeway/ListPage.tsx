import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Construction } from 'lucide-react'

export default function CAUSEWAYListPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CAUSEWAY Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            CAUSEWAY Military Decision Making Process framework
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-gray-900 dark:text-gray-100">
            <Construction className="h-6 w-6" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            The CAUSEWAY Analysis list interface is currently under development
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            This page will display all your CAUSEWAY Analysis frameworks and allow you to manage your analyses.
            CAUSEWAY frameworks are edited directly without a separate creation step.
          </p>
          <div className="flex justify-center">
            <Link to="/frameworks">
              <Button>
                Browse All Frameworks
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}