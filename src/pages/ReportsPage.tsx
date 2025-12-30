import { FileText, Download, FileBarChart, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'

const reports = [
  { id: 1, title: 'SWOT Analysis Summary', type: 'SWOT', date: '2025-09-28', status: 'completed' },
  { id: 2, title: 'ACH Hypothesis Evaluation', type: 'ACH', date: '2025-09-27', status: 'completed' },
  { id: 3, title: 'Evidence Collection Report', type: 'Evidence', date: '2025-09-26', status: 'draft' }
]

export function ReportsPage() {
  const { t } = useTranslation()

  const getStatusLabel = (status: string) => {
    return status === 'completed' ? t('pages.reports.completed') : t('pages.reports.draft')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('pages.reports.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('pages.reports.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            {t('pages.reports.filter')}
          </Button>
          <Button>
            <FileBarChart className="h-4 w-4 mr-2" />
            {t('pages.reports.generateReport')}
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
                      {getStatusLabel(report.status)}
                    </Badge>
                  </div>
                  <CardDescription>
                    {report.type} • {t('pages.reports.generatedOn')} {new Date(report.date).toLocaleDateString()}
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('pages.reports.noReports')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('pages.reports.noReportsDesc')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
