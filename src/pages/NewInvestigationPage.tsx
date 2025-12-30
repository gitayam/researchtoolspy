import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Folder, Zap, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface InvestigationType {
  id: 'structured_research' | 'general_topic' | 'rapid_analysis'
  name: string
  description: string
  icon: any
  features: string[]
}

const INVESTIGATION_TYPES: InvestigationType[] = [
  {
    id: 'structured_research',
    name: 'Structured Research',
    description: 'Research with a defined question and methodology',
    icon: FileText,
    features: [
      'Research question & plan',
      'Hypothesis testing',
      'Systematic evidence collection',
      'Framework analyses'
    ]
  },
  {
    id: 'general_topic',
    name: 'General Topic',
    description: 'Open-ended exploration of a topic',
    icon: Folder,
    features: [
      'Flexible exploration',
      'Multiple perspectives',
      'Evidence gathering',
      'Can upgrade to structured later'
    ]
  },
  {
    id: 'rapid_analysis',
    name: 'Rapid Analysis',
    description: 'Quick framework application for immediate insights',
    icon: Zap,
    features: [
      'Fast turnaround',
      'Single framework focus',
      'Targeted analysis',
      'Immediate results'
    ]
  }
]

export default function NewInvestigationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState<'type' | 'details'>('type')
  const [selectedType, setSelectedType] = useState<InvestigationType | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleSelectType = (type: InvestigationType) => {
    setSelectedType(type)
    setStep('details')
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleCreate = async () => {
    if (!selectedType || !title) return

    setIsCreating(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch('/api/investigations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({
          title,
          description,
          type: selectedType.id,
          tags
        })
      })

      if (response.ok) {
        const data = await response.json()
        navigate(`/dashboard/investigations/${data.investigation.id}`)
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to create investigation'
        const errorDetails = errorData.details ? `\n\nDetails: ${errorData.details}` : ''
        alert(`${errorMessage}${errorDetails}`)
      }
    } catch (error) {
      console.error('Error creating investigation:', error)
      alert(`Network error: Unable to create investigation. Please check your connection and try again.`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="outline" onClick={() => step === 'type' ? navigate('/dashboard/investigations') : setStep('type')} size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 'type' ? t('pages.newInvestigation.backToInvestigations') : t('pages.newInvestigation.back')}
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{t('pages.newInvestigation.title')}</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
          {step === 'type' ? t('pages.newInvestigation.chooseType') : t('pages.newInvestigation.provideDetails')}
        </p>
        {!localStorage.getItem('omnicore_user_hash') && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>{t('pages.newInvestigation.guestMode')}</strong> {t('pages.newInvestigation.guestModeDesc')}
            </p>
          </div>
        )}
      </div>

      {/* Step 1: Select Type */}
      {step === 'type' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INVESTIGATION_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <Card
                key={type.id}
                className="hover:shadow-lg transition-shadow cursor-pointer hover:border-purple-300 dark:hover:border-purple-700"
                onClick={() => handleSelectType(type)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                      <Icon className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">{type.name}</CardTitle>
                  <CardDescription>{type.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {type.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Step 2: Details */}
      {step === 'details' && selectedType && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <selectedType.icon className="h-5 w-5 text-purple-600" />
                <Badge variant="secondary">{selectedType.name}</Badge>
              </div>
              <CardTitle>{t('pages.newInvestigation.investigationDetails')}</CardTitle>
              <CardDescription>
                {t('pages.newInvestigation.provideDescription')} {selectedType.name.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('pages.newInvestigation.titleLabel')} *
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('pages.newInvestigation.titlePlaceholder')}
                  className="w-full"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('pages.newInvestigation.descriptionLabel')}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('pages.newInvestigation.descriptionPlaceholder')}
                  className="w-full min-h-[100px]"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('pages.newInvestigation.tagsLabel')}
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder={t('pages.newInvestigation.tagsPlaceholder')}
                    className="flex-1"
                  />
                  <Button onClick={handleAddTag} variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep('type')}>
              {t('pages.newInvestigation.back')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!title || isCreating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('pages.newInvestigation.creating')}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('pages.newInvestigation.createInvestigation')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
