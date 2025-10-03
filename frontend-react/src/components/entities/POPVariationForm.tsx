import { useState } from 'react'
import { Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import type { POPVariation, POPAssessment } from '@/types/entities'

interface POPVariationFormProps {
  variation?: POPVariation
  onSubmit: (data: POPVariation) => void
  onCancel: () => void
}

export function POPVariationForm({
  variation,
  onSubmit,
  onCancel
}: POPVariationFormProps) {
  const isEditing = !!variation

  const [formData, setFormData] = useState<POPVariation>({
    topic: variation?.topic || '',
    assessment: variation?.assessment || {
      historical_pattern: 0,
      sophistication_level: 0,
      success_rate: 0,
      notes: '',
      assessed_at: new Date().toISOString()
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      assessment: {
        ...formData.assessment,
        assessed_at: new Date().toISOString()
      }
    })
  }

  const getScoreLabel = (score: number) => {
    if (score === 0) return 'None/Unknown'
    if (score === 1) return 'Very Low'
    if (score === 2) return 'Low'
    if (score === 3) return 'Medium'
    if (score === 4) return 'High'
    if (score === 5) return 'Very High'
    return 'Unknown'
  }

  const updateAssessment = (field: keyof POPAssessment, value: any) => {
    setFormData({
      ...formData,
      assessment: {
        ...formData.assessment,
        [field]: value
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit POP Variation' : 'Add Topic-Based POP Variation'}</CardTitle>
          <CardDescription>
            Define behavioral patterns specific to a particular domain or topic
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic/Domain *</Label>
            <Input
              id="topic"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g., Cyber Operations, Social Engineering, Financial Fraud"
              required
            />
            <p className="text-xs text-gray-500">
              What specific area or domain does this behavioral pattern cover?
            </p>
          </div>

          {/* POP Scores Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-semibold">Pattern of Practice Scores (0-5 scale)</h3>

            {/* Historical Pattern */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Historical Pattern Consistency</Label>
                <span className="text-sm font-semibold">
                  {formData.assessment.historical_pattern}/5 - {getScoreLabel(formData.assessment.historical_pattern)}
                </span>
              </div>
              <Slider
                value={[formData.assessment.historical_pattern]}
                onValueChange={([value]) => updateAssessment('historical_pattern', value)}
                min={0}
                max={5}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                How consistent are their deception patterns over time in this domain?
              </p>
            </div>

            {/* Sophistication Level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Sophistication Level</Label>
                <span className="text-sm font-semibold">
                  {formData.assessment.sophistication_level}/5 - {getScoreLabel(formData.assessment.sophistication_level)}
                </span>
              </div>
              <Slider
                value={[formData.assessment.sophistication_level]}
                onValueChange={([value]) => updateAssessment('sophistication_level', value)}
                min={0}
                max={5}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                How advanced is their tradecraft and technique execution in this domain?
              </p>
            </div>

            {/* Success Rate */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Historical Success Rate</Label>
                <span className="text-sm font-semibold">
                  {formData.assessment.success_rate}/5 - {getScoreLabel(formData.assessment.success_rate)}
                </span>
              </div>
              <Slider
                value={[formData.assessment.success_rate]}
                onValueChange={([value]) => updateAssessment('success_rate', value)}
                min={0}
                max={5}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                How often do they succeed without detection in this domain?
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Assessment Notes</Label>
            <Textarea
              id="notes"
              value={formData.assessment.notes}
              onChange={(e) => updateAssessment('notes', e.target.value)}
              placeholder="Observable patterns, specific techniques used, notable incidents..."
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Update Variation' : 'Add Variation'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
