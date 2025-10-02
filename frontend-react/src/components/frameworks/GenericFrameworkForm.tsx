import { useState, memo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { EvidenceSelector } from '@/components/evidence/EvidenceSelector'
import { EvidenceBadge } from '@/components/evidence/EvidenceBadge'
import type { Evidence } from '@/types/evidence'

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
  linkedEvidence,
  onLinkEvidence,
  onRemoveEvidence
}: {
  section: FrameworkSection
  items: FrameworkItem[]
  newItem: string
  setNewItem: (value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  linkedEvidence: Evidence[]
  onLinkEvidence: () => void
  onRemoveEvidence: (evidenceId: string) => void
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

      {/* Evidence Section */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Linked Evidence ({linkedEvidence.length})</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={onLinkEvidence}
          >
            <Link2 className="h-3 w-3 mr-2" />
            Link Evidence
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {linkedEvidence.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              No evidence linked to this section
            </p>
          ) : (
            linkedEvidence.map((evidence) => (
              <EvidenceBadge
                key={evidence.id}
                evidence={evidence}
                onRemove={() => onRemoveEvidence(evidence.id.toString())}
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

  // Evidence linking state
  const [sectionEvidence, setSectionEvidence] = useState<{ [key: string]: Evidence[] }>(
    sections.reduce((acc, section) => {
      acc[section.key] = []
      return acc
    }, {} as { [key: string]: Evidence[] })
  )
  const [evidenceSelectorOpen, setEvidenceSelectorOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Load linked evidence if editing
  useEffect(() => {
    if (frameworkId && mode === 'edit') {
      loadLinkedEvidence()
    }
  }, [frameworkId, mode])

  const loadLinkedEvidence = async () => {
    if (!frameworkId) return
    try {
      const response = await fetch(`/api/framework-evidence?framework_id=${frameworkId}`)
      if (response.ok) {
        const data = await response.json()
        // Group evidence by section
        const grouped: { [key: string]: Evidence[] } = {}
        sections.forEach(section => {
          grouped[section.key] = []
        })
        data.links.forEach((link: any) => {
          if (link.section_key && grouped[link.section_key]) {
            grouped[link.section_key].push(link)
          }
        })
        setSectionEvidence(grouped)
      }
    } catch (error) {
      console.error('Failed to load linked evidence:', error)
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

  const openEvidenceSelector = (sectionKey: string) => {
    setActiveSection(sectionKey)
    setEvidenceSelectorOpen(true)
  }

  const handleEvidenceSelect = async (evidenceIds: string[]) => {
    if (!activeSection || !frameworkId) {
      // For new frameworks, just store locally until save
      const selectedEvidence: Evidence[] = []
      try {
        for (const id of evidenceIds) {
          const response = await fetch(`/api/evidence?id=${id}`)
          if (response.ok) {
            const evidence = await response.json()
            selectedEvidence.push(evidence)
          }
        }
        setSectionEvidence(prev => ({
          ...prev,
          [activeSection]: selectedEvidence
        }))
      } catch (error) {
        console.error('Failed to load evidence:', error)
      }
      return
    }

    // For existing frameworks, link via API
    try {
      await fetch('/api/framework-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framework_id: frameworkId,
          evidence_ids: evidenceIds,
          section_key: activeSection
        })
      })
      await loadLinkedEvidence()
    } catch (error) {
      console.error('Failed to link evidence:', error)
      alert('Failed to link evidence. Please try again.')
    }
  }

  const handleRemoveEvidence = async (sectionKey: string, evidenceId: string) => {
    if (!frameworkId) {
      // Remove from local state only
      setSectionEvidence(prev => ({
        ...prev,
        [sectionKey]: prev[sectionKey].filter(e => e.id.toString() !== evidenceId)
      }))
      return
    }

    // Remove via API
    try {
      await fetch(
        `/api/framework-evidence?framework_id=${frameworkId}&evidence_id=${evidenceId}&section_key=${sectionKey}`,
        { method: 'DELETE' }
      )
      setSectionEvidence(prev => ({
        ...prev,
        [sectionKey]: prev[sectionKey].filter(e => e.id.toString() !== evidenceId)
      }))
    } catch (error) {
      console.error('Failed to unlink evidence:', error)
      alert('Failed to unlink evidence. Please try again.')
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
            linkedEvidence={sectionEvidence[section.key] || []}
            onLinkEvidence={() => openEvidenceSelector(section.key)}
            onRemoveEvidence={(evidenceId) => handleRemoveEvidence(section.key, evidenceId)}
          />
        ))}
      </div>

      {/* Evidence Selector Modal */}
      <EvidenceSelector
        open={evidenceSelectorOpen}
        onClose={() => {
          setEvidenceSelectorOpen(false)
          setActiveSection(null)
        }}
        onSelect={handleEvidenceSelect}
        selectedIds={activeSection ? sectionEvidence[activeSection]?.map(e => e.id.toString()) : []}
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
