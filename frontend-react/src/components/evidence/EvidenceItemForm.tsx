import { useState, useEffect } from 'react'
import { X, Plus, Link2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DatasetSelector } from '@/components/datasets/DatasetSelector'
import type { EvidenceItem, EvidenceFormData, EvidenceType, EvidenceLevel, ConfidenceLevel, PriorityLevel } from '@/types/evidence'
import { EvidenceType as EvidenceTypeEnum, EvidenceLevel as EvidenceLevelEnum, ConfidenceLevel as ConfidenceLevelEnum, PriorityLevel as PriorityLevelEnum } from '@/types/evidence'

interface EvidenceItemFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: EvidenceFormData) => Promise<void>
  initialData?: EvidenceItem
  mode: 'create' | 'edit'
}

export function EvidenceItemForm({
  open,
  onClose,
  onSave,
  initialData,
  mode
}: EvidenceItemFormProps) {
  const [saving, setSaving] = useState(false)
  const [datasetSelectorOpen, setDatasetSelectorOpen] = useState(false)
  const [selectedDatasets, setSelectedDatasets] = useState<number[]>([])
  const [newTag, setNewTag] = useState('')

  // Form state
  const [formData, setFormData] = useState<EvidenceFormData>({
    title: '',
    description: '',
    who: '',
    what: '',
    when_occurred: '',
    where_location: '',
    why_purpose: '',
    how_method: '',
    evidence_type: 'observation' as EvidenceType,
    evidence_level: 'tactical' as EvidenceLevel,
    category: '',
    credibility: 'F',
    reliability: 'F',
    confidence_level: 'low' as ConfidenceLevel,
    tags: [],
    priority: 'normal' as PriorityLevel,
    citations: []
  })

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title,
        description: initialData.description || '',
        who: initialData.who || '',
        what: initialData.what || '',
        when_occurred: initialData.when_occurred || '',
        where_location: initialData.where_location || '',
        why_purpose: initialData.why_purpose || '',
        how_method: initialData.how_method || '',
        evidence_type: initialData.evidence_type,
        evidence_level: initialData.evidence_level,
        category: initialData.category || '',
        credibility: initialData.credibility,
        reliability: initialData.reliability,
        confidence_level: initialData.confidence_level,
        tags: initialData.tags || [],
        priority: initialData.priority,
      })
      if (initialData.citations) {
        setSelectedDatasets(initialData.citations.map(c => c.dataset_id))
      }
    }
  }, [initialData])

  const handleChange = (field: keyof EvidenceFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleChange('tags', [...formData.tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    handleChange('tags', formData.tags.filter(t => t !== tag))
  }

  const handleDatasetSelect = (datasetIds: string[]) => {
    setSelectedDatasets(datasetIds.map(id => parseInt(id)))
    handleChange('citations', datasetIds.map(id => ({
      dataset_id: parseInt(id),
      citation_type: 'primary' as const,
    })))
  }

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.evidence_type) {
      alert('Please provide a title and evidence type')
      return
    }

    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Failed to save evidence:', error)
      alert('Failed to save evidence. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Add Evidence Item' : 'Edit Evidence Item'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Core details about this evidence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="Brief title for this evidence..."
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Detailed description..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 5 W's + How */}
            <Card>
              <CardHeader>
                <CardTitle>5 W's + How</CardTitle>
                <CardDescription>Answer who, what, when, where, why, and how</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Who</Label>
                    <Input
                      value={formData.who}
                      onChange={(e) => handleChange('who', e.target.value)}
                      placeholder="Person, entity, or actor involved..."
                    />
                  </div>
                  <div>
                    <Label>What</Label>
                    <Input
                      value={formData.what}
                      onChange={(e) => handleChange('what', e.target.value)}
                      placeholder="What happened or what is it..."
                    />
                  </div>
                  <div>
                    <Label>When</Label>
                    <Input
                      value={formData.when_occurred}
                      onChange={(e) => handleChange('when_occurred', e.target.value)}
                      placeholder="When it occurred (date/time)..."
                    />
                  </div>
                  <div>
                    <Label>Where</Label>
                    <Input
                      value={formData.where_location}
                      onChange={(e) => handleChange('where_location', e.target.value)}
                      placeholder="Location, coordinates, place..."
                    />
                  </div>
                  <div>
                    <Label>Why</Label>
                    <Input
                      value={formData.why_purpose}
                      onChange={(e) => handleChange('why_purpose', e.target.value)}
                      placeholder="Purpose or reason..."
                    />
                  </div>
                  <div>
                    <Label>How</Label>
                    <Input
                      value={formData.how_method}
                      onChange={(e) => handleChange('how_method', e.target.value)}
                      placeholder="Method or process..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Classification */}
            <Card>
              <CardHeader>
                <CardTitle>Classification</CardTitle>
                <CardDescription>Categorize and classify this evidence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Evidence Type *</Label>
                    <Select value={formData.evidence_type} onValueChange={(value) => handleChange('evidence_type', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(EvidenceTypeEnum).map(type => (
                          <SelectItem key={type} value={type}>
                            {type.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Evidence Level</Label>
                    <Select value={formData.evidence_level} onValueChange={(value) => handleChange('evidence_level', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(EvidenceLevelEnum).map(level => (
                          <SelectItem key={level} value={level}>
                            {level.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                      placeholder="PMESII, DIME, etc..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assessment */}
            <Card>
              <CardHeader>
                <CardTitle>Assessment</CardTitle>
                <CardDescription>Evaluate reliability and confidence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Credibility</Label>
                    <Select value={formData.credibility} onValueChange={(value) => handleChange('credibility', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['A', 'B', 'C', 'D', 'E', 'F'].map(grade => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reliability</Label>
                    <Select value={formData.reliability} onValueChange={(value) => handleChange('reliability', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['A', 'B', 'C', 'D', 'E', 'F'].map(grade => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Confidence Level</Label>
                    <Select value={formData.confidence_level} onValueChange={(value) => handleChange('confidence_level', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ConfidenceLevelEnum).map(level => (
                          <SelectItem key={level} value={level}>
                            {level.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(PriorityLevelEnum).map(priority => (
                          <SelectItem key={priority} value={priority}>
                            {priority.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>Add tags to organize this evidence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add a tag..."
                  />
                  <Button onClick={addTag} size="sm" type="button">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Source Citations */}
            <Card>
              <CardHeader>
                <CardTitle>Source Citations</CardTitle>
                <CardDescription>Link to datasets that support this evidence</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDatasetSelectorOpen(true)}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Link Datasets ({selectedDatasets.length})
                </Button>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving...' : mode === 'create' ? 'Create Evidence' : 'Update Evidence'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dataset Selector Modal */}
      <DatasetSelector
        open={datasetSelectorOpen}
        onClose={() => setDatasetSelectorOpen(false)}
        onSelect={handleDatasetSelect}
        selectedIds={selectedDatasets.map(id => id.toString())}
      />
    </>
  )
}
