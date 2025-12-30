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
import { useTranslation } from 'react-i18next'

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
  { id: 'source_url', default: true },
  { id: 'archived_url', default: false },
  { id: 'content_type', default: true },
  { id: 'content_description', default: true },
  { id: 'login_required', default: false },
  { id: 'keywords', default: true },
  { id: 'submitter_comments', default: true },
  { id: 'submitter_name', default: false },
  { id: 'submitter_contact', default: false }
]

export default function CreateSubmissionFormPage() {
  const { t } = useTranslation(['submissionForm', 'common'])
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
        throw new Error(t('submissionForm:alerts.nameRequired'))
      }

      if (formData.enabledFields.length === 0) {
        throw new Error(t('submissionForm:alerts.atLeastOneField'))
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
        throw new Error(data.error || t('submissionForm:alerts.createFailed'))
      }

      setCreatedForm({
        id: data.form.id,
        hashId: data.form.hashId,
        submissionUrl: `${window.location.origin}${data.form.submissionUrl}`
      })

    } catch (err) {
      console.error('Failed to create form:', err)
      setError(err instanceof Error ? err.message : t('submissionForm:alerts.createFailed'))
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
            {t('submissionForm:backToForms')}
          </Button>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-6 w-6 mr-2" />
                {t('submissionForm:success.title')}
              </CardTitle>
              <CardDescription>
                {t('submissionForm:success.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Submission URL */}
              <div className="space-y-2">
                <Label>{t('submissionForm:success.urlLabel')}</Label>
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
                  {t('submissionForm:success.urlHint')}
                </p>
              </div>

              {/* Hash ID */}
              <div className="space-y-2">
                <Label>{t('submissionForm:success.hashIdLabel')}</Label>
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
                  {t('submissionForm:success.openButton')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard/research/forms')}
                  className="flex-1"
                >
                  {t('submissionForm:success.viewAllButton')}
                </Button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>{t('submissionForm:success.nextSteps')}</strong>
                </p>
                <ul className="text-sm text-blue-600 dark:text-blue-400 mt-2 space-y-1 list-disc list-inside">
                  {t('submissionForm:success.nextStepsList', { returnObjects: true }).map((step: string, index: number) => (
                    <li key={index}>{step}</li>
                  ))}
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
            {t('submissionForm:create.back')}
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('submissionForm:create.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('submissionForm:create.description')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('submissionForm:create.basicInfo.title')}</CardTitle>
              <CardDescription>{t('submissionForm:create.basicInfo.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="formName">
                  {t('submissionForm:create.basicInfo.nameLabel')}
                </Label>
                <Input
                  id="formName"
                  placeholder={t('submissionForm:create.basicInfo.namePlaceholder')}
                  value={formData.formName}
                  onChange={(e) => setFormData({ ...formData, formName: e.target.value })}
                  required
                />
                <p className="text-sm text-gray-500">{t('submissionForm:create.basicInfo.nameHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="formDescription">{t('submissionForm:create.basicInfo.descriptionLabel')}</Label>
                <Textarea
                  id="formDescription"
                  placeholder={t('submissionForm:create.basicInfo.descriptionPlaceholder')}
                  value={formData.formDescription}
                  onChange={(e) => setFormData({ ...formData, formDescription: e.target.value })}
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  {t('submissionForm:create.basicInfo.descriptionHint')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Form Fields */}
          <Card>
            <CardHeader>
              <CardTitle>{t('submissionForm:create.fields.title')}</CardTitle>
              <CardDescription>{t('submissionForm:create.fields.description')}</CardDescription>
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
                        {t(`submissionForm:fields.${field.id}`)}
                      </Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t(`submissionForm:fields.${field.id}_desc`)}
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
                {t('submissionForm:create.configuration.title')}
              </CardTitle>
              <CardDescription>{t('submissionForm:create.configuration.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Require URL */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">{t('submissionForm:create.configuration.requireUrl')}</Label>
                  <p className="text-sm text-gray-500">{t('submissionForm:create.configuration.requireUrlDesc')}</p>
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
                  <Label className="font-medium">{t('submissionForm:create.configuration.requireContentType')}</Label>
                  <p className="text-sm text-gray-500">{t('submissionForm:create.configuration.requireContentTypeDesc')}</p>
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
                  <Label className="font-medium">{t('submissionForm:create.configuration.autoArchive')}</Label>
                  <p className="text-sm text-gray-500">
                    {t('submissionForm:create.configuration.autoArchiveDesc')}
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
                  <Label className="font-medium">{t('submissionForm:create.configuration.collectSubmitterInfo')}</Label>
                  <p className="text-sm text-gray-500">{t('submissionForm:create.configuration.collectSubmitterInfoDesc')}</p>
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
                {t('submissionForm:create.security.title')}
              </CardTitle>
              <CardDescription>{t('submissionForm:create.security.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">{t('submissionForm:create.security.requirePassword')}</Label>
                  <p className="text-sm text-gray-500">
                    {t('submissionForm:create.security.requirePasswordDesc')}
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
                  <Label htmlFor="password">{t('submissionForm:create.security.passwordLabel')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('submissionForm:create.security.passwordPlaceholder')}
                    value={formData.submissionPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, submissionPassword: e.target.value })
                    }
                  />
                  <p className="text-sm text-gray-500">
                    {t('submissionForm:create.security.passwordHint')}
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
              {t('submissionForm:create.buttons.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('submissionForm:create.buttons.creating') : t('submissionForm:create.buttons.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}