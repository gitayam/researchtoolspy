import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Copy, CheckCircle2, AlertCircle, Link as LinkIcon, Lock, Settings } from 'lucide-react'

interface FormData {
  formName: string
  formDescription: string
  enabledFields: string[]
  requireUrl: boolean
  requireContentType: boolean
  allowAnonymous: boolean
  autoArchive: boolean
  collectSubmitterInfo: boolean
  requireSubmissionPassword: boolean
  submissionPassword: string
}

const AVAILABLE_FIELDS = [
  { id: 'source_url', label: 'Source URL', description: 'URL of the content', default: true },
  { id: 'archived_url', label: 'Archived URL', description: 'Pre-archived backup URL (optional)', default: false },
  { id: 'content_type', label: 'Content Type', description: 'Article, video, social post, etc.', default: true },
  { id: 'content_description', label: 'Content Description', description: 'How this relates to research', default: true },
  { id: 'login_required', label: 'Login Required Toggle', description: 'Whether content needs login', default: false },
  { id: 'keywords', label: 'Keywords', description: 'Tags for searching', default: true },
  { id: 'submitter_comments', label: 'Additional Comments', description: 'Free text notes', default: true },
  { id: 'submitter_name', label: 'Submitter Name', description: 'Optional identification', default: false },
  { id: 'submitter_contact', label: 'Contact Info', description: 'Email or other contact', default: false }
]

export default function CreateSubmissionFormPage() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState<FormData>({
    formName: '',
    formDescription: '',
    enabledFields: ['source_url', 'content_type', 'content_description', 'keywords', 'submitter_comments'],
    requireUrl: true,
    requireContentType: true,
    allowAnonymous: true,
    autoArchive: true,
    collectSubmitterInfo: false,
    requireSubmissionPassword: false,
    submissionPassword: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdForm, setCreatedForm] = useState<{
    id: string
    hashId: string
    submissionUrl: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const toggleField = (fieldId: string) => {
    setFormData(prev => ({
      ...prev,
      enabledFields: prev.enabledFields.includes(fieldId)
        ? prev.enabledFields.filter(id => id !== fieldId)
        : [...prev.enabledFields, fieldId]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (!formData.formName) {
        throw new Error('Form name is required')
      }

      if (formData.enabledFields.length === 0) {
        throw new Error('At least one field must be enabled')
      }

      const response = await fetch('/api/research/forms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formName: formData.formName,
          formDescription: formData.formDescription || undefined,
          targetInvestigationIds: [],
          targetResearchQuestionIds: [],
          enabledFields: formData.enabledFields,
          requireUrl: formData.requireUrl,
          requireContentType: formData.requireContentType,
          allowAnonymous: formData.allowAnonymous,
          autoArchive: formData.autoArchive,
          collectSubmitterInfo: formData.collectSubmitterInfo,
          requireSubmissionPassword: formData.requireSubmissionPassword,
          submissionPassword: formData.submissionPassword || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create form')
      }

      setCreatedForm({
        id: data.form.id,
        hashId: data.form.hashId,
        submissionUrl: `${window.location.origin}${data.form.submissionUrl}`
      })

    } catch (err) {
      console.error('Failed to create form:', err)
      setError(err instanceof Error ? err.message : 'Failed to create form')
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (createdForm) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/research/forms')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forms
          </Button>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-6 w-6 mr-2" />
                Form Created Successfully
              </CardTitle>
              <CardDescription>
                Your submission form is ready. Share the URL below to collect evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Submission URL */}
              <div className="space-y-2">
                <Label>Public Submission URL</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={createdForm.submissionUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(createdForm.submissionUrl)}
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Share this URL to allow anonymous evidence submission
                </p>
              </div>

              {/* Hash ID */}
              <div className="space-y-2">
                <Label>Form Hash ID</Label>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="font-mono text-lg px-4 py-2">
                    {createdForm.hashId}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(createdForm.hashId)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={() => window.open(createdForm.submissionUrl, '_blank')}
                  className="flex-1"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Open Submission Form
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard/research/forms')}
                  className="flex-1"
                >
                  View All Forms
                </Button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Next steps:</strong>
                </p>
                <ul className="text-sm text-blue-600 dark:text-blue-400 mt-2 space-y-1 list-disc list-inside">
                  <li>Share the submission URL with your sources or team</li>
                  <li>Monitor incoming submissions in the review panel</li>
                  <li>Process submissions into your evidence collection</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/research/forms')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Create Submission Form
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create an anonymous form to collect evidence from sources
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Name and describe your submission form</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="formName">
                  Form Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="formName"
                  placeholder="Evidence Submission - Project Alpha"
                  value={formData.formName}
                  onChange={(e) => setFormData({ ...formData, formName: e.target.value })}
                  required
                />
                <p className="text-sm text-gray-500">Internal name for your reference</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="formDescription">Form Description</Label>
                <Textarea
                  id="formDescription"
                  placeholder="Submit evidence related to our investigation. All submissions are confidential and will be reviewed by our team."
                  value={formData.formDescription}
                  onChange={(e) => setFormData({ ...formData, formDescription: e.target.value })}
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  This description will be shown to submitters
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Form Fields */}
          <Card>
            <CardHeader>
              <CardTitle>Form Fields</CardTitle>
              <CardDescription>Select which fields to include in the form</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {AVAILABLE_FIELDS.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => toggleField(field.id)}
                  >
                    <Checkbox
                      id={field.id}
                      checked={formData.enabledFields.includes(field.id)}
                      onCheckedChange={() => toggleField(field.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={field.id} className="cursor-pointer font-medium">
                        {field.label}
                      </Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {field.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Configuration
              </CardTitle>
              <CardDescription>Configure form behavior and requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Require URL */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Require Source URL</Label>
                  <p className="text-sm text-gray-500">Make the URL field mandatory</p>
                </div>
                <Checkbox
                  checked={formData.requireUrl}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requireUrl: checked as boolean })
                  }
                />
              </div>

              {/* Require Content Type */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Require Content Type</Label>
                  <p className="text-sm text-gray-500">Make content type selection mandatory</p>
                </div>
                <Checkbox
                  checked={formData.requireContentType}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requireContentType: checked as boolean })
                  }
                />
              </div>

              {/* Auto Archive */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Auto-Archive URLs</Label>
                  <p className="text-sm text-gray-500">
                    Automatically archive submitted URLs via Wayback Machine
                  </p>
                </div>
                <Checkbox
                  checked={formData.autoArchive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, autoArchive: checked as boolean })
                  }
                />
              </div>

              {/* Collect Submitter Info */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Collect Submitter Info</Label>
                  <p className="text-sm text-gray-500">Store IP address and user agent</p>
                </div>
                <Checkbox
                  checked={formData.collectSubmitterInfo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, collectSubmitterInfo: checked as boolean })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Security
              </CardTitle>
              <CardDescription>Optional password protection for the form</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Require Password</Label>
                  <p className="text-sm text-gray-500">
                    Submitters must enter a password to access the form
                  </p>
                </div>
                <Checkbox
                  checked={formData.requireSubmissionPassword}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      requireSubmissionPassword: checked as boolean
                    })
                  }
                />
              </div>

              {formData.requireSubmissionPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Submission Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password for form access"
                    value={formData.submissionPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, submissionPassword: e.target.value })
                    }
                  />
                  <p className="text-sm text-gray-500">
                    Share this password with authorized submitters
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700 dark:text-red-400">{error}</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard/research/forms')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Form...' : 'Create Form'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
