import { useState, memo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X, Link2, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { AIFieldAssistant, AIUrlScraper } from '@/components/ai'
import { DatasetSelector } from '@/components/datasets/DatasetSelector'
import { DatasetBadge } from '@/components/datasets/DatasetBadge'
import type { Dataset } from '@/types/dataset'
import type { FrameworkItem, QuestionAnswerItem, TextFrameworkItem } from '@/types/frameworks'
import { isQuestionAnswerItem, normalizeItem } from '@/types/frameworks'
import { frameworkConfigs } from '@/config/framework-configs'

interface FrameworkSection {
  key: string
  label: string
  description: string
  color: string
  icon: string
}

interface GenericFrameworkData {
  title: string
  description: string
  [key: string]: any
}

interface GenericFrameworkFormProps {
  initialData?: GenericFrameworkData
  mode: 'create' | 'edit'
  sections: FrameworkSection[]
  frameworkType: string
  frameworkTitle: string
  onSave: (data: GenericFrameworkData) => Promise<void>
  backPath: string
  frameworkId?: string
}

const SectionCard = memo(({
  section,
  items,
  newItem,
  newAnswer,
  setNewItem,
  setNewAnswer,
  onAdd,
  onRemove,
  linkedDataset,
  onLinkDataset,
  onRemoveDataset,
  frameworkType,
  allData,
  itemType
}: {
  section: FrameworkSection
  items: FrameworkItem[]
  newItem: string
  newAnswer?: string
  setNewItem: (value: string) => void
  setNewAnswer?: (value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  linkedDataset: Dataset[]
  onLinkDataset: () => void
  onRemoveDataset: (datasetId: string) => void
  frameworkType: string
  allData?: GenericFrameworkData
  itemType?: 'text' | 'qa'
}) => {
  const isQA = itemType === 'qa'

  return (
    <Card className={`border-l-4 ${section.color}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{section.icon}</span>
          {section.label}
        </CardTitle>
        <CardDescription>{section.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder={isQA ? `Add question...` : `Add ${section.label.toLowerCase()}...`}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => !isQA && e.key === 'Enter' && onAdd()}
            />
            {!isQA && (
              <>
                <AIFieldAssistant
                  fieldName={section.label}
                  currentValue={newItem}
                  onAccept={(value) => setNewItem(value)}
                  context={{
                    framework: frameworkType,
                    relatedFields: allData
                  }}
                  placeholder={`Add ${section.label.toLowerCase()}...`}
                />
                <Button onClick={onAdd} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          {isQA && (
            <>
              <Textarea
                placeholder="Add answer (leave blank if unknown)..."
                value={newAnswer || ''}
                onChange={(e) => setNewAnswer?.(e.target.value)}
                rows={2}
              />
              <Button onClick={onAdd} size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Question & Answer
              </Button>
            </>
          )}
        </div>
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No items added yet
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                {isQA && isQuestionAnswerItem(item) ? (
                  <div className="flex-1 space-y-1">
                    <div className="text-sm font-medium">Q: {item.question}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      A: {item.answer || <span className="italic">No answer provided</span>}
                    </div>
                  </div>
                ) : (
                  <span className="flex-1 text-sm">
                    {'text' in item ? item.text : (item as any).question || ''}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(item.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

      {/* Dataset Section */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Linked Dataset ({linkedDataset.length})</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={onLinkDataset}
          >
            <Link2 className="h-3 w-3 mr-2" />
            Link Dataset
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {linkedDataset.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              No dataset linked to this section
            </p>
          ) : (
            linkedDataset.map((dataset) => (
              <DatasetBadge
                key={dataset.id}
                dataset={dataset}
                onRemove={() => onRemoveDataset(dataset.id.toString())}
                showDetails={false}
              />
            ))
          )}
        </div>
      </div>

      <Badge variant="secondary">{items.length} items</Badge>
    </CardContent>
  </Card>
  )
})

export function GenericFrameworkForm({
  initialData,
  mode,
  sections,
  frameworkType,
  frameworkTitle,
  onSave,
  backPath,
  frameworkId
}: GenericFrameworkFormProps) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [sourceUrl, setSourceUrl] = useState<string>((initialData as any)?.source_url || '')

  // Initialize state for each section
  const [sectionData, setSectionData] = useState<{ [key: string]: FrameworkItem[] }>(
    sections.reduce((acc, section) => {
      acc[section.key] = initialData?.[section.key] || []
      return acc
    }, {} as { [key: string]: FrameworkItem[] })
  )

  const [newItems, setNewItems] = useState<{ [key: string]: string }>(
    sections.reduce((acc, section) => {
      acc[section.key] = ''
      return acc
    }, {} as { [key: string]: string })
  )

  // For Q&A frameworks, track answers separately
  const [newAnswers, setNewAnswers] = useState<{ [key: string]: string }>(
    sections.reduce((acc, section) => {
      acc[section.key] = ''
      return acc
    }, {} as { [key: string]: string })
  )

  // Dataset linking state
  const [sectionDataset, setSectionDataset] = useState<{ [key: string]: Dataset[] }>(
    sections.reduce((acc, section) => {
      acc[section.key] = []
      return acc
    }, {} as { [key: string]: Dataset[] })
  )
  const [datasetSelectorOpen, setDatasetSelectorOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // AI title generation state
  const [generatingTitle, setGeneratingTitle] = useState(false)

  // Get item type from config
  const itemType = frameworkConfigs[frameworkType]?.itemType || 'text'

  // Load linked datasets if editing
  useEffect(() => {
    if (frameworkId && mode === 'edit') {
      loadLinkedDataset()
    }
  }, [frameworkId, mode])

  // Auto-save draft to localStorage every 30 seconds
  useEffect(() => {
    const draftKey = `draft_${frameworkType}_${frameworkId || 'new'}`

    const interval = setInterval(() => {
      const draftData = {
        title,
        description,
        sectionData,
        timestamp: new Date().toISOString()
      }
      try {
        localStorage.setItem(draftKey, JSON.stringify(draftData))
        console.log(`Auto-saved draft for ${frameworkType}`)
      } catch (error) {
        console.error('Failed to auto-save draft:', error)
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [title, description, sectionData, frameworkType, frameworkId])

  // Restore draft on mount if available
  useEffect(() => {
    if (mode === 'create' && !initialData) {
      const draftKey = `draft_${frameworkType}_new`
      const savedDraft = localStorage.getItem(draftKey)

      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft)
          const draftAge = Date.now() - new Date(draft.timestamp).getTime()

          // Only restore if draft is less than 24 hours old
          if (draftAge < 24 * 60 * 60 * 1000) {
            if (confirm(`Found unsaved draft from ${new Date(draft.timestamp).toLocaleString()}. Restore it?`)) {
              setTitle(draft.title || '')
              setDescription(draft.description || '')
              setSectionData(draft.sectionData || {})
            }
          } else {
            // Clean up old drafts
            localStorage.removeItem(draftKey)
          }
        } catch (error) {
          console.error('Failed to restore draft:', error)
        }
      }
    }
  }, [mode, frameworkType, initialData])

  const loadLinkedDataset = async () => {
    if (!frameworkId) return
    try {
      const response = await fetch(`/api/framework-datasets?framework_id=${frameworkId}`)
      if (response.ok) {
        const data = await response.json()
        // Group datasets by section
        const grouped: { [key: string]: Dataset[] } = {}
        sections.forEach(section => {
          grouped[section.key] = []
        })
        data.links.forEach((link: any) => {
          if (link.section_key && grouped[link.section_key]) {
            grouped[link.section_key].push(link)
          }
        })
        setSectionDataset(grouped)
      }
    } catch (error) {
      console.error('Failed to load linked datasets:', error)
    }
  }

  const addItem = (sectionKey: string, text: string) => {
    if (!text.trim()) return

    let newItem: FrameworkItem

    if (itemType === 'qa') {
      // Q&A item - use question and answer
      newItem = {
        id: crypto.randomUUID(),
        question: text.trim(),
        answer: (newAnswers[sectionKey] || '').trim()
      } as QuestionAnswerItem
    } else {
      // Text item
      newItem = {
        id: crypto.randomUUID(),
        text: text.trim()
      } as TextFrameworkItem
    }

    setSectionData(prev => ({
      ...prev,
      [sectionKey]: [...prev[sectionKey], newItem]
    }))

    setNewItems(prev => ({
      ...prev,
      [sectionKey]: ''
    }))

    if (itemType === 'qa') {
      setNewAnswers(prev => ({
        ...prev,
        [sectionKey]: ''
      }))
    }
  }

  const removeItem = (sectionKey: string, id: string) => {
    setSectionData(prev => ({
      ...prev,
      [sectionKey]: prev[sectionKey].filter(item => item.id !== id)
    }))
  }

  const openDatasetSelector = (sectionKey: string) => {
    setActiveSection(sectionKey)
    setDatasetSelectorOpen(true)
  }

  const handleDatasetSelect = async (datasetIds: string[]) => {
    if (!activeSection || !frameworkId) {
      // For new frameworks, just store locally until save
      const selectedDataset: Dataset[] = []
      try {
        for (const id of datasetIds) {
          const response = await fetch(`/api/datasets?id=${id}`)
          if (response.ok) {
            const dataset = await response.json()
            selectedDataset.push(dataset)
          }
        }
        setSectionDataset(prev => ({
          ...prev,
          [activeSection]: selectedDataset
        }))
      } catch (error) {
        console.error('Failed to load dataset:', error)
      }
      return
    }

    // For existing frameworks, link via API
    try {
      await fetch('/api/framework-datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framework_id: frameworkId,
          dataset_ids: datasetIds,
          section_key: activeSection
        })
      })
      await loadLinkedDataset()
    } catch (error) {
      console.error('Failed to link dataset:', error)
      alert('Failed to link dataset. Please try again.')
    }
  }

  const handleRemoveDataset = async (sectionKey: string, datasetId: string) => {
    if (!frameworkId) {
      // Remove from local state only
      setSectionDataset(prev => ({
        ...prev,
        [sectionKey]: prev[sectionKey].filter(e => e.id.toString() !== datasetId)
      }))
      return
    }

    // Remove via API
    try {
      await fetch(
        `/api/framework-datasets?framework_id=${frameworkId}&dataset_id=${datasetId}&section_key=${sectionKey}`,
        { method: 'DELETE' }
      )
      setSectionDataset(prev => ({
        ...prev,
        [sectionKey]: prev[sectionKey].filter(e => e.id.toString() !== datasetId)
      }))
    } catch (error) {
      console.error('Failed to unlink dataset:', error)
      alert('Failed to unlink dataset. Please try again.')
    }
  }

  const handleUrlExtract = (extractedData: Record<string, any>, metadata: { url: string; title: string; summary: string }) => {
    // Populate sections with extracted data
    const newSectionData = { ...sectionData }

    sections.forEach(section => {
      if (extractedData[section.key] && Array.isArray(extractedData[section.key])) {
        const items: FrameworkItem[] = extractedData[section.key].map((item: any) => {
          if (itemType === 'qa') {
            // Handle Q&A items
            if (typeof item === 'object' && 'question' in item) {
              return {
                id: crypto.randomUUID(),
                question: item.question?.trim() || '',
                answer: item.answer?.trim() || ''
              } as QuestionAnswerItem
            }
            // Fallback: treat as question with no answer
            return {
              id: crypto.randomUUID(),
              question: typeof item === 'string' ? item.trim() : '',
              answer: ''
            } as QuestionAnswerItem
          } else {
            // Handle text items
            return {
              id: crypto.randomUUID(),
              text: typeof item === 'string' ? item.trim() : (item.text || item.question || '')
            } as TextFrameworkItem
          }
        })
        newSectionData[section.key] = [...newSectionData[section.key], ...items]
      }
    })

    setSectionData(newSectionData)

    // Store source URL
    setSourceUrl(metadata.url)

    // Auto-populate title if empty
    if (!title.trim() && metadata.title) {
      setTitle(metadata.title)
    }

    // Optionally populate description with summary if empty
    if (!description.trim() && metadata.summary) {
      setDescription(metadata.summary)
    }
  }

  const generateTitle = async () => {
    setGeneratingTitle(true)
    try {
      const response = await fetch('/api/ai/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameworkType,
          data: sectionData,
          description
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate title')
      }

      const { title: generatedTitle } = await response.json()
      setTitle(generatedTitle)
    } catch (error) {
      console.error('Failed to generate title:', error)
      alert('Failed to generate title. Please try again.')
    } finally {
      setGeneratingTitle(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setSaveError('Please enter a title for your analysis')
      alert(`Please enter a title for your ${frameworkTitle} analysis`)
      return
    }

    // Validate that at least one section has data
    const hasData = sections.some(section => sectionData[section.key]?.length > 0)
    if (!hasData) {
      setSaveError('Please add at least one item to any section')
      alert('Please add at least one item before saving')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const data: GenericFrameworkData = {
        title: title.trim(),
        description: description.trim(),
        source_url: sourceUrl || undefined,
        ...sectionData
      }

      console.log(`Saving ${frameworkType} analysis:`, data)

      await onSave(data)

      // Clear draft from localStorage after successful save
      const draftKey = `draft_${frameworkType}_${frameworkId || 'new'}`
      localStorage.removeItem(draftKey)

      setLastSaved(new Date())
      console.log(`Successfully saved ${frameworkType} analysis`)

      // Navigate back after short delay to show success
      setTimeout(() => {
        navigate(backPath)
      }, 500)

    } catch (error) {
      console.error(`Failed to save ${frameworkTitle} analysis:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setSaveError(`Failed to save: ${errorMessage}`)
      alert(`Failed to save ${frameworkTitle} analysis. ${errorMessage}\n\nYour data has been auto-saved locally. Please try again or contact support if the issue persists.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {mode === 'create' ? 'Create' : 'Edit'} {frameworkTitle}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {frameworkType} framework analysis
            </p>
            {lastSaved && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ Saved at {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <AIUrlScraper
            framework={frameworkType}
            onExtract={handleUrlExtract}
          />
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Analysis'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {saveError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-red-600 dark:text-red-400 mt-0.5">⚠️</div>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">Save Failed</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{saveError}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Your data has been auto-saved locally and will be restored if you refresh the page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Provide a title and description for your analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <div className="flex gap-2">
              <Input
                placeholder={`e.g., Q4 2025 ${frameworkTitle} Analysis`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateTitle}
                disabled={generatingTitle || (Object.values(sectionData).every(items => items.length === 0) && !description)}
                title="Generate title using AI"
              >
                {generatingTitle ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              placeholder="Provide context for this analysis..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Framework Sections */}
      <div className={`grid grid-cols-1 ${sections.length === 4 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6`}>
        {sections.map(section => (
          <SectionCard
            key={section.key}
            section={section}
            items={sectionData[section.key]}
            newItem={newItems[section.key]}
            newAnswer={itemType === 'qa' ? newAnswers[section.key] : undefined}
            setNewItem={(value) => setNewItems(prev => ({ ...prev, [section.key]: value }))}
            setNewAnswer={itemType === 'qa' ? (value) => setNewAnswers(prev => ({ ...prev, [section.key]: value })) : undefined}
            onAdd={() => addItem(section.key, newItems[section.key])}
            onRemove={(id) => removeItem(section.key, id)}
            linkedDataset={sectionDataset[section.key] || []}
            onLinkDataset={() => openDatasetSelector(section.key)}
            onRemoveDataset={(datasetId) => handleRemoveDataset(section.key, datasetId)}
            frameworkType={frameworkType}
            allData={{ title, description, ...sectionData }}
            itemType={itemType}
          />
        ))}
      </div>

      {/* Dataset Selector Modal */}
      <DatasetSelector
        open={datasetSelectorOpen}
        onClose={() => {
          setDatasetSelectorOpen(false)
          setActiveSection(null)
        }}
        onSelect={handleDatasetSelect}
        selectedIds={activeSection ? sectionDataset[activeSection]?.map(e => e.id.toString()) : []}
        frameworkId={frameworkId}
        sectionKey={activeSection || undefined}
      />

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-${sections.length} gap-4 text-center`}>
            {sections.map(section => (
              <div key={section.key}>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {sectionData[section.key].length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{section.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
