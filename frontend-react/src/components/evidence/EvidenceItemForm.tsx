import { useState, useEffect } from 'react'
import { X, Plus, AlertTriangle, CheckCircle2, Shield } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import type { EvidenceItem, EvidenceFormData, EvidenceType, EvidenceLevel, ConfidenceLevel, PriorityLevel, SourceClassification } from '@/types/evidence'
import {
  EvidenceType as EvidenceTypeEnum,
  EvidenceLevel as EvidenceLevelEnum,
  ConfidenceLevel as ConfidenceLevelEnum,
  PriorityLevel as PriorityLevelEnum,
  SourceClassification as SourceClassificationEnum,
  SourceClassificationDescriptions,
  EvidenceTypeDescriptions,
  EvidenceTypeCategories
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
    evidence_type: 'news_article' as EvidenceType,
    evidence_level: 'tactical' as EvidenceLevel,
    category: '',
    credibility: '3',
    reliability: 'C',
    confidence_level: 'medium' as ConfidenceLevel,
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
      // Add assessed_at timestamp to EVE assessment if it exists
      const dataToSave = {
        ...formData,
        eve_assessment: showEVE && formData.eve_assessment ? {
          ...formData.eve_assessment,
          assessed_at: new Date().toISOString(),
          overall_risk: calculateEVERisk()
        } : undefined
      }

      await onSave(dataToSave as EvidenceFormData)
      onClose()
    } catch (error) {
      console.error('Failed to save evidence:', error)
      alert('Failed to save evidence. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Evidence' : 'Edit Evidence'}
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Document and evaluate evidence using investigative journalism standards
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* SECTION 1: What is this evidence? */}
          <Card>
            <CardHeader>
              <CardTitle>What is this evidence?</CardTitle>
              <CardDescription>Identify the type and credibility of this specific piece of evidence</CardDescription>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Evidence Type *</Label>
                  <Select value={formData.evidence_type} onValueChange={(value) => handleChange('evidence_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EvidenceTypeCategories).map(([category, types]) => (
                        <SelectGroup key={category}>
                          <SelectLabel>{category}</SelectLabel>
                          {types.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {EvidenceTypeDescriptions[formData.evidence_type]}
                  </p>
                </div>

                <div>
                  <Label>Information Credibility *</Label>
                  <Select value={formData.credibility} onValueChange={(value) => handleChange('credibility', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="How credible is this information?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Confirmed by other sources</SelectItem>
                      <SelectItem value="2">2 - Probably true</SelectItem>
                      <SelectItem value="3">3 - Possibly true</SelectItem>
                      <SelectItem value="4">4 - Doubtful</SelectItem>
                      <SelectItem value="5">5 - Improbable</SelectItem>
                      <SelectItem value="6">6 - Cannot be judged</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    How credible is THIS specific piece of information? (1=Confirmed → 6=Cannot judge)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2: Where did it come from? */}
          <Card>
            <CardHeader>
              <CardTitle>Where did it come from?</CardTitle>
              <CardDescription>Document the source and assess its general reliability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Source Classification *</Label>
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
                          {key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {SourceClassificationDescriptions[formData.source_classification]}
                  </p>
                </div>

                <div>
                  <Label>Source Reliability *</Label>
                  <Select value={formData.reliability} onValueChange={(value) => handleChange('reliability', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="How reliable is the source?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A - Completely reliable</SelectItem>
                      <SelectItem value="B">B - Usually reliable</SelectItem>
                      <SelectItem value="C">C - Fairly reliable</SelectItem>
                      <SelectItem value="D">D - Not usually reliable</SelectItem>
                      <SelectItem value="E">E - Unreliable</SelectItem>
                      <SelectItem value="F">F - Cannot be judged</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    How reliable is this SOURCE in general? (A=Completely reliable → F=Cannot judge)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Source Name *</Label>
                  <Input
                    value={formData.source_name}
                    onChange={(e) => handleChange('source_name', e.target.value)}
                    placeholder="Name of source, publication, or person..."
                  />
                </div>
                <div>
                  <Label>Source URL</Label>
                  <Input
                    value={formData.source_url}
                    onChange={(e) => handleChange('source_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 3: The Details (5 W's + How) */}
          <Card>
            <CardHeader>
              <CardTitle>The Details</CardTitle>
              <CardDescription>Answer the fundamental questions: Who, What, When, Where, Why, and How</CardDescription>
            </CardHeader>
            <CardContent>
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

          {/* SECTION 4: Is it authentic? (EVE Deception Assessment) */}
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Is it authentic?
                  </CardTitle>
                  <CardDescription>EVE Deception Assessment - Evaluate if this evidence might be fake, manipulated, or misleading</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEVE(!showEVE)}
                >
                  {showEVE ? 'Hide Assessment' : 'Show Assessment'}
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
                      {calculateEVERisk() === 'MEDIUM' && <Shield className="h-5 w-5" />}
                      {(calculateEVERisk() === 'HIGH' || calculateEVERisk() === 'CRITICAL') && <AlertTriangle className="h-5 w-5" />}
                      <span className="font-semibold">Overall Deception Risk: {calculateEVERisk()}</span>
                    </div>
                  </div>
                </div>

                {/* Internal Consistency */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Internal Consistency</Label>
                    <Badge variant="outline" className="text-base">{formData.eve_assessment.internal_consistency}/5</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Does the evidence contradict itself? Does the story hold together internally? Higher scores = more consistent.
                    <strong className="text-orange-600"> LOW SCORE = HIGH DECEPTION RISK</strong>
                  </p>
                  <Slider
                    value={[formData.eve_assessment.internal_consistency]}
                    onValueChange={([value]) => handleEVEChange('internal_consistency', value)}
                    min={0}
                    max={5}
                    step={1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0 - Contradictory</span>
                    <span>3 - Somewhat consistent</span>
                    <span>5 - Perfectly consistent</span>
                  </div>
                </div>

                {/* External Corroboration */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">External Corroboration</Label>
                    <Badge variant="outline" className="text-base">{formData.eve_assessment.external_corroboration}/5</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Is this evidence supported by other independent sources? Can you verify it elsewhere? Higher scores = more corroboration.
                    <strong className="text-orange-600"> LOW SCORE = HIGH DECEPTION RISK</strong>
                  </p>
                  <Slider
                    value={[formData.eve_assessment.external_corroboration]}
                    onValueChange={([value]) => handleEVEChange('external_corroboration', value)}
                    min={0}
                    max={5}
                    step={1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0 - No corroboration</span>
                    <span>3 - Some support</span>
                    <span>5 - Multiple independent sources</span>
                  </div>
                </div>

                {/* Anomaly Detection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Anomaly Detection</Label>
                    <Badge variant="outline" className="text-base">{formData.eve_assessment.anomaly_detection}/5</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Does this evidence contain unusual patterns, red flags, or inconsistencies? Signs of manipulation, deepfakes, doctored images, or suspicious metadata?
                    <strong className="text-red-600"> HIGH SCORE = HIGH DECEPTION RISK</strong>
                  </p>
                  <Slider
                    value={[formData.eve_assessment.anomaly_detection]}
                    onValueChange={([value]) => handleEVEChange('anomaly_detection', value)}
                    min={0}
                    max={5}
                    step={1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0 - No anomalies</span>
                    <span>3 - Some red flags</span>
                    <span>5 - Major anomalies detected</span>
                  </div>
                </div>

                {/* Assessment Notes */}
                <div>
                  <Label>Assessment Notes</Label>
                  <Textarea
                    value={formData.eve_assessment.notes}
                    onChange={(e) => handleEVEChange('notes', e.target.value)}
                    placeholder="Document specific red flags, concerns, verification attempts, or supporting evidence you've found..."
                    rows={4}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* SECTION 5: Organize (Tags & Priority) */}
          <Card>
            <CardHeader>
              <CardTitle>Organize</CardTitle>
              <CardDescription>Add tags and set priority for this evidence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tags</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add a tag..."
                  />
                  <Button onClick={addTag} size="sm" type="button">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
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
            </CardContent>
          </Card>

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
  )
}
