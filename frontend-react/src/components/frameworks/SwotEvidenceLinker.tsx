/**
 * SWOT Evidence Linker Component
 * Links evidence items to SWOT items (strengths, weaknesses, opportunities, threats)
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Link2, Search, Loader2, Database, ExternalLink, X } from 'lucide-react'

interface Evidence {
  id: string
  title: string
  source_type: string
  source_url?: string
  content_snippet?: string
  credibility_score?: number
}

interface SwotEvidenceLinkerProps {
  swotItemId: string
  swotItemType: 'strength' | 'weakness' | 'opportunity' | 'threat'
  frameworkId: string
  linkedEvidenceIds?: string[]
  onUpdate?: () => void
}

export function SwotEvidenceLinker({
  swotItemId,
  swotItemType,
  frameworkId,
  linkedEvidenceIds = [],
  onUpdate
}: SwotEvidenceLinkerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [linkedEvidence, setLinkedEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && linkedEvidenceIds.length > 0) {
      loadLinkedEvidence()
    }
  }, [isOpen, linkedEvidenceIds])

  const loadLinkedEvidence = async () => {
    try {
      setLoading(true)
      // Load full evidence details for linked IDs
      const response = await fetch(`/api/evidence/batch?ids=${linkedEvidenceIds.join(',')}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setLinkedEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Error loading linked evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchEvidence = async () => {
    if (!searchQuery.trim()) return

    try {
      setSearching(true)
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '20'
      })

      const response = await fetch(`/api/claims/search-evidence?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to search evidence')

      const data = await response.json()
      if (data.success) {
        // Filter out already linked evidence
        const filtered = (data.evidence || []).filter(
          (ev: Evidence) => !linkedEvidenceIds.includes(ev.id)
        )
        setEvidence(filtered)
      }
    } catch (error) {
      console.error('Error searching evidence:', error)
    } finally {
      setSearching(false)
    }
  }

  const linkEvidence = (evidenceId: string) => {
    // This will be handled by parent component updating the SWOT item
    const updatedIds = [...linkedEvidenceIds, evidenceId]
    onUpdate?.()
    setIsOpen(false)
  }

  const unlinkEvidence = (evidenceId: string) => {
    // This will be handled by parent component updating the SWOT item
    onUpdate?.()
  }

  const getCredibilityColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-600'
    if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    if (score >= 60) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
    if (score >= 40) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
    return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="h-4 w-4 mr-2" />
          {linkedEvidenceIds.length > 0
            ? `Evidence (${linkedEvidenceIds.length})`
            : 'Link Evidence'}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Evidence to {swotItemType.charAt(0).toUpperCase() + swotItemType.slice(1)}</DialogTitle>
          <DialogDescription>
            Add supporting evidence to validate this SWOT item and increase confidence.
          </DialogDescription>
        </DialogHeader>

        {/* Linked Evidence */}
        {linkedEvidence.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Linked Evidence ({linkedEvidence.length})</h4>
            {linkedEvidence.map((ev) => (
              <Card key={ev.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{ev.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {ev.source_type}
                        {ev.credibility_score !== undefined && (
                          <Badge className={`ml-2 text-xs ${getCredibilityColor(ev.credibility_score)}`}>
                            Credibility: {ev.credibility_score}
                          </Badge>
                        )}
                      </div>
                      {ev.source_url && (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                        >
                          View Source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unlinkEvidence(ev.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Search Evidence</h4>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search evidence by title, source, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchEvidence()}
                className="pl-10"
              />
            </div>
            <Button onClick={searchEvidence} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {/* Search Results */}
          {evidence.length > 0 && (
            <div className="space-y-2 mt-4">
              <h5 className="text-sm text-muted-foreground">Results ({evidence.length})</h5>
              {evidence.map((ev) => (
                <Card key={ev.id} className="cursor-pointer hover:bg-accent transition-colors">
                  <CardContent className="p-3" onClick={() => linkEvidence(ev.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{ev.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {ev.source_type}
                          {ev.credibility_score !== undefined && (
                            <Badge className={`ml-2 text-xs ${getCredibilityColor(ev.credibility_score)}`}>
                              Credibility: {ev.credibility_score}
                            </Badge>
                          )}
                        </div>
                        {ev.content_snippet && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {ev.content_snippet}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && evidence.length === 0 && searchQuery && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No evidence found. Try a different search term.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
