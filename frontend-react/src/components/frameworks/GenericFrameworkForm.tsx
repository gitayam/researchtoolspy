import { useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

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
}

const SectionCard = memo(({
  section,
  items,
  newItem,
  setNewItem,
  onAdd,
  onRemove
}: {
  section: FrameworkSection
  items: FrameworkItem[]
  newItem: string
  setNewItem: (value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
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
  backPath
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
          />
        ))}
      </div>

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
