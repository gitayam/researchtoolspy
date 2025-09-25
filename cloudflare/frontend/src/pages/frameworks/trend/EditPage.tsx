import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Construction } from 'lucide-react'

export default function TRENDEditPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/frameworks/trend">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Trend Analysis List
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Trend Analysis</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Trend Analysis framework for identifying patterns and future directions
            </p>
          </div>
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
            The Trend Analysis editing interface is currently under development
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            This page will allow you to edit existing Trend Analysis frameworks.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/frameworks/trend">
              <Button variant="outline">
                Back to Trend Analysis List
              </Button>
            </Link>
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