import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EvidenceType, EvidenceLevel, PriorityLevel } from '@/types/evidence'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface QuickEvidenceFormProps {
  onSave: (data: any) => Promise<void>
  onCancel: () => void
  contextData?: {
    section?: string
    framework?: string
    [key: string]: any
  }
}

function getPrefilledData(contextData?: any) {
  if (!contextData) return {}

  const prefilled: any = {}

  // Pre-fill "what" based on section context
  if (contextData.section) {
    prefilled.what = `Related to ${contextData.section} section`
  }

  // Pre-fill tags based on framework
  if (contextData.framework) {
    prefilled.tags = [contextData.framework]
  }

  return prefilled
}

export function QuickEvidenceForm({
  onSave,
  onCancel,
  contextData
}: QuickEvidenceFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    evidence_type: 'observation' as EvidenceType,
    evidence_level: 'tactical' as EvidenceLevel,
    priority: 'normal' as PriorityLevel,
    tags: [] as string[],
    ...getPrefilledData(contextData)
  })
  const [showAllFields, setShowAllFields] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSave(formData)
    } catch (err: any) {
      setError(err.message || 'Failed to create evidence')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Required Fields */}
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={e => setFormData({...formData, title: e.target.value})}
          placeholder="Brief title for this evidence"
          required
          disabled={loading}
        />
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={e => setFormData({...formData, description: e.target.value})}
          placeholder="Detailed description of the evidence"
          rows={3}
          required
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="evidence-type">Type *</Label>
          <Select
            value={formData.evidence_type}
            onValueChange={val => setFormData({...formData, evidence_type: val as EvidenceType})}
            disabled={loading}
          >
            <SelectTrigger id="evidence-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(EvidenceType).map(type => (
                <SelectItem key={type} value={type}>
                  {type.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="evidence-level">Level *</Label>
          <Select
            value={formData.evidence_level}
            onValueChange={val => setFormData({...formData, evidence_level: val as EvidenceLevel})}
            disabled={loading}
          >
            <SelectTrigger id="evidence-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(EvidenceLevel).map(level => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={formData.priority}
            onValueChange={val => setFormData({...formData, priority: val as PriorityLevel})}
            disabled={loading}
          >
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(PriorityLevel).map(priority => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expandable: 5 W's + How */}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAllFields(!showAllFields)}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          disabled={loading}
        >
          {showAllFields ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Hide additional fields (5 W's + How)
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Show additional fields (5 W's + How)
            </>
          )}
        </Button>
      </div>

      {showAllFields && (
        <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
          <div>
            <Label htmlFor="who">Who</Label>
            <Input
              id="who"
              value={formData.who || ''}
              onChange={e => setFormData({...formData, who: e.target.value})}
              placeholder="Person(s) involved"
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="what">What</Label>
            <Input
              id="what"
              value={formData.what || ''}
              onChange={e => setFormData({...formData, what: e.target.value})}
              placeholder="What happened"
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="when">When</Label>
            <Input
              id="when"
              type="date"
              value={formData.when_occurred || ''}
              onChange={e => setFormData({...formData, when_occurred: e.target.value})}
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="where">Where</Label>
            <Input
              id="where"
              value={formData.where_location || ''}
              onChange={e => setFormData({...formData, where_location: e.target.value})}
              placeholder="Location"
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="why">Why</Label>
            <Input
              id="why"
              value={formData.why_purpose || ''}
              onChange={e => setFormData({...formData, why_purpose: e.target.value})}
              placeholder="Purpose/significance"
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="how">How</Label>
            <Input
              id="how"
              value={formData.how_method || ''}
              onChange={e => setFormData({...formData, how_method: e.target.value})}
              placeholder="Method/process"
              disabled={loading}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create & Link'}
        </Button>
      </div>
    </form>
  )
}
