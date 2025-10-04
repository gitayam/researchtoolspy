import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, FileText, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { EvidenceItem } from '@/types/evidence'
import { EvidenceItemForm } from '@/components/evidence/EvidenceItemForm'
import { cn } from '@/lib/utils'

interface ACHEvidenceManagerProps {
  analysisId?: string  // If provided, we'll load linked evidence
  selectedEvidence: string[]  // Array of evidence IDs
  onEvidenceChange: (evidenceIds: string[]) => void
}

export function ACHEvidenceManager({
  analysisId,
  selectedEvidence,
  onEvidenceChange
}: ACHEvidenceManagerProps) {
  const [allEvidence, setAllEvidence] = useState<EvidenceItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showSelector, setShowSelector] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadEvidence()
  }, [])

  const loadEvidence = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/evidence-items')
      if (response.ok) {
        const data = await response.json()
        setAllEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Failed to load evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvidence = async (formData: any) => {
    try {
      const response = await fetch('/api/evidence-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Evidence</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Link evidence from your library or create new evidence items
            </p>
          </div>
          <div className="flex gap-2">
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
      </CardHeader>
      <CardContent>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 flex-shrink-0"
                      onClick={() => handleRemoveEvidence(String(evidence.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Evidence Selector Dialog */}
      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Evidence from Library</DialogTitle>
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
    </Card>
  )
}
