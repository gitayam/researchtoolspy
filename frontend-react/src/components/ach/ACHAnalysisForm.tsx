import { useState, useEffect } from 'react'
import { X, Plus, GripVertical, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ACHAnalysis, ACHHypothesis, ScaleType, AnalysisStatus } from '@/types/ach'
import { ACHEvidenceManager } from './ACHEvidenceManager'

interface ACHAnalysisFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: ACHFormData) => Promise<void>
  initialData?: ACHAnalysis
  mode: 'create' | 'edit'
}

export interface ACHFormData {
  title: string
  description?: string
  question: string
  analyst?: string
  organization?: string
  scale_type: ScaleType
  status: AnalysisStatus
  hypotheses: Array<{
    id?: string
    text: string
    rationale?: string
    source?: string
    order_num: number
  }>
  evidence_ids?: string[]  // Evidence to link to this analysis
}

export function ACHAnalysisForm({
  open,
  onClose,
  onSave,
  initialData,
  mode
}: ACHAnalysisFormProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<ACHFormData>({
    title: '',
    description: '',
    question: '',
    analyst: '',
    organization: '',
    scale_type: 'logarithmic',
    status: 'draft',
    hypotheses: [],
    evidence_ids: []
  })
  const [newHypothesis, setNewHypothesis] = useState('')

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title,
        description: initialData.description || '',
        question: initialData.question,
        analyst: initialData.analyst || '',
        organization: initialData.organization || '',
        scale_type: initialData.scale_type,
        status: initialData.status,
        hypotheses: initialData.hypotheses?.map(h => ({
          id: h.id,
          text: h.text,
          rationale: h.rationale,
          source: h.source,
          order_num: h.order_num
        })) || [],
        evidence_ids: initialData.evidence?.map(e => e.evidence_id) || []
      })
    } else {
      // Reset form for create mode
      setFormData({
        title: '',
        description: '',
        question: '',
        analyst: '',
        organization: '',
        scale_type: 'logarithmic',
        status: 'draft',
        hypotheses: [],
        evidence_ids: []
      })
    }
  }, [initialData, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.question.trim()) {
      alert('Title and question are required')
      return
    }

    if (formData.hypotheses.length < 2) {
      alert('Please add at least 2 hypotheses for analysis')
      return
    }

    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Failed to save analysis:', error)
      alert('Failed to save analysis. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addHypothesis = () => {
    if (!newHypothesis.trim()) return

    setFormData({
      ...formData,
      hypotheses: [
        ...formData.hypotheses,
        {
          text: newHypothesis,
          order_num: formData.hypotheses.length
        }
      ]
    })
    setNewHypothesis('')
  }

  const removeHypothesis = (index: number) => {
    setFormData({
      ...formData,
      hypotheses: formData.hypotheses.filter((_, i) => i !== index).map((h, i) => ({
        ...h,
        order_num: i
      }))
    })
  }

  const moveHypothesis = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= formData.hypotheses.length) return

    const newHypotheses = [...formData.hypotheses]
    const temp = newHypotheses[index]
    newHypotheses[index] = newHypotheses[newIndex]
    newHypotheses[newIndex] = temp

    // Update order_num
    newHypotheses.forEach((h, i) => {
      h.order_num = i
    })

    setFormData({ ...formData, hypotheses: newHypotheses })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create ACH Analysis' : 'Edit ACH Analysis'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Analysis Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Who was responsible for the cyber attack?"
                required
              />
            </div>

            <div>
              <Label htmlFor="question">Key Question *</Label>
              <Textarea
                id="question"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="The primary intelligence question this analysis seeks to answer"
                rows={2}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional context or background for this analysis"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="analyst">Analyst</Label>
                <Input
                  id="analyst"
                  value={formData.analyst}
                  onChange={(e) => setFormData({ ...formData, analyst: e.target.value })}
                  placeholder="Lead analyst name"
                />
              </div>
              <div>
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  placeholder="Agency or organization"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scale_type">Scoring Scale</Label>
                <Select
                  value={formData.scale_type}
                  onValueChange={(value) => setFormData({ ...formData, scale_type: value as ScaleType })}
                >
                  <SelectTrigger id="scale_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logarithmic">Logarithmic (Fibonacci: 1,3,5,8,13)</SelectItem>
                    <SelectItem value="linear">Linear (1-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as AnalysisStatus })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Hypotheses Manager - MUST COME FIRST per ACH methodology */}
          <Card>
            <CardHeader>
              <CardTitle>Competing Hypotheses</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add at least 2 hypotheses to analyze (minimum recommended: 3-5)
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Hypothesis */}
              <div className="flex gap-2">
                <Input
                  value={newHypothesis}
                  onChange={(e) => setNewHypothesis(e.target.value)}
                  placeholder="Enter a hypothesis..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addHypothesis()
                    }
                  }}
                />
                <Button type="button" onClick={addHypothesis}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {/* Hypothesis List */}
              <div className="space-y-2">
                {formData.hypotheses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No hypotheses added yet. Add at least 2 to begin analysis.
                  </div>
                ) : (
                  formData.hypotheses.map((hypothesis, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0"
                          onClick={() => moveHypothesis(index, 'up')}
                          disabled={index === 0}
                        >
                          ▲
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0"
                          onClick={() => moveHypothesis(index, 'down')}
                          disabled={index === formData.hypotheses.length - 1}
                        >
                          ▼
                        </Button>
                      </div>
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-sm">H{index + 1}:</span>
                          <p className="text-sm flex-1">{hypothesis.text}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeHypothesis(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Evidence Manager - Comes AFTER hypotheses per ACH methodology */}
          <ACHEvidenceManager
            analysisId={initialData?.id}
            selectedEvidence={formData.evidence_ids || []}
            onEvidenceChange={(evidenceIds) => setFormData({ ...formData, evidence_ids: evidenceIds })}
          />

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : mode === 'create' ? 'Create Analysis' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
