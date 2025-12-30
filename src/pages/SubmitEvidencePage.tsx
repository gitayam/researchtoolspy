import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, FileText, Lock, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface FormConfig {
  hashId: string
  formName: string
  formDescription: string
  enabledFields: string[]
  requireUrl: boolean
  requireContentType: boolean
  requirePassword: boolean
}

interface FormData {
  sourceUrl: string
  archivedUrl: string
  contentType: string
  contentDescription: string
  loginRequired: boolean
  keywords: string
  submitterComments: string
  submitterContact: string
  submitterName: string
  password: string
}

export default function SubmitEvidencePage() {
  const { t } = useTranslation(['submitEvidence'])
  const { hashId } = useParams<{ hashId: string }>()

  const [formConfig, setFormConfig] = useState<FormConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    sourceUrl: '',
    archivedUrl: '',
    contentType: '',
    contentDescription: '',
    loginRequired: false,
    keywords: '',
    submitterComments: '',
    submitterContact: '',
    submitterName: '',
    password: ''
  })

  useEffect(() => {
    if (hashId) {
      loadFormConfig(hashId)
    }
  }, [hashId])

  const loadFormConfig = async (hashId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/research/submit/${hashId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('submitEvidence:error.loadFailed'))
      }

      setFormConfig(data.form)
    } catch (err) {
      console.error('Failed to load form:', err)
      setError(err instanceof Error ? err.message : t('submitEvidence:error.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (!hashId) {
        throw new Error(t('submitEvidence:error.invalidId'))
      }

      // Validate required fields
      if (formConfig?.requireUrl && !formData.sourceUrl) {
        throw new Error(t('submitEvidence:error.urlRequired'))
      }

      if (formConfig?.requireContentType && !formData.contentType) {
        throw new Error(t('submitEvidence:error.typeRequired'))
      }

      // Parse keywords
      const keywords = formData.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)

      const response = await fetch(`/api/research/submit/${hashId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: formData.sourceUrl || undefined,
          archivedUrl: formData.archivedUrl || undefined,
          contentType: formData.contentType || undefined,
          contentDescription: formData.contentDescription || undefined,
          loginRequired: formData.loginRequired,
          keywords: keywords.length > 0 ? keywords : undefined,
          submitterComments: formData.submitterComments || undefined,
          submitterContact: formData.submitterContact || undefined,
          submitterName: formData.submitterName || undefined,
          password: formData.password || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('submitEvidence:error.submitFailed'))
      }

      setIsSubmitted(true)

      // Reset form
      setFormData({
        sourceUrl: '',
        archivedUrl: '',
        contentType: '',
        contentDescription: '',
        loginRequired: false,
        keywords: '',
        submitterComments: '',
        submitterContact: '',
        submitterName: '',
        password: ''
      })

    } catch (err) {
      console.error('Failed to submit:', err)
      setError(err instanceof Error ? err.message : t('submitEvidence:error.submitFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFieldEnabled = (field: string) => {
    return formConfig?.enabledFields.includes(field)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('submitEvidence:loading')}</p>
        </div>
      </div>
    )
  }

  if (error && !formConfig) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-red-500">
              <AlertCircle className="h-5 w-5 mr-2" />
              {t('submitEvidence:error.title')}
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-green-500">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {t('submitEvidence:success.title')}
            </CardTitle>
            <CardDescription>
              {t('submitEvidence:success.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsSubmitted(false)} className="w-full">
              {t('submitEvidence:success.submitAnother')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const CONTENT_TYPES = Object.entries(t('submitEvidence:contentTypes', { returnObjects: true })).map(([value, label]) => ({ value, label }))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FileText className="h-12 w-12 text-purple-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {formConfig?.formName}
          </h1>
          {formConfig?.formDescription && (
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              {formConfig.formDescription}
            </p>
          )}
          <div className="flex items-center justify-center mt-4 space-x-2">
            <Badge variant="outline">{t('submitEvidence:header.secure')}</Badge>
            {formConfig?.requirePassword && (
              <Badge variant="outline" className="flex items-center">
                <Lock className="h-3 w-3 mr-1" />
                {t('submitEvidence:header.passwordProtected')}
              </Badge>
            )}
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Source URL */}
              {isFieldEnabled('source_url') && (
                <div className="space-y-2">
                  <Label htmlFor="sourceUrl">
                    {t('submitEvidence:form.sourceUrl')} {formConfig?.requireUrl && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="sourceUrl"
                    type="url"
                    placeholder={t('submitEvidence:form.sourceUrlPlaceholder')}
                    value={formData.sourceUrl}
                    onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                    required={formConfig?.requireUrl}
                  />
                  <p className="text-sm text-gray-500">{t('submitEvidence:form.sourceUrlHint')}</p>
                </div>
              )}

              {/* Archived URL */}
              {isFieldEnabled('archived_url') && (
                <div className="space-y-2">
                  <Label htmlFor="archivedUrl">{t('submitEvidence:form.archivedUrl')}</Label>
                  <Input
                    id="archivedUrl"
                    type="url"
                    placeholder={t('submitEvidence:form.archivedUrlPlaceholder')}
                    value={formData.archivedUrl}
                    onChange={(e) => setFormData({ ...formData, archivedUrl: e.target.value })}
                  />
                  <p className="text-sm text-gray-500">
                    {t('submitEvidence:form.archivedUrlHint')}
                  </p>
                </div>
              )}

              {/* Content Type */}
              {isFieldEnabled('content_type') && (
                <div className="space-y-2">
                  <Label htmlFor="contentType">
                    {t('submitEvidence:form.contentType')} {formConfig?.requireContentType && <span className="text-red-500">*</span>}
                  </Label>
                  <Select
                    value={formData.contentType}
                    onValueChange={(value) => setFormData({ ...formData, contentType: value })}
                    required={formConfig?.requireContentType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('submitEvidence:form.contentTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Content Description */}
              {isFieldEnabled('content_description') && (
                <div className="space-y-2">
                  <Label htmlFor="contentDescription">{t('submitEvidence:form.contentDescription')}</Label>
                  <Textarea
                    id="contentDescription"
                    placeholder={t('submitEvidence:form.contentDescriptionPlaceholder')}
                    value={formData.contentDescription}
                    onChange={(e) => setFormData({ ...formData, contentDescription: e.target.value })}
                    rows={4}
                  />
                </div>
              )}

              {/* Login Required */}
              {isFieldEnabled('login_required') && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="loginRequired"
                    checked={formData.loginRequired}
                    onChange={(e) => setFormData({ ...formData, loginRequired: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="loginRequired" className="cursor-pointer">
                    {t('submitEvidence:form.loginRequired')}
                  </Label>
                </div>
              )}

              {/* Keywords */}
              {isFieldEnabled('keywords') && (
                <div className="space-y-2">
                  <Label htmlFor="keywords">{t('submitEvidence:form.keywords')}</Label>
                  <Input
                    id="keywords"
                    placeholder={t('submitEvidence:form.keywordsPlaceholder')}
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  />
                  <p className="text-sm text-gray-500">{t('submitEvidence:form.keywordsHint')}</p>
                </div>
              )}

              {/* Submitter Comments */}
              {isFieldEnabled('submitter_comments') && (
                <div className="space-y-2">
                  <Label htmlFor="submitterComments">{t('submitEvidence:form.submitterComments')}</Label>
                  <Textarea
                    id="submitterComments"
                    placeholder={t('submitEvidence:form.submitterCommentsPlaceholder')}
                    value={formData.submitterComments}
                    onChange={(e) => setFormData({ ...formData, submitterComments: e.target.value })}
                    rows={3}
                  />
                </div>
              )}

              {/* Submitter Name */}
              {isFieldEnabled('submitter_name') && (
                <div className="space-y-2">
                  <Label htmlFor="submitterName">{t('submitEvidence:form.submitterName')}</Label>
                  <Input
                    id="submitterName"
                    placeholder={t('submitEvidence:form.submitterNamePlaceholder')}
                    value={formData.submitterName}
                    onChange={(e) => setFormData({ ...formData, submitterName: e.target.value })}
                  />
                </div>
              )}

              {/* Submitter Contact */}
              {isFieldEnabled('submitter_contact') && (
                <div className="space-y-2">
                  <Label htmlFor="submitterContact">{t('submitEvidence:form.submitterContact')}</Label>
                  <Input
                    id="submitterContact"
                    type="email"
                    placeholder={t('submitEvidence:form.submitterContactPlaceholder')}
                    value={formData.submitterContact}
                    onChange={(e) => setFormData({ ...formData, submitterContact: e.target.value })}
                  />
                </div>
              )}

              {/* Password */}
              {formConfig?.requirePassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {t('submitEvidence:form.password')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('submitEvidence:form.passwordPlaceholder')}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              )}

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
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t('submitEvidence:form.submitting') : t('submitEvidence:form.submit')}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                {t('submitEvidence:form.footer')}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}