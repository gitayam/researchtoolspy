/**
 * Claim Entity Linker Component
 * Allows users to link actors/entities to claims with role and credibility impact
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
  Users,
  Search,
  Loader2,
  UserCircle,
  Building2,
  MapPin,
  Calendar,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'

interface Actor {
  id: string
  name: string
  type: string
  description?: string
  credibility_rating?: number
  bias_rating?: string
}

interface EntityMention {
  id: string
  entity_id: string
  entity_name: string
  entity_type: string
  role: 'claim_maker' | 'subject' | 'mentioned' | 'affected'
  context?: string
  credibility_impact: number
  extracted_at: string
}

interface GroupedEntities {
  claim_maker: EntityMention[]
  subject: EntityMention[]
  mentioned: EntityMention[]
  affected: EntityMention[]
}

interface ClaimEntityLinkerProps {
  claimAdjustmentId: string
  onLinked?: () => void
}

export function ClaimEntityLinker({ claimAdjustmentId, onLinked }: ClaimEntityLinkerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [actors, setActors] = useState<Actor[]>([])
  const [entities, setEntities] = useState<EntityMention[]>([])
  const [groupedEntities, setGroupedEntities] = useState<GroupedEntities | null>(null)
  const [loadingEntities, setLoadingEntities] = useState(false)

  // Linking state
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null)
  const [role, setRole] = useState<'claim_maker' | 'subject' | 'mentioned' | 'affected'>('claim_maker')
  const [credibilityImpact, setCredibilityImpact] = useState(0)
  const [context, setContext] = useState('')
  const [linking, setLinking] = useState(false)

  // Load linked entities when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadLinkedEntities()
    }
  }, [isOpen])

  const loadLinkedEntities = async () => {
    try {
      setLoadingEntities(true)
      const response = await fetch(`/api/claims/get-claim-entities/${claimAdjustmentId}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to load linked entities')

      const data = await response.json()
      if (data.success) {
        setEntities(data.entities || [])
        setGroupedEntities(data.grouped_by_role || null)
      }
    } catch (error) {
      console.error('Error loading linked entities:', error)
    } finally {
      setLoadingEntities(false)
    }
  }

  const searchActors = async () => {
    try {
      setSearching(true)
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '20',
        claim_id: claimAdjustmentId
      })

      const response = await fetch(`/api/claims/search-actors?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to search actors')

      const data = await response.json()
      if (data.success) {
        setActors(data.actors || [])
      }
    } catch (error) {
      console.error('Error searching actors:', error)
    } finally {
      setSearching(false)
    }
  }

  const linkEntity = async () => {
    if (!selectedActor) return

    try {
      setLinking(true)
      const response = await fetch('/api/claims/link-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          claim_adjustment_id: claimAdjustmentId,
          entity_id: selectedActor.id,
          entity_name: selectedActor.name,
          entity_type: selectedActor.type || 'other',
          role,
          context: context || undefined,
          credibility_impact: credibilityImpact
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to link entity')
      }

      // Reset form
      setSelectedActor(null)
      setContext('')
      setCredibilityImpact(0)
      setRole('claim_maker')

      // Reload entities
      await loadLinkedEntities()

      // Trigger search to exclude newly linked actor
      if (searchQuery) {
        await searchActors()
      }

      onLinked?.()
    } catch (error) {
      console.error('Error linking entity:', error)
      alert(error instanceof Error ? error.message : 'Failed to link entity')
    } finally {
      setLinking(false)
    }
  }

  const removeMention = async (mentionId: string) => {
    if (!confirm('Remove this entity mention?')) return

    try {
      const response = await fetch(`/api/claims/remove-entity-mention/${mentionId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to remove mention')

      await loadLinkedEntities()
      if (searchQuery) {
        await searchActors()
      }
      onLinked?.()
    } catch (error) {
      console.error('Error removing mention:', error)
      alert('Failed to remove entity mention')
    }
  }

  const getRoleColor = (r: string) => {
    switch (r) {
      case 'claim_maker': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      case 'subject': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'mentioned': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
      case 'affected': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getRoleIcon = (r: string) => {
    switch (r) {
      case 'claim_maker': return <UserCircle className="h-3 w-3" />
      case 'subject': return <Users className="h-3 w-3" />
      case 'mentioned': return <Building2 className="h-3 w-3" />
      case 'affected': return <MapPin className="h-3 w-3" />
      default: return null
    }
  }

  const getCredibilityIcon = (impact: number) => {
    if (impact > 10) return <TrendingUp className="h-3 w-3 text-green-600" />
    if (impact < -10) return <TrendingDown className="h-3 w-3 text-red-600" />
    return <Minus className="h-3 w-3 text-gray-600" />
  }

  const getCredibilityColor = (impact: number) => {
    if (impact > 10) return 'text-green-700 dark:text-green-400'
    if (impact < -10) return 'text-red-700 dark:text-red-400'
    return 'text-gray-700 dark:text-gray-400'
  }

  const totalEntities = entities.length

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="h-4 w-4" />
          Link Entities ({totalEntities})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Entities to Claim</DialogTitle>
          <DialogDescription>
            Track who made the claim, who/what it's about, and assess credibility impact
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Currently Linked Entities */}
          {loadingEntities ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading linked entities...
            </div>
          ) : entities.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Linked Entities ({totalEntities})</h4>

              {/* Grouped by Role */}
              {groupedEntities && Object.entries(groupedEntities).map(([roleKey, mentions]) => (
                mentions.length > 0 && (
                  <div key={roleKey} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getRoleColor(roleKey)}>
                        {getRoleIcon(roleKey)}
                        <span className="ml-1">{roleKey.replace('_', ' ').toUpperCase()}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">({mentions.length})</span>
                    </div>
                    <div className="space-y-2 ml-4">
                      {mentions.map(mention => (
                        <Card key={mention.id} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{mention.entity_name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {mention.entity_type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className={`flex items-center gap-1 ${getCredibilityColor(mention.credibility_impact)}`}>
                                  {getCredibilityIcon(mention.credibility_impact)}
                                  Impact: {mention.credibility_impact > 0 ? '+' : ''}{mention.credibility_impact}
                                </span>
                              </div>
                              {mention.context && (
                                <p className="text-xs text-muted-foreground italic">
                                  {mention.context}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMention(mention.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No entities linked yet</p>
          )}

          {/* Search & Add Entities */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Add Entity</h4>

            <div className="flex gap-2">
              <Input
                placeholder="Search actors in your library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchActors()}
              />
              <Button onClick={searchActors} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Search Results */}
            {actors.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {actors.map(actor => (
                  <Card
                    key={actor.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedActor?.id === actor.id ? 'ring-2 ring-primary' : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedActor(actor)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{actor.name}</span>
                      </div>
                      {actor.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 ml-6">
                          {actor.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 ml-6">
                        <Badge variant="outline" className="text-xs">{actor.type}</Badge>
                        {actor.credibility_rating && (
                          <span className="text-xs text-muted-foreground">
                            Credibility: {actor.credibility_rating}/100
                          </span>
                        )}
                        {actor.bias_rating && (
                          <span className="text-xs text-muted-foreground">
                            Bias: {actor.bias_rating}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Link Form */}
            {selectedActor && (
              <div className="space-y-4 p-4 bg-accent rounded-lg">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Entity Role in Claim</label>
                  <Select value={role} onValueChange={(v: any) => setRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claim_maker">
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4" />
                          Claim Maker - Who made this statement
                        </div>
                      </SelectItem>
                      <SelectItem value="subject">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Subject - Who/what the claim is about
                        </div>
                      </SelectItem>
                      <SelectItem value="mentioned">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Mentioned - Referenced in the claim
                        </div>
                      </SelectItem>
                      <SelectItem value="affected">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Affected - Impacted by the claim
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Credibility Impact: {credibilityImpact > 0 ? '+' : ''}{credibilityImpact}
                  </label>
                  <Slider
                    value={[credibilityImpact]}
                    onValueChange={(v) => setCredibilityImpact(v[0])}
                    min={-50}
                    max={50}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Decreases (-50)</span>
                    <span>Neutral (0)</span>
                    <span>Increases (+50)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How does this entity's involvement affect claim credibility?
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Context (optional)</label>
                  <Textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Additional context about this entity's role..."
                    rows={2}
                  />
                </div>

                <Button onClick={linkEntity} disabled={linking} className="w-full">
                  {linking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Link Entity
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
