import { useState, useEffect, useCallback } from 'react'
import { X, Plus, AlertTriangle, CheckCircle2, Shield, Users, Link, ChevronDown, FileText, Globe, Save } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { getCopHeaders } from '@/lib/cop-auth'
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

const DEFAULT_FORM_DATA: EvidenceFormData = {
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
  citations: [],
  linked_actors: []
}

export function EvidenceItemForm({
  open,
  onClose,
  onSave,
  initialData,
  mode
}: EvidenceItemFormProps) {
  const [saving, setSaving] = useState(false)
  const [saveAndAddAnother, setSaveAndAddAnother] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [actors, setActors] = useState<Array<{ id: string; name: string }>>([])
  const [loadingActors, setLoadingActors] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const [formData, setFormData] = useState<EvidenceFormData>({ ...DEFAULT_FORM_DATA })

  // Load actors for selection
  useEffect(() => {
    const controller = new AbortController()
    const loadActors = async () => {
      setLoadingActors(true)
      try {
        const workspaceId = localStorage.getItem('omnicore_workspace_id') || localStorage.getItem('current_workspace_id')
        const wsParam = workspaceId ? `?workspace_id=${workspaceId}` : ''
        const response = await fetch(`/api/actors${wsParam}`, {
          headers: getCopHeaders(),
          signal: controller.signal,
        })
        if (response.ok) {
          const data = await response.json()
          setActors((data?.actors || []).map((a: any) => ({ id: a.id, name: a.name })))
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError') console.error('Failed to load actors:', error)
      } finally {
        setLoadingActors(false)
      }
    }
    loadActors()
    return () => controller.abort()
  }, [])

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
        } : { ...DEFAULT_FORM_DATA.eve_assessment! },
        tags: initialData.tags || [],
        priority: initialData.priority,
        linked_actors: initialData.linked_actors || []
      })
    } else {
      setFormData({ ...DEFAULT_FORM_DATA })
    }
  }, [initialData, open])

  const handleChange = useCallback((field: keyof EvidenceFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleEVEChange = useCallback((field: keyof NonNullable<EvidenceFormData['eve_assessment']>, value: any) => {
    setFormData(prev => ({
      ...prev,
      eve_assessment: {
        ...prev.eve_assessment!,
        [field]: value
      }
    }))
  }, [])

  const addTag = useCallback(() => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleChange('tags', [...formData.tags, newTag.trim()])
      setNewTag('')
    }
  }, [newTag, formData.tags, handleChange])

  const removeTag = useCallback((tag: string) => {
    handleChange('tags', formData.tags.filter(t => t !== tag))
  }, [formData.tags, handleChange])

  const calculateEVERisk = () => {
    if (!formData.eve_assessment) return 'UNKNOWN'
    const { internal_consistency, external_corroboration, anomaly_detection } = formData.eve_assessment
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
      case 'LOW': return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800'
      case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800'
      case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
      default: return 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
    }
  }

  // Check if EVE has been modified from defaults
  const hasEVEData = formData.eve_assessment &&
    (formData.eve_assessment.internal_consistency !== 3 ||
     formData.eve_assessment.external_corroboration !== 3 ||
     formData.eve_assessment.anomaly_detection !== 0 ||
     formData.eve_assessment.notes !== '')

  const handleSubmit = async (andAddAnother: boolean = false) => {
    if (!formData.title.trim()) {
      alert('Please provide a title')
      return
    }

    setSaving(true)
    setSaveAndAddAnother(andAddAnother)
    try {
      const dataToSave = {
        ...formData,
        eve_assessment: hasEVEData && formData.eve_assessment ? {
          ...formData.eve_assessment,
          assessed_at: new Date().toISOString(),
          overall_risk: calculateEVERisk()
        } : undefined
      }

      await onSave(dataToSave as EvidenceFormData)

      if (andAddAnother) {
        // Reset form but keep dialog open
        setFormData({ ...DEFAULT_FORM_DATA })
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 2000)
      } else {
        onClose()
      }
    } catch (error) {
      console.error('Failed to save evidence:', error)
      alert('Failed to save evidence. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Count filled optional fields for section badges
  const detailsCount = [formData.who, formData.what, formData.when_occurred, formData.where_location, formData.why_purpose, formData.how_method].filter(Boolean).length
  const sourceCount = [formData.source_name, formData.source_url].filter(Boolean).length
  const organizeCount = formData.tags.length + (formData.linked_actors?.length || 0) + (formData.priority !== 'normal' ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {mode === 'create' ? 'Add Evidence' : 'Edit Evidence'}
          </DialogTitle>
        </DialogHeader>

        {/* Success flash */}
        {justSaved && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg text-sm animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            Evidence saved! Add another below.
          </div>
        )}

        <div className="space-y-4">
          {/* === CORE FIELDS (always visible) === */}
          <div className="space-y-3">
            <div>
              <Input
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="What is this evidence? (title)"
                className="text-base font-medium h-11"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey && formData.title.trim()) {
                    e.preventDefault()
                    handleSubmit(false)
                  }
                }}
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={formData.source_url}
                  onChange={(e) => handleChange('source_url', e.target.value)}
                  placeholder="Source URL (optional)"
                  className="pl-9"
                />
              </div>
              <Select value={formData.evidence_type} onValueChange={(value) => handleChange('evidence_type', value)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Type" />
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
            </div>

            <Textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Description (optional) — what does this evidence show?"
              rows={2}
              className="resize-none"
            />
          </div>

          {/* === EXPANDABLE DETAIL SECTIONS === */}
          <Accordion type="multiple" className="w-full">
            {/* Source & Credibility */}
            <AccordionItem value="source">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span>Source & Credibility</span>
                  {sourceCount > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{sourceCount}</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Source Name</Label>
                    <Input
                      value={formData.source_name}
                      onChange={(e) => handleChange('source_name', e.target.value)}
                      placeholder="Publication, person, agency..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Source Classification</Label>
                    <Select value={formData.source_classification} onValueChange={(value) => handleChange('source_classification', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SourceClassificationEnum).map(([key, value]) => (
                          <SelectItem key={value} value={value}>{key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Information Credibility</Label>
                    <Select value={formData.credibility} onValueChange={(value) => handleChange('credibility', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Confirmed</SelectItem>
                        <SelectItem value="2">2 - Probably true</SelectItem>
                        <SelectItem value="3">3 - Possibly true</SelectItem>
                        <SelectItem value="4">4 - Doubtful</SelectItem>
                        <SelectItem value="5">5 - Improbable</SelectItem>
                        <SelectItem value="6">6 - Cannot judge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Source Reliability</Label>
                    <Select value={formData.reliability} onValueChange={(value) => handleChange('reliability', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A - Completely reliable</SelectItem>
                        <SelectItem value="B">B - Usually reliable</SelectItem>
                        <SelectItem value="C">C - Fairly reliable</SelectItem>
                        <SelectItem value="D">D - Not usually reliable</SelectItem>
                        <SelectItem value="E">E - Unreliable</SelectItem>
                        <SelectItem value="F">F - Cannot judge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 5 W's + How */}
            <AccordionItem value="details">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  <span>Details (5W's + How)</span>
                  {detailsCount > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{detailsCount}/6</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Who</Label>
                    <Input
                      value={formData.who}
                      onChange={(e) => handleChange('who', e.target.value)}
                      placeholder="Person, entity, actor..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">What</Label>
                    <Input
                      value={formData.what}
                      onChange={(e) => handleChange('what', e.target.value)}
                      placeholder="What happened..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">When</Label>
                    <Input
                      value={formData.when_occurred}
                      onChange={(e) => handleChange('when_occurred', e.target.value)}
                      placeholder="Date/time..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Where</Label>
                    <Input
                      value={formData.where_location}
                      onChange={(e) => handleChange('where_location', e.target.value)}
                      placeholder="Location..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Why</Label>
                    <Input
                      value={formData.why_purpose}
                      onChange={(e) => handleChange('why_purpose', e.target.value)}
                      placeholder="Purpose or reason..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">How</Label>
                    <Input
                      value={formData.how_method}
                      onChange={(e) => handleChange('how_method', e.target.value)}
                      placeholder="Method or process..."
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* EVE Deception Assessment */}
            <AccordionItem value="eve">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span>Authenticity (EVE)</span>
                  {hasEVEData && (
                    <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 ${getRiskColor(calculateEVERisk())}`}>
                      {calculateEVERisk()}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                {formData.eve_assessment && (
                  <>
                    {hasEVEData && (
                      <div className={`p-3 rounded-lg border ${getRiskColor(calculateEVERisk())}`}>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {calculateEVERisk() === 'LOW' && <CheckCircle2 className="h-4 w-4" />}
                          {calculateEVERisk() === 'MEDIUM' && <Shield className="h-4 w-4" />}
                          {(calculateEVERisk() === 'HIGH' || calculateEVERisk() === 'CRITICAL') && <AlertTriangle className="h-4 w-4" />}
                          Deception Risk: {calculateEVERisk()}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Internal Consistency</Label>
                        <span className="text-xs font-mono">{formData.eve_assessment.internal_consistency}/5</span>
                      </div>
                      <Slider
                        value={[formData.eve_assessment.internal_consistency]}
                        onValueChange={([value]) => handleEVEChange('internal_consistency', value)}
                        min={0} max={5} step={1}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Contradictory</span>
                        <span>Consistent</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">External Corroboration</Label>
                        <span className="text-xs font-mono">{formData.eve_assessment.external_corroboration}/5</span>
                      </div>
                      <Slider
                        value={[formData.eve_assessment.external_corroboration]}
                        onValueChange={([value]) => handleEVEChange('external_corroboration', value)}
                        min={0} max={5} step={1}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>No corroboration</span>
                        <span>Multiple sources</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Anomaly Detection</Label>
                        <span className="text-xs font-mono">{formData.eve_assessment.anomaly_detection}/5</span>
                      </div>
                      <Slider
                        value={[formData.eve_assessment.anomaly_detection]}
                        onValueChange={([value]) => handleEVEChange('anomaly_detection', value)}
                        min={0} max={5} step={1}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>No anomalies</span>
                        <span>Major anomalies</span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Assessment Notes</Label>
                      <Textarea
                        value={formData.eve_assessment.notes}
                        onChange={(e) => handleEVEChange('notes', e.target.value)}
                        placeholder="Red flags, verification attempts, concerns..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Organize: Tags, Priority, Actors */}
            <AccordionItem value="organize">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span>Tags, Priority & Actors</span>
                  {organizeCount > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{organizeCount}</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {/* Tags */}
                <div>
                  <Label className="text-xs text-muted-foreground">Tags</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                      placeholder="Add tag..."
                      className="flex-1"
                    />
                    <Button onClick={addTag} size="sm" type="button" variant="outline">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formData.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="cursor-pointer text-xs" onClick={() => removeTag(tag)}>
                          {tag}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <Label className="text-xs text-muted-foreground">Priority</Label>
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

                {/* Linked Actors */}
                <div>
                  <Label className="text-xs text-muted-foreground">Linked Actors</Label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && !formData.linked_actors?.includes(value)) {
                        handleChange('linked_actors', [...(formData.linked_actors || []), value])
                      }
                    }}
                    disabled={loadingActors || actors.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingActors ? "Loading..." : actors.length === 0 ? "No actors" : "Link an actor..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {actors
                        .filter(actor => !formData.linked_actors?.includes(actor.id))
                        .map(actor => (
                          <SelectItem key={actor.id} value={actor.id}>{actor.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {(formData.linked_actors?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formData.linked_actors?.map(actorId => {
                        const actor = actors.find(a => a.id === actorId)
                        return (
                          <Badge key={actorId} variant="secondary" className="cursor-pointer text-xs" onClick={() => {
                            handleChange('linked_actors', formData.linked_actors?.filter(id => id !== actorId) || [])
                          }}>
                            {actor?.name || actorId}
                            <X className="h-3 w-3 ml-1" />
                          </Badge>
                        )
                      })}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* === ACTION BAR === */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {mode === 'create' ? 'Cmd+Enter to save' : ''}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              {mode === 'create' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSubmit(true)}
                  disabled={saving || !formData.title.trim()}
                >
                  {saving && saveAndAddAnother ? 'Saving...' : 'Save & Add Another'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleSubmit(false)}
                disabled={saving || !formData.title.trim()}
              >
                {saving && !saveAndAddAnother ? 'Saving...' : mode === 'create' ? 'Save Evidence' : 'Update'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
