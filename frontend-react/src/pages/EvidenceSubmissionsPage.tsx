import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Hash,
  Trash2,
  Power,
  Edit,
  Inbox,
  ClipboardCheck,
  User,
  Link as LinkIcon,
  Archive,
  Tag,
  XCircle
} from 'lucide-react'

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

interface Submission {
  id: string
  form_id: string
  form_name: string
  form_hash: string
  source_url: string | null
  archived_url: string | null
  content_type: string | null
  content_description: string | null
  loginRequired: boolean
  keywords: string[]
  submitter_comments: string | null
  submitter_name: string | null
  submitter_contact: string | null
  metadata: any
  status: string
  submitted_at: string
}

interface ProcessDialog {
  submissionId: string
  verificationStatus: string
  credibilityScore: number
  notes: string
}

export default function EvidenceSubmissionsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'forms'

  // Forms state
  const [forms, setForms] = useState<SubmissionForm[]>([])
  const [isLoadingForms, setIsLoadingForms] = useState(true)
  const [formsError, setFormsError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  // Submissions state
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)
  const [submissionsError, setSubmissionsError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [processDialog, setProcessDialog] = useState<ProcessDialog | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadForms()
    if (activeTab === 'review') {
      loadSubmissions()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'review') {
      loadSubmissions()
    }
  }, [statusFilter])

  const loadForms = async () => {
    setIsLoadingForms(true)
    setFormsError(null)

    try {
      const response = await fetch('/api/research/forms/list?workspaceId=1')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load forms')
      }

      setForms(data.forms || [])
    } catch (err) {
      console.error('Failed to load forms:', err)
      setFormsError(err instanceof Error ? err.message : 'Failed to load forms')
    } finally {
      setIsLoadingForms(false)
    }
  }

  const loadSubmissions = async () => {
    setIsLoadingSubmissions(true)
    setSubmissionsError(null)

    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/research/submissions/list?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load submissions')
      }

      setSubmissions(data.submissions || [])
    } catch (err) {
      console.error('Failed to load submissions:', err)
      setSubmissionsError(err instanceof Error ? err.message : 'Failed to load submissions')
    } finally {
      setIsLoadingSubmissions(false)
    }
  }

  const toggleFormActive = async (formId: string, currentStatus: number) => {
    try {
      const response = await fetch(`/api/research/forms/${formId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: currentStatus === 1 ? 0 : 1 })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle form status')
      }

      await loadForms()
    } catch (err) {
      console.error('Failed to toggle form:', err)
      alert(err instanceof Error ? err.message : 'Failed to toggle form')
    }
  }

  const deleteForm = async (formId: string, formName: string) => {
    if (!confirm(`Are you sure you want to delete "${formName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/research/forms/${formId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete form')
      }

      await loadForms()
    } catch (err) {
      console.error('Failed to delete form:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete form')
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const openProcessDialog = (submission: Submission) => {
    setProcessDialog({
      submissionId: submission.id,
      verificationStatus: 'unverified',
      credibilityScore: 0.5,
      notes: ''
    })
  }

  const handleProcess = async () => {
    if (!processDialog) return

    setIsProcessing(true)
    try {
      const response = await fetch('/api/research/submissions/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: processDialog.submissionId,
          verificationStatus: processDialog.verificationStatus,
          credibilityScore: processDialog.credibilityScore,
          notes: processDialog.notes || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process submission')
      }

      await loadSubmissions()
      setProcessDialog(null)
      setSelectedSubmission(null)
    } catch (err) {
      console.error('Failed to process:', err)
      alert(err instanceof Error ? err.message : 'Failed to process submission')
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredForms = forms.filter(
    (form) =>
      form.form_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.hash_id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('evidenceSubmissions.title', 'Evidence Submissions')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('evidenceSubmissions.description', 'Manage forms and review submitted evidence')}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="forms" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              {t('evidenceSubmissions.formsTab', 'Forms')}
              <Badge variant="secondary">{forms.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              {t('evidenceSubmissions.reviewTab', 'Review')}
              <Badge variant="secondary">{submissions.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Forms Tab */}
          <TabsContent value="forms" className="mt-6">
            <div className="flex items-center justify-between mb-6">
              <Input
                placeholder={t('evidenceSubmissions.searchForms', 'Search forms...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              <Button onClick={() => navigate('/dashboard/research/forms/new')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('evidenceSubmissions.createForm', 'Create Form')}
              </Button>
            </div>

            {formsError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-700 dark:text-red-400">{formsError}</span>
                </div>
              </div>
            )}

            {isLoadingForms ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : filteredForms.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {t('evidenceSubmissions.noForms', 'No submission forms yet')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {t('evidenceSubmissions.noFormsDescription', 'Create your first form to start collecting evidence')}
                  </p>
                  <Button onClick={() => navigate('/dashboard/research/forms/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('evidenceSubmissions.createFirstForm', 'Create First Form')}
                  </Button>
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
                          {form.is_active
                            ? t('evidenceSubmissions.active', 'Active')
                            : t('evidenceSubmissions.inactive', 'Inactive')}
                        </Badge>
                      </div>
                      {form.form_description && (
                        <CardDescription className="line-clamp-2">{form.form_description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('evidenceSubmissions.submissions', 'Submissions')}
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {form.submission_count}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('evidenceSubmissions.fields', 'Fields')}
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {form.enabledFields.length}
                          </p>
                        </div>
                      </div>

                      {/* Hash ID */}
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Hash className="h-3 w-3 mr-1" />
                          {t('evidenceSubmissions.hashId', 'Hash ID')}
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
                        {t('evidenceSubmissions.created', 'Created')} {new Date(form.created_at).toLocaleDateString()}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col space-y-2 pt-2">
                        <div className="flex space-x-2">
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
                                {t('evidenceSubmissions.copied', 'Copied')}
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                {t('evidenceSubmissions.copyUrl', 'Copy URL')}
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`${window.location.origin}${form.submissionUrl}`, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => toggleFormActive(form.id, form.is_active)}
                          >
                            <Power className="h-3 w-3 mr-1" />
                            {form.is_active
                              ? t('evidenceSubmissions.disable', 'Disable')
                              : t('evidenceSubmissions.enable', 'Enable')}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteForm(form.id, form.form_name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {form.submission_count > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSearchParams({ tab: 'review' })
                              setStatusFilter('pending')
                            }}
                          >
                            {t('evidenceSubmissions.viewSubmissions', 'View {{count}} Submission', {
                              count: form.submission_count
                            })}
                            {form.submission_count !== 1 ? 's' : ''}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Review Tab */}
          <TabsContent value="review" className="mt-6">
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="statusFilter">{t('evidenceSubmissions.status', 'Status')}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="statusFilter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t('evidenceSubmissions.pending', 'Pending')}</SelectItem>
                    <SelectItem value="completed">{t('evidenceSubmissions.completed', 'Completed')}</SelectItem>
                    <SelectItem value="rejected">{t('evidenceSubmissions.rejected', 'Rejected')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {submissionsError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-700 dark:text-red-400">{submissionsError}</span>
                </div>
              </div>
            )}

            {isLoadingSubmissions ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* List */}
                <div className="space-y-4">
                  {submissions.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          {t('evidenceSubmissions.noSubmissions', 'No {{status}} submissions', {
                            status: statusFilter
                          })}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          {statusFilter === 'pending'
                            ? t('evidenceSubmissions.noSubmissionsDescription', 'New submissions will appear here')
                            : t('evidenceSubmissions.noSubmissionsYet', 'No {{status}} submissions yet', {
                                status: statusFilter
                              })}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    submissions.map((submission) => (
                      <Card
                        key={submission.id}
                        className={`cursor-pointer hover:shadow-lg transition-shadow ${
                          selectedSubmission?.id === submission.id ? 'ring-2 ring-purple-500' : ''
                        }`}
                        onClick={() => setSelectedSubmission(submission)}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base">
                              {submission.metadata?.title ||
                                submission.content_description?.substring(0, 60) ||
                                t('evidenceSubmissions.untitled', 'Untitled Submission')}
                            </CardTitle>
                            <Badge variant="outline">{submission.form_name}</Badge>
                          </div>
                          {submission.content_type && (
                            <CardDescription className="flex items-center space-x-2">
                              <Badge variant="secondary" className="text-xs">
                                {submission.content_type}
                              </Badge>
                              {submission.keywords.length > 0 && (
                                <span className="text-xs text-gray-500">
                                  {submission.keywords.length}{' '}
                                  {t('evidenceSubmissions.keywords', 'keywords')}
                                </span>
                              )}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {submission.source_url && (
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 truncate">
                              <LinkIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                              <a
                                href={submission.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline truncate"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {submission.source_url}
                              </a>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(submission.submitted_at).toLocaleString()}
                            </span>
                            {submission.submitter_name && (
                              <span className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {submission.submitter_name}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Detail Panel */}
                <div className="lg:sticky lg:top-8 lg:h-fit">
                  {selectedSubmission ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('evidenceSubmissions.submissionDetails', 'Submission Details')}</CardTitle>
                        <CardDescription>
                          {t('evidenceSubmissions.submitted', 'Submitted')}{' '}
                          {new Date(selectedSubmission.submitted_at).toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {selectedSubmission.source_url && (
                          <div>
                            <Label className="text-sm font-medium">
                              {t('evidenceSubmissions.sourceUrl', 'Source URL')}
                            </Label>
                            <div className="flex items-center space-x-2 mt-1">
                              <Input value={selectedSubmission.source_url} readOnly className="text-sm" />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(selectedSubmission.source_url!, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedSubmission.archived_url && (
                          <div>
                            <Label className="text-sm font-medium flex items-center">
                              <Archive className="h-3 w-3 mr-1" />
                              {t('evidenceSubmissions.archivedUrl', 'Archived URL')}
                            </Label>
                            <div className="flex items-center space-x-2 mt-1">
                              <Input value={selectedSubmission.archived_url} readOnly className="text-sm" />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(selectedSubmission.archived_url!, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedSubmission.content_type && (
                          <div>
                            <Label className="text-sm font-medium">
                              {t('evidenceSubmissions.contentType', 'Content Type')}
                            </Label>
                            <Badge variant="outline" className="mt-1">
                              {selectedSubmission.content_type}
                            </Badge>
                          </div>
                        )}

                        {selectedSubmission.content_description && (
                          <div>
                            <Label className="text-sm font-medium">
                              {t('evidenceSubmissions.description', 'Description')}
                            </Label>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              {selectedSubmission.content_description}
                            </p>
                          </div>
                        )}

                        {selectedSubmission.keywords.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium flex items-center">
                              <Tag className="h-3 w-3 mr-1" />
                              {t('evidenceSubmissions.keywords', 'Keywords')}
                            </Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {selectedSubmission.keywords.map((keyword, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedSubmission.submitter_comments && (
                          <div>
                            <Label className="text-sm font-medium">
                              {t('evidenceSubmissions.submitterComments', 'Submitter Comments')}
                            </Label>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              {selectedSubmission.submitter_comments}
                            </p>
                          </div>
                        )}

                        {(selectedSubmission.submitter_name || selectedSubmission.submitter_contact) && (
                          <div>
                            <Label className="text-sm font-medium">
                              {t('evidenceSubmissions.submitter', 'Submitter')}
                            </Label>
                            <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              {selectedSubmission.submitter_name && (
                                <div>
                                  {t('evidenceSubmissions.name', 'Name')}: {selectedSubmission.submitter_name}
                                </div>
                              )}
                              {selectedSubmission.submitter_contact && (
                                <div>
                                  {t('evidenceSubmissions.contact', 'Contact')}: {selectedSubmission.submitter_contact}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedSubmission.status === 'pending' && (
                          <div className="flex space-x-2 pt-4">
                            <Button onClick={() => openProcessDialog(selectedSubmission)} className="flex-1">
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {t('evidenceSubmissions.processToEvidence', 'Process to Evidence')}
                            </Button>
                            <Button variant="destructive" className="flex-1">
                              <XCircle className="h-4 w-4 mr-2" />
                              {t('evidenceSubmissions.reject', 'Reject')}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-12 text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                          {t('evidenceSubmissions.selectSubmission', 'Select a submission to view details')}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Process Dialog */}
        {processDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle>{t('evidenceSubmissions.processToEvidence', 'Process to Evidence')}</CardTitle>
                <CardDescription>
                  {t(
                    'evidenceSubmissions.processDescription',
                    'Convert this submission into a research evidence entry'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verificationStatus">
                    {t('evidenceSubmissions.verificationStatus', 'Verification Status')}
                  </Label>
                  <Select
                    value={processDialog.verificationStatus}
                    onValueChange={(value) => setProcessDialog({ ...processDialog, verificationStatus: value })}
                  >
                    <SelectTrigger id="verificationStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="verified">{t('evidenceSubmissions.verified', 'Verified')}</SelectItem>
                      <SelectItem value="probable">{t('evidenceSubmissions.probable', 'Probable')}</SelectItem>
                      <SelectItem value="unverified">{t('evidenceSubmissions.unverified', 'Unverified')}</SelectItem>
                      <SelectItem value="disproven">{t('evidenceSubmissions.disproven', 'Disproven')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credibilityScore">
                    {t('evidenceSubmissions.credibilityScore', 'Credibility Score')}:{' '}
                    {(processDialog.credibilityScore * 100).toFixed(0)}%
                  </Label>
                  <input
                    id="credibilityScore"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={processDialog.credibilityScore}
                    onChange={(e) =>
                      setProcessDialog({
                        ...processDialog,
                        credibilityScore: parseFloat(e.target.value)
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">
                    {t('evidenceSubmissions.reviewerNotes', 'Reviewer Notes')} (
                    {t('evidenceSubmissions.optional', 'Optional')})
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder={t('evidenceSubmissions.notesPlaceholder', 'Add any notes about this evidence...')}
                    value={processDialog.notes}
                    onChange={(e) => setProcessDialog({ ...processDialog, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setProcessDialog(null)}
                    className="flex-1"
                    disabled={isProcessing}
                  >
                    {t('evidenceSubmissions.cancel', 'Cancel')}
                  </Button>
                  <Button onClick={handleProcess} className="flex-1" disabled={isProcessing}>
                    {isProcessing
                      ? t('evidenceSubmissions.processing', 'Processing...')
                      : t('evidenceSubmissions.processToEvidence', 'Process to Evidence')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
