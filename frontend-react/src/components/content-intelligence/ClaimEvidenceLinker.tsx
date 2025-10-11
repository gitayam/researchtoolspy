/**
 * Claim Evidence Linker Component
 * Allows users to link evidence items to claims with relationship types
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Link2,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  Trash2,
  ExternalLink,
  FileText
} from 'lucide-react'

interface Evidence {
  id: string
  title: string
  source_type: string
  source_url?: string
  content_snippet?: string
  credibility_score?: number
  bias_rating?: string
  tags: string[]
}

interface EvidenceLink {
  link_id: string
  relationship: 'supports' | 'contradicts' | 'provides_context'
  relevance_score: number
  confidence: number
  notes?: string
  evidence_id: string
  title: string
  source_type: string
  source_url?: string
  content_snippet?: string
  credibility_score?: number
}

interface ClaimEvidenceLinkerProps {
  claimAdjustmentId: string
  onLinked?: () => void
}

export function ClaimEvidenceLinker({ claimAdjustmentId, onLinked }: ClaimEvidenceLinkerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [linkedEvidence, setLinkedEvidence] = useState<EvidenceLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)

  // Linking state
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [relationship, setRelationship] = useState<'supports' | 'contradicts' | 'provides_context'>('supports')
  const [relevanceScore, setRelevanceScore] = useState(75)
  const [confidence, setConfidence] = useState(75)
  const [notes, setNotes] = useState('')
  const [linking, setLinking] = useState(false)

  // Load linked evidence when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadLinkedEvidence()
    }
  }, [isOpen])

  const loadLinkedEvidence = async () => {
    try {
      setLoadingLinks(true)
      const response = await fetch(`/api/claims/get-evidence-links/${claimAdjustmentId}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to load linked evidence')

      const data = await response.json()
      if (data.success) {
        setLinkedEvidence(data.links || [])
      }
    } catch (error) {
      console.error('Error loading linked evidence:', error)
    } finally {
      setLoadingLinks(false)
    }
  }

  const searchEvidence = async () => {
    try {
      setSearching(true)
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '20',
        claim_id: claimAdjustmentId
      })

      const response = await fetch(`/api/claims/search-evidence?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to search evidence')

      const data = await response.json()
      if (data.success) {
        setEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Error searching evidence:', error)
    } finally {
      setSearching(false)
    }
  }

  const linkEvidence = async () => {
    if (!selectedEvidence) return

    try {
      setLinking(true)
      const response = await fetch('/api/claims/link-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          claim_adjustment_id: claimAdjustmentId,
          evidence_id: selectedEvidence.id,
          relationship,
          relevance_score: relevanceScore,
          confidence,
          notes: notes || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to link evidence')
      }

      // Reset form
      setSelectedEvidence(null)
      setNotes('')
      setRelevanceScore(75)
      setConfidence(75)
      setRelationship('supports')

      // Reload links
      await loadLinkedEvidence()

      // Trigger search to exclude newly linked evidence
      if (searchQuery) {
        await searchEvidence()
      }

      onLinked?.()
    } catch (error) {
      console.error('Error linking evidence:', error)
      alert(error instanceof Error ? error.message : 'Failed to link evidence')
    } finally {
      setLinking(false)
    }
  }

  const removeLink = async (linkId: string) => {
    if (!confirm('Remove this evidence link?')) return

    try {
      const response = await fetch(`/api/claims/remove-evidence-link/${linkId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to remove link')

      await loadLinkedEvidence()
      if (searchQuery) {
        await searchEvidence()
      }
      onLinked?.()
    } catch (error) {
      console.error('Error removing link:', error)
      alert('Failed to remove evidence link')
    }
  }

  const getRelationshipColor = (rel: string) => {
    switch (rel) {
      case 'supports': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'contradicts': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'provides_context': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getRelationshipIcon = (rel: string) => {
    switch (rel) {
      case 'supports': return <CheckCircle2 className="h-3 w-3" />
      case 'contradicts': return <XCircle className="h-3 w-3" />
      case 'provides_context': return <Info className="h-3 w-3" />
      default: return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Link2 className="h-4 w-4" />
          Link Evidence ({linkedEvidence.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Evidence to Claim</DialogTitle>
          <DialogDescription>
            Connect evidence from your library to support, contradict, or provide context for this claim
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Currently Linked Evidence */}
          {loadingLinks ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading linked evidence...
            </div>
          ) : linkedEvidence.length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Linked Evidence ({linkedEvidence.length})</h4>
              <div className="space-y-2">
                {linkedEvidence.map(link => (
                  <Card key={link.link_id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getRelationshipColor(link.relationship)}>
                            {getRelationshipIcon(link.relationship)}
                            <span className="ml-1">{link.relationship.replace('_', ' ').toUpperCase()}</span>
                          </Badge>
                          <span className="text-sm font-medium">{link.title}</span>
                        </div>
                        {link.content_snippet && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {link.content_snippet}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Relevance: {link.relevance_score}%</span>
                          <span>Confidence: {link.confidence}%</span>
                          {link.credibility_score && <span>Credibility: {link.credibility_score}/100</span>}
                        </div>
                        {link.notes && (
                          <p className="text-xs italic text-muted-foreground">Note: {link.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {link.source_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(link.source_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLink(link.link_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No evidence linked yet</p>
          )}

          {/* Search Evidence */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Add New Evidence Link</h4>

            <div className="flex gap-2">
              <Input
                placeholder="Search your evidence library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchEvidence()}
              />
              <Button onClick={searchEvidence} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Search Results */}
            {evidence.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {evidence.map(item => (
                  <Card
                    key={item.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedEvidence?.id === item.id ? 'ring-2 ring-primary' : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedEvidence(item)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{item.title}</span>
                      </div>
                      {item.content_snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
                          {item.content_snippet}
                        </p>
                      )}
                      <div className="flex items-center gap-2 ml-6">
                        <Badge variant="outline" className="text-xs">{item.source_type}</Badge>
                        {item.credibility_score && (
                          <span className="text-xs text-muted-foreground">
                            Credibility: {item.credibility_score}/100
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Link Form */}
            {selectedEvidence && (
              <div className="space-y-4 p-4 bg-accent rounded-lg">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Relationship Type</label>
                  <Select value={relationship} onValueChange={(v: any) => setRelationship(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supports">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Supports - Evidence confirms the claim
                        </div>
                      </SelectItem>
                      <SelectItem value="contradicts">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Contradicts - Evidence refutes the claim
                        </div>
                      </SelectItem>
                      <SelectItem value="provides_context">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          Provides Context - Evidence adds background
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Relevance Score: {relevanceScore}%</label>
                  <Slider
                    value={[relevanceScore]}
                    onValueChange={(v) => setRelevanceScore(v[0])}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confidence: {confidence}%</label>
                  <Slider
                    value={[confidence]}
                    onValueChange={(v) => setConfidence(v[0])}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Why is this evidence relevant to the claim?"
                    rows={2}
                  />
                </div>

                <Button onClick={linkEvidence} disabled={linking} className="w-full">
                  {linking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Link Evidence
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
