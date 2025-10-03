import { useState, useEffect } from 'react'
import { X, Plus, Link2, Info, AlertTriangle, CheckCircle2, Shield } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Slider } from '@/components/ui/slider'
import { DatasetSelector } from '@/components/datasets/DatasetSelector'
import type { EvidenceItem, EvidenceFormData, EvidenceType, EvidenceLevel, ConfidenceLevel, PriorityLevel, SourceClassification } from '@/types/evidence'
import {
  EvidenceType as EvidenceTypeEnum,
  EvidenceLevel as EvidenceLevelEnum,
  ConfidenceLevel as ConfidenceLevelEnum,
  PriorityLevel as PriorityLevelEnum,
  SourceClassification as SourceClassificationEnum,
  SourceClassificationDescriptions,
  EvidenceTypeDescriptions
} from '@/types/evidence'

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
  const [showEVE, setShowEVE] = useState(false)

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
    source_classification: 'primary' as SourceClassification,
    source_name: '',
    source_url: '',
    source_id: '',
    evidence_type: 'observation' as EvidenceType,
    evidence_level: 'tactical' as EvidenceLevel,
    category: '',
    credibility: 'F',
    reliability: 'F',
    confidence_level: 'low' as ConfidenceLevel,
    eve_assessment: {
      internal_consistency: 3,
      external_corroboration: 3,
      anomaly_detection: 0,
      notes: ''
    },
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
        source_classification: initialData.source_classification || 'primary',
        source_name: initialData.source_name || '',
        source_url: initialData.source_url || '',
        source_id: initialData.source_id || '',
        evidence_type: initialData.evidence_type,
        evidence_level: initialData.evidence_level,
        category: initialData.category || '',
        credibility: initialData.credibility,
        reliability: initialData.reliability,
        confidence_level: initialData.confidence_level,
        eve_assessment: initialData.eve_assessment ? {
          internal_consistency: initialData.eve_assessment.internal_consistency,
          external_corroboration: initialData.eve_assessment.external_corroboration,
          anomaly_detection: initialData.eve_assessment.anomaly_detection,
          notes: initialData.eve_assessment.notes
        } : {
          internal_consistency: 3,
          external_corroboration: 3,
          anomaly_detection: 0,
          notes: ''
        },
        tags: initialData.tags || [],
        priority: initialData.priority,
      })
      if (initialData.citations) {
        setSelectedDatasets(initialData.citations.map(c => c.dataset_id))
      }
      if (initialData.eve_assessment) {
        setShowEVE(true)
      }
    }
  }, [initialData])

  const handleChange = (field: keyof EvidenceFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEVEChange = (field: keyof NonNullable<EvidenceFormData['eve_assessment']>, value: any) => {
    setFormData(prev => ({
      ...prev,
      eve_assessment: {
        ...prev.eve_assessment!,
        [field]: value
      }
    }))
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

  const calculateEVERisk = () => {
    if (!formData.eve_assessment) return 'UNKNOWN'
    const { internal_consistency, external_corroboration, anomaly_detection } = formData.eve_assessment

    // Lower internal_consistency and external_corroboration = higher risk (inverted)
    // Higher anomaly_detection = higher risk
    const consistencyRisk = (5 - internal_consistency) / 5 * 100
    const corroborationRisk = (5 - external_corroboration) / 5 * 100
    const anomalyRisk = anomaly_detection / 5 * 100

    const totalRisk = (consistencyRisk + corroborationRisk + anomalyRisk) / 3

    if (totalRisk < 25) return 'LOW'
    if (totalRisk < 50) return 'MEDIUM'
    if (totalRisk < 75) return 'HIGH'
    return 'CRITICAL'
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-green-600 bg-green-50 border-green-200'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
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
              {mode === 'create' ? 'Add New Evidence' : 'Edit Evidence'}
            </DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add a new piece of evidence to your collection
            </p>
          </DialogHeader>

          <div className="space-y-6">
            {/* Title & Description */}
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Evidence title..."
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe the evidence..."
                  rows={3}
                />
              </div>
            </div>

            {/* Source Classification & Evidence Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TooltipProvider>
                <div>
                  <Label className="flex items-center gap-2">
                    Source Classification *
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p><strong>Primary:</strong> {SourceClassificationDescriptions.primary}</p>
                          <p><strong>Secondary:</strong> {SourceClassificationDescriptions.secondary}</p>
                          <p><strong>Tertiary:</strong> {SourceClassificationDescriptions.tertiary}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select
                    value={formData.source_classification}
                    onValueChange={(value) => handleChange('source_classification', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SourceClassificationEnum).map(([key, value]) => (
                        <SelectItem key={value} value={value}>
                          {key} - {SourceClassificationDescriptions[value].split(':')[0]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipProvider>

              <TooltipProvider>
                <div>
                  <Label className="flex items-center gap-2">
                    Evidence Type *
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-1 text-xs">
                          {Object.entries(EvidenceTypeDescriptions).map(([type, desc]) => (
                            <p key={type}><strong>{type}:</strong> {desc}</p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select value={formData.evidence_type} onValueChange={(value) => handleChange('evidence_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
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
              </TooltipProvider>
            </div>

            {/* Source Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Source Information</CardTitle>
                <CardDescription>Document the origin of this evidence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Source Name *</Label>
                    <Input
                      value={formData.source_name}
                      onChange={(e) => handleChange('source_name', e.target.value)}
                      placeholder="Source name..."
                    />
                  </div>
                  <div>
                    <Label>URL</Label>
                    <Input
                      value={formData.source_url}
                      onChange={(e) => handleChange('source_url', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Source Reliability & Information Credibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TooltipProvider>
                <div>
                  <Label className="flex items-center gap-2">
                    Source Reliability
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-xs">
                          A: Completely reliable | B: Usually reliable |
                          C: Fairly reliable | D: Not usually reliable |
                          E: Unreliable | F: Cannot be judged
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select value={formData.reliability} onValueChange={(value) => handleChange('reliability', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reliability" />
                    </SelectTrigger>
                    <SelectContent>
                      {['A', 'B', 'C', 'D', 'E', 'F'].map(grade => (
                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipProvider>

              <TooltipProvider>
                <div>
                  <Label className="flex items-center gap-2">
                    Information Credibility
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-xs">
                          1: Confirmed | 2: Probably true | 3: Possibly true |
                          4: Doubtful | 5: Improbable | 6: Cannot be judged
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select value={formData.credibility} onValueChange={(value) => handleChange('credibility', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select credibility" />
                    </SelectTrigger>
                    <SelectContent>
                      {['1', '2', '3', '4', '5', '6'].map(grade => (
                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipProvider>
            </div>

            {/* EVE Deception Assessment */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      EVE Deception Assessment
                    </CardTitle>
                    <CardDescription>Evaluate Evidence (EVE) - Deception Detection Framework</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEVE(!showEVE)}
                  >
                    {showEVE ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>

              {showEVE && formData.eve_assessment && (
                <CardContent className="space-y-6">
                  {/* Overall Risk Indicator */}
                  <div className={`p-4 rounded-lg border-2 ${getRiskColor(calculateEVERisk())}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {calculateEVERisk() === 'LOW' && <CheckCircle2 className="h-5 w-5" />}
                        {calculateEVERisk() === 'MEDIUM' && <Info className="h-5 w-5" />}
                        {(calculateEVERisk() === 'HIGH' || calculateEVERisk() === 'CRITICAL') && <AlertTriangle className="h-5 w-5" />}
                        <span className="font-semibold">Overall Deception Risk: {calculateEVERisk()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Internal Consistency */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        Internal Consistency
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                Does the evidence contradict itself? Higher scores = more internally consistent.
                                <strong> INVERTED: Low score indicates high deception risk.</strong>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Badge variant="outline">{formData.eve_assessment.internal_consistency}/5</Badge>
                    </div>
                    <Slider
                      value={[formData.eve_assessment.internal_consistency]}
                      onValueChange={([value]) => handleEVEChange('internal_consistency', value)}
                      min={0}
                      max={5}
                      step={1}
                    />
                  </div>

                  {/* External Corroboration */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        External Corroboration
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                Is this evidence supported by other independent sources? Higher scores = more corroboration.
                                <strong> INVERTED: Low score indicates high deception risk.</strong>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Badge variant="outline">{formData.eve_assessment.external_corroboration}/5</Badge>
                    </div>
                    <Slider
                      value={[formData.eve_assessment.external_corroboration]}
                      onValueChange={([value]) => handleEVEChange('external_corroboration', value)}
                      min={0}
                      max={5}
                      step={1}
                    />
                  </div>

                  {/* Anomaly Detection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        Anomaly Detection
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                Does this evidence contain unusual patterns, inconsistencies, or red flags?
                                <strong> Higher scores indicate more anomalies = higher deception risk.</strong>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Badge variant="outline">{formData.eve_assessment.anomaly_detection}/5</Badge>
                    </div>
                    <Slider
                      value={[formData.eve_assessment.anomaly_detection]}
                      onValueChange={([value]) => handleEVEChange('anomaly_detection', value)}
                      min={0}
                      max={5}
                      step={1}
                    />
                  </div>

                  {/* Assessment Notes */}
                  <div>
                    <Label>Assessment Notes</Label>
                    <Textarea
                      value={formData.eve_assessment.notes}
                      onChange={(e) => handleEVEChange('notes', e.target.value)}
                      placeholder="Detailed notes on deception indicators, concerns, or supporting evidence..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                />
                <Button onClick={addTag} size="sm" type="button">
                  Add
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
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving...' : mode === 'create' ? 'Add Evidence' : 'Update Evidence'}
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
