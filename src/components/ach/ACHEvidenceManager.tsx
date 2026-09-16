import { useState, useEffect } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import { Plus, Search, Trash2, FileText, ExternalLink, CheckCircle2, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { EvidenceItem } from '@/types/evidence'
import { EvidenceItemForm } from '@/components/evidence/EvidenceItemForm'
import { cn } from '@/lib/utils'

interface ACHEvidenceManagerProps {
  analysisId?: string  // If provided, we'll load linked evidence
  /** The workspace the analysis itself lives in. ACH endpoints scope with
   *  `WHERE id = ? AND user_id = ? AND workspace_id = ?`, so every call about a
   *  given analysis has to name that analysis's workspace -- not whatever the
   *  workspace picker happens to hold. Sending the wrong one answers
   *  "Analysis not found in workspace" (404), which reads as a broken button. */
  workspaceId?: string
  selectedEvidence: string[]  // Array of evidence IDs
  /** Render without the surrounding Card and its heading. A dialog already
   *  supplies a title and description, so the card's own "Evidence" header
   *  repeated them inside a second nested card. */
  embedded?: boolean
  onEvidenceChange: (evidenceIds: string[]) => void
}

export function ACHEvidenceManager({
  analysisId,
  workspaceId,
  selectedEvidence,
  onEvidenceChange,
  embedded = false
}: ACHEvidenceManagerProps) {
  // Pin every evidence call to the analysis's workspace when we know it.
  const scopedHeaders = () => {
    const headers = getCopHeaders()
    if (workspaceId) headers['X-Workspace-ID'] = String(workspaceId)
    return headers
  }
  const [allEvidence, setAllEvidence] = useState<EvidenceItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showSelector, setShowSelector] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEvidence, setEditingEvidence] = useState<EvidenceItem | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    loadEvidence(controller.signal)
    return () => controller.abort()
  }, [])

  const loadEvidence = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const response = await fetch(
        workspaceId
          ? `/api/evidence-items?workspace_id=${encodeURIComponent(workspaceId)}`
          : '/api/evidence-items',
        { headers: scopedHeaders(), signal }
      )
      if (response.ok) {
        const data = await response.json()
        setAllEvidence(data.evidence || [])
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') console.error('Failed to load evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvidence = async (formData: any) => {
    try {
      const response = await fetch('/api/evidence-items', {
        method: 'POST',
        headers: scopedHeaders(),
        body: JSON.stringify(formData)
      })
      if (!response.ok) throw new Error('Failed to create evidence')

      const newEvidence = await response.json()
      await loadEvidence()

      // Auto-select the newly created evidence
      onEvidenceChange([...selectedEvidence, String(newEvidence.id)])
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating evidence:', error)
      throw error
    }
  }

  const handleEditEvidence = async (formData: any) => {
    if (!editingEvidence) return

    try {
      const response = await fetch(`/api/evidence-items?id=${editingEvidence.id}`, {
        method: 'PUT',
        headers: scopedHeaders(),
        body: JSON.stringify(formData)
      })
      if (!response.ok) throw new Error('Failed to update evidence')

      await loadEvidence()
      setEditingEvidence(null)
    } catch (error) {
      console.error('Error updating evidence:', error)
      throw error
    }
  }

  const handleToggleEvidence = (evidenceId: string) => {
    if (selectedEvidence.includes(evidenceId)) {
      onEvidenceChange(selectedEvidence.filter(id => id !== evidenceId))
    } else {
      onEvidenceChange([...selectedEvidence, evidenceId])
    }
  }

  const handleRemoveEvidence = (evidenceId: string) => {
    onEvidenceChange(selectedEvidence.filter(id => id !== evidenceId))
  }

  const getSelectedEvidenceItems = () => {
    return allEvidence.filter(e => selectedEvidence.includes(String(e.id)))
  }

  const filteredEvidence = allEvidence.filter(e => {
    const matchesSearch = searchTerm === '' ||
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesSearch
  })

  const selectedItems = getSelectedEvidenceItems()

  // Static element types on purpose: swapping the component identity per render
  // would remount this subtree and drop focus inside the create/edit form.
  const Shell = embedded ? 'div' : Card
  const HeaderRow = embedded ? 'div' : CardHeader
  const BodyRow = embedded ? 'div' : CardContent

  return (
    <Shell className={embedded ? 'space-y-4' : undefined}>
      <HeaderRow className={embedded ? 'pb-2' : undefined}>
        <div className={cn('flex items-center justify-between gap-4', embedded && 'flex-wrap')}>
          {!embedded && (
            <div>
              <CardTitle>Evidence</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Link evidence from your library or create new evidence items
              </p>
            </div>
          )}
          <div className={cn('flex gap-2', embedded && 'ml-auto')}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSelector(true)}
            >
              <Search className="h-4 w-4 mr-2" />
              Browse Library
            </Button>
          </div>
        </div>
      </HeaderRow>
      <BodyRow>
        {selectedItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-lg">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No evidence linked yet</p>
            <p className="text-sm mt-1">Add evidence from your library or create new items</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedItems.map(evidence => (
              <div
                key={evidence.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{evidence.title}</h4>
                      {evidence.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {evidence.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {evidence.evidence_type.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {evidence.confidence_level}
                        </Badge>
                        {evidence.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => setEditingEvidence(evidence)}
                        title="Edit evidence"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleRemoveEvidence(String(evidence.id))}
                        title="Remove from analysis"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </BodyRow>

      {/* Evidence Selector Dialog */}
      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Evidence from Library</DialogTitle>
            <DialogDescription>
              Pick existing evidence items to weigh against this analysis&rsquo;s hypotheses.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="mb-4">
              <Input
                placeholder="Search evidence by title, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading evidence...</div>
              ) : filteredEvidence.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No evidence found matching your search' : 'No evidence in library yet'}
                </div>
              ) : (
                filteredEvidence.map(evidence => {
                  const isSelected = selectedEvidence.includes(String(evidence.id))
                  return (
                    <div
                      key={evidence.id}
                      onClick={() => handleToggleEvidence(String(evidence.id))}
                      className={cn(
                        "p-3 rounded-lg border-2 cursor-pointer transition-colors",
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          isSelected
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300 dark:border-gray-600"
                        )}>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{evidence.title}</h4>
                          {evidence.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {evidence.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {evidence.evidence_type.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Credibility: {evidence.credibility}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {evidence.confidence_level}
                            </Badge>
                            {evidence.source_url && (
                              <Badge variant="outline" className="text-xs">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Source
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedEvidence.length} evidence item{selectedEvidence.length !== 1 ? 's' : ''} selected
              </p>
              <Button onClick={() => setShowSelector(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Evidence Dialog */}
      {showCreateForm && (
        <EvidenceItemForm
          open={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSave={handleCreateEvidence}
          mode="create"
        />
      )}

      {/* Edit Evidence Dialog */}
      {editingEvidence && (
        <EvidenceItemForm
          open={!!editingEvidence}
          onClose={() => setEditingEvidence(null)}
          onSave={handleEditEvidence}
          initialData={editingEvidence}
          mode="edit"
        />
      )}
    </Shell>
  )
}
