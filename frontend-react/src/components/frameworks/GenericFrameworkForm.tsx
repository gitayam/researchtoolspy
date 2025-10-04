import { useState, memo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { AIFieldAssistant } from '@/components/ai'
import { DatasetSelector } from '@/components/datasets/DatasetSelector'
import { DatasetBadge } from '@/components/datasets/DatasetBadge'
import type { Dataset } from '@/types/dataset'

interface FrameworkItem {
  id: string
  text: string
}

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
  setNewItem,
  onAdd,
  onRemove,
  linkedDataset,
  onLinkDataset,
  onRemoveDataset,
  frameworkType,
  allData
}: {
  section: FrameworkSection
  items: FrameworkItem[]
  newItem: string
  setNewItem: (value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  linkedDataset: Dataset[]
  onLinkDataset: () => void
  onRemoveDataset: (datasetId: string) => void
  frameworkType: string
  allData?: GenericFrameworkData
}) => (
  <Card className={`border-l-4 ${section.color}`}>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <span className="text-2xl">{section.icon}</span>
        {section.label}
      </CardTitle>
      <CardDescription>{section.description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={`Add ${section.label.toLowerCase()}...`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onAdd()}
        />
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
              <span className="flex-1 text-sm">{item.text}</span>
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
))

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
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')

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

  // Dataset linking state
  const [sectionDataset, setSectionDataset] = useState<{ [key: string]: Dataset[] }>(
    sections.reduce((acc, section) => {
      acc[section.key] = []
      return acc
    }, {} as { [key: string]: Dataset[] })
  )
  const [datasetSelectorOpen, setDatasetSelectorOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Load linked datasets if editing
  useEffect(() => {
    if (frameworkId && mode === 'edit') {
      loadLinkedDataset()
    }
  }, [frameworkId, mode])

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

    const newItem: FrameworkItem = {
      id: crypto.randomUUID(),
      text: text.trim()
    }

    setSectionData(prev => ({
      ...prev,
      [sectionKey]: [...prev[sectionKey], newItem]
    }))

    setNewItems(prev => ({
      ...prev,
      [sectionKey]: ''
    }))
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

  const handleSave = async () => {
    if (!title.trim()) {
      alert(`Please enter a title for your ${frameworkTitle} analysis`)
      return
    }

    setSaving(true)
    try {
      const data: GenericFrameworkData = {
        title: title.trim(),
        description: description.trim(),
        ...sectionData
      }
      await onSave(data)
      navigate(backPath)
    } catch (error) {
      console.error(`Failed to save ${frameworkTitle} analysis:`, error)
      alert(`Failed to save ${frameworkTitle} analysis. Please try again.`)
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
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Provide a title and description for your analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <Input
              placeholder={`e.g., Q4 2025 ${frameworkTitle} Analysis`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
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
            setNewItem={(value) => setNewItems(prev => ({ ...prev, [section.key]: value }))}
            onAdd={() => addItem(section.key, newItems[section.key])}
            onRemove={(id) => removeItem(section.key, id)}
            linkedDataset={sectionDataset[section.key] || []}
            onLinkDataset={() => openDatasetSelector(section.key)}
            onRemoveDataset={(datasetId) => handleRemoveDataset(section.key, datasetId)}
            frameworkType={frameworkType}
            allData={{ title, description, ...sectionData }}
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
