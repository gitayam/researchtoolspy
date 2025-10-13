import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
  FileText,
  Calendar,
  User,
  Link as LinkIcon,
  Archive,
  Tag
} from 'lucide-react'

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

export default function SubmissionsReviewPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const formId = searchParams.get('formId')

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [processDialog, setProcessDialog] = useState<ProcessDialog | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadSubmissions()
  }, [formId, statusFilter])

  const loadSubmissions = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (formId) params.append('formId', formId)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/research/submissions/list?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load submissions')
      }

      setSubmissions(data.submissions || [])
    } catch (err) {
      console.error('Failed to load submissions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load submissions')
    } finally {
      setIsLoading(false)
    }
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

      // Reload submissions
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading submissions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Review Submissions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Review and process evidence submissions
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="statusFilter">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="statusFilter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          </div>
        )}

        {/* Submissions List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* List */}
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No {statusFilter} submissions
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {statusFilter === 'pending'
                      ? 'New submissions will appear here'
                      : `No ${statusFilter} submissions yet`}
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
                          'Untitled Submission'}
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
                            {submission.keywords.length} keywords
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
                  <CardTitle>Submission Details</CardTitle>
                  <CardDescription>
                    Submitted {new Date(selectedSubmission.submitted_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Source URL */}
                  {selectedSubmission.source_url && (
                    <div>
                      <Label className="text-sm font-medium">Source URL</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          value={selectedSubmission.source_url}
                          readOnly
                          className="text-sm"
                        />
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

                  {/* Archived URL */}
                  {selectedSubmission.archived_url && (
                    <div>
                      <Label className="text-sm font-medium flex items-center">
                        <Archive className="h-3 w-3 mr-1" />
                        Archived URL
                      </Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          value={selectedSubmission.archived_url}
                          readOnly
                          className="text-sm"
                        />
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

                  {/* Content Type */}
                  {selectedSubmission.content_type && (
                    <div>
                      <Label className="text-sm font-medium">Content Type</Label>
                      <Badge variant="outline" className="mt-1">
                        {selectedSubmission.content_type}
                      </Badge>
                    </div>
                  )}

                  {/* Description */}
                  {selectedSubmission.content_description && (
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {selectedSubmission.content_description}
                      </p>
                    </div>
                  )}

                  {/* Keywords */}
                  {selectedSubmission.keywords.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium flex items-center">
                        <Tag className="h-3 w-3 mr-1" />
                        Keywords
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

                  {/* Comments */}
                  {selectedSubmission.submitter_comments && (
                    <div>
                      <Label className="text-sm font-medium">Submitter Comments</Label>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {selectedSubmission.submitter_comments}
                      </p>
                    </div>
                  )}

                  {/* Submitter Info */}
                  {(selectedSubmission.submitter_name || selectedSubmission.submitter_contact) && (
                    <div>
                      <Label className="text-sm font-medium">Submitter</Label>
                      <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {selectedSubmission.submitter_name && (
                          <div>Name: {selectedSubmission.submitter_name}</div>
                        )}
                        {selectedSubmission.submitter_contact && (
                          <div>Contact: {selectedSubmission.submitter_contact}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {selectedSubmission.status === 'pending' && (
                    <div className="flex space-x-2 pt-4">
                      <Button
                        onClick={() => openProcessDialog(selectedSubmission)}
                        className="flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Process to Evidence
                      </Button>
                      <Button variant="destructive" className="flex-1">
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
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
                    Select a submission to view details
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Process Dialog */}
        {processDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle>Process to Evidence</CardTitle>
                <CardDescription>
                  Convert this submission into a research evidence entry
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verificationStatus">Verification Status</Label>
                  <Select
                    value={processDialog.verificationStatus}
                    onValueChange={(value) =>
                      setProcessDialog({ ...processDialog, verificationStatus: value })
                    }
                  >
                    <SelectTrigger id="verificationStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="probable">Probable</SelectItem>
                      <SelectItem value="unverified">Unverified</SelectItem>
                      <SelectItem value="disproven">Disproven</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credibilityScore">
                    Credibility Score: {(processDialog.credibilityScore * 100).toFixed(0)}%
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
                  <Label htmlFor="notes">Reviewer Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this evidence..."
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
                    Cancel
                  </Button>
                  <Button onClick={handleProcess} className="flex-1" disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Process to Evidence'}
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
