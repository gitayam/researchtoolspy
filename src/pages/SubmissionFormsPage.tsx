import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Hash
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SubmissionForm {
  id: string
  hash_id: string
  form_name: string
  form_description: string
  enabledFields: string[]
  is_active: number
  submission_count: number
  created_at: string
  submissionUrl: string
}

export default function SubmissionFormsPage() {
  const { t } = useTranslation(['submissionForms'])
  const navigate = useNavigate()

  const [forms, setForms] = useState<SubmissionForm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    loadForms()
  }, [])

  const loadForms = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/research/forms/list?workspaceId=1')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('submissionForms:alerts.loadFailed'))
      }

      setForms(data.forms || [])
    } catch (err) {
      console.error('Failed to load forms:', err)
      setError(err instanceof Error ? err.message : t('submissionForms:alerts.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string, formId: string) => {
    navigator.clipboard.writeText(text)
    setCopied(formId)
    setTimeout(() => setCopied(null), 2000)
  }

  const filteredForms = forms.filter(
    (form) =>
      form.form_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.hash_id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('submissionForms:loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('submissionForms:title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {t('submissionForms:description')}
              </p>
            </div>
            <Button onClick={() => navigate('/dashboard/research/forms/new')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('submissionForms:createForm')}
            </Button>
          </div>

          {/* Search */}
          <Input
            placeholder={t('submissionForms:searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          </div>
        )}

        {/* Forms Grid */}
        {filteredForms.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm ? t('submissionForms:empty.noResults') : t('submissionForms:empty.title')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchTerm
                  ? t('submissionForms:empty.noResultsDesc')
                  : t('submissionForms:empty.description')}
              </p>
              {!searchTerm && (
                <Button onClick={() => navigate('/dashboard/research/forms/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('submissionForms:empty.button')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredForms.map((form) => (
              <Card key={form.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-lg">{form.form_name}</CardTitle>
                    <Badge variant={form.is_active ? 'default' : 'secondary'}>
                      {form.is_active ? t('submissionForms:card.active') : t('submissionForms:card.inactive')}
                    </Badge>
                  </div>
                  {form.form_description && (
                    <CardDescription className="line-clamp-2">
                      {form.form_description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('submissionForms:card.submissions')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {form.submission_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('submissionForms:card.fields')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {form.enabledFields.length}
                      </p>
                    </div>
                  </div>

                  {/* Hash ID */}
                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Hash className="h-3 w-3 mr-1" />
                      {t('submissionForms:card.hashId')}
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                        {form.hash_id}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(form.hash_id, form.id)}
                      >
                        {copied === form.id ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Calendar className="h-3 w-3 mr-1" />
                    {t('submissionForms:card.created')} {new Date(form.created_at).toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}${form.submissionUrl}`,
                          `url-${form.id}`
                        )
                      }
                    >
                      {copied === `url-${form.id}` ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('submissionForms:card.copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          {t('submissionForms:card.copyUrl')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(`${window.location.origin}${form.submissionUrl}`, '_blank')
                      }
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* View Submissions */}
                  {form.submission_count > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`/dashboard/research/submissions?formId=${form.id}`)}
                    >
                      {t('submissionForms:card.viewSubmissions', { count: form.submission_count })}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        {forms.length > 0 && (
          <Card className="mt-8 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {t('submissionForms:howItWorks.title')}
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                {t('submissionForms:howItWorks.items', { returnObjects: true }).map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}