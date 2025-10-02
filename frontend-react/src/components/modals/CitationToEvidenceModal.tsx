import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SavedCitation } from '@/types/citations'
import { EvidenceType, EvidenceLevel, ConfidenceLevel, PriorityLevel } from '@/types/evidence'

interface CitationToEvidenceModalProps {
  citation: SavedCitation
  onClose: () => void
  onSuccess?: () => void
}

export function CitationToEvidenceModal({ citation, onClose, onSuccess }: CitationToEvidenceModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: citation.fields.title || '',
    what: '', // User must fill this (claim)
    who: citation.fields.authors.map(a => `${a.firstName} ${a.lastName}`).join(', '),
    when_occurred: citation.fields.year || '',
    where_location: citation.fields.url || '',
    evidence_type: 'document' as const,
    evidence_level: 'tactical' as const,
    credibility: '3',
    reliability: '3',
    confidence_level: 'medium' as const,
    tags: citation.tags || [],
    priority: 'normal' as const,
    notes: citation.notes || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.what.trim()) {
      alert('Please enter a claim (What field)')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/evidence-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: `Citation: ${citation.citation}`,
          who: formData.who,
          what: formData.what,
          when_occurred: formData.when_occurred,
          where_location: formData.where_location,
          evidence_type: formData.evidence_type,
          evidence_level: formData.evidence_level,
          credibility: formData.credibility,
          reliability: formData.reliability,
          confidence_level: formData.confidence_level,
          tags: formData.tags,
          priority: formData.priority,
          status: 'pending',
          is_public: false,
          created_by: 1
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Evidence created successfully! ID: ${data.id}`)
        onSuccess?.()
        onClose()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create evidence')
      }
    } catch (error: any) {
      console.error('Failed to create evidence:', error)
      alert(`Failed to create evidence: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Evidence from Citation
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Citation Preview */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Source Citation
            </Label>
            <p className="text-sm mt-1 text-gray-900 dark:text-white">
              {citation.citation}
            </p>
          </div>

          {/* Title (pre-filled) */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          {/* Claim/What (REQUIRED - must be filled by user) */}
          <div className="space-y-2">
            <Label htmlFor="what" className="flex items-center gap-2">
              Claim / What <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="what"
              placeholder="Enter the claim or assertion this evidence supports..."
              value={formData.what}
              onChange={(e) => setFormData({ ...formData, what: e.target.value })}
              className="min-h-24"
              required
            />
            <p className="text-xs text-gray-500">
              What does this source claim or assert?
            </p>
          </div>

          {/* Who (pre-filled with authors) */}
          <div className="space-y-2">
            <Label htmlFor="who">Who (Author/Entity)</Label>
            <Input
              id="who"
              value={formData.who}
              onChange={(e) => setFormData({ ...formData, who: e.target.value })}
            />
          </div>

          {/* Grid: Type & Level */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Evidence Type</Label>
              <Select
                value={formData.evidence_type}
                onValueChange={(v) => setFormData({ ...formData, evidence_type: v as any })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EvidenceType.DOCUMENT}>Document</SelectItem>
                  <SelectItem value={EvidenceType.OPEN_SOURCE}>Open Source</SelectItem>
                  <SelectItem value={EvidenceType.DIGITAL}>Digital</SelectItem>
                  <SelectItem value={EvidenceType.OBSERVATION}>Observation</SelectItem>
                  <SelectItem value={EvidenceType.TESTIMONY}>Testimony</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Evidence Level</Label>
              <Select
                value={formData.evidence_level}
                onValueChange={(v) => setFormData({ ...formData, evidence_level: v as any })}
              >
                <SelectTrigger id="level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EvidenceLevel.TACTICAL}>Tactical</SelectItem>
                  <SelectItem value={EvidenceLevel.OPERATIONAL}>Operational</SelectItem>
                  <SelectItem value={EvidenceLevel.STRATEGIC}>Strategic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid: Confidence & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence Level</Label>
              <Select
                value={formData.confidence_level}
                onValueChange={(v) => setFormData({ ...formData, confidence_level: v as any })}
              >
                <SelectTrigger id="confidence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ConfidenceLevel.LOW}>Low</SelectItem>
                  <SelectItem value={ConfidenceLevel.MEDIUM}>Medium</SelectItem>
                  <SelectItem value={ConfidenceLevel.HIGH}>High</SelectItem>
                  <SelectItem value={ConfidenceLevel.CONFIRMED}>Confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v as any })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PriorityLevel.LOW}>Low</SelectItem>
                  <SelectItem value={PriorityLevel.NORMAL}>Normal</SelectItem>
                  <SelectItem value={PriorityLevel.HIGH}>High</SelectItem>
                  <SelectItem value={PriorityLevel.CRITICAL}>Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid: Credibility & Reliability */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="credibility">Credibility (1-6)</Label>
              <Select
                value={formData.credibility}
                onValueChange={(v) => setFormData({ ...formData, credibility: v })}
              >
                <SelectTrigger id="credibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Confirmed Reliable</SelectItem>
                  <SelectItem value="2">2 - Usually Reliable</SelectItem>
                  <SelectItem value="3">3 - Fairly Reliable</SelectItem>
                  <SelectItem value="4">4 - Not Usually Reliable</SelectItem>
                  <SelectItem value="5">5 - Unreliable</SelectItem>
                  <SelectItem value="6">6 - Cannot be Judged</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reliability">Reliability (1-6)</Label>
              <Select
                value={formData.reliability}
                onValueChange={(v) => setFormData({ ...formData, reliability: v })}
              >
                <SelectTrigger id="reliability">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Confirmed</SelectItem>
                  <SelectItem value="2">2 - Probably True</SelectItem>
                  <SelectItem value="3">3 - Possibly True</SelectItem>
                  <SelectItem value="4">4 - Doubtful</SelectItem>
                  <SelectItem value="5">5 - Improbable</SelectItem>
                  <SelectItem value="6">6 - Cannot be Judged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this evidence..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="min-h-20"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.what.trim()}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Evidence'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
