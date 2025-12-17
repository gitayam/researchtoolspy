import { FileText, Download, FileBarChart, Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const reports = [
  { id: 1, title: 'SWOT Analysis Summary', type: 'SWOT', date: '2025-09-28', status: 'completed' },
  { id: 2, title: 'ACH Hypothesis Evaluation', type: 'ACH', date: '2025-09-27', status: 'completed' },
  { id: 3, title: 'Evidence Collection Report', type: 'Evidence', date: '2025-09-26', status: 'draft' }
]

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-600 dark:text-gray-400">Generate and manage analysis reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button>
            <FileBarChart className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <CardTitle>{report.title}</CardTitle>
                    <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {report.type} • Generated on {new Date(report.date).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {reports.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileBarChart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No reports yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first report from an analysis framework
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
