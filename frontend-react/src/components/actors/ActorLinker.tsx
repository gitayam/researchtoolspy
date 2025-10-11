/**
 * Actor Linker
 * Link actors to framework sections (e.g., PMESII-PT domains)
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Loader2, Users, ExternalLink, X, CheckCircle2 } from 'lucide-react'
import type { Actor, ActorType } from '@/types/entities'

export interface LinkedActor {
  id: string
  name: string
  type: ActorType
  category?: string
  role?: string
  affiliation?: string
}

interface ActorLinkerProps {
  isOpen: boolean
  onClose: () => void
  selectedActors: LinkedActor[]
  onActorsChange: (actors: LinkedActor[]) => void
  domainName?: string // e.g., "Political", "Military"
}

export function ActorLinker({
  isOpen,
  onClose,
  selectedActors,
  onActorsChange,
  domainName
}: ActorLinkerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Actor[]>([])
  const [localSelected, setLocalSelected] = useState<LinkedActor[]>(selectedActors)

  useEffect(() => {
    setLocalSelected(selectedActors)
  }, [selectedActors, isOpen])

  const searchActors = async () => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    try {
      setSearching(true)
      const params = new URLSearchParams({
        search: searchQuery,
        limit: '20'
      })

      const response = await fetch(`/api/entities/actors?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to search actors')

      const data = await response.json()
      if (data.success) {
        setResults(data.actors || [])
      }
    } catch (error) {
      console.error('Error searching actors:', error)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const toggleActor = (actor: Actor) => {
    const linkedActor: LinkedActor = {
      id: actor.id,
      name: actor.name,
      type: actor.type,
      category: actor.category,
      role: actor.role,
      affiliation: actor.affiliation
    }

    const exists = localSelected.find(a => a.id === actor.id)
    if (exists) {
      setLocalSelected(localSelected.filter(a => a.id !== actor.id))
    } else {
      setLocalSelected([...localSelected, linkedActor])
    }
  }

  const handleSave = () => {
    onActorsChange(localSelected)
    onClose()
  }

  const handleClose = () => {
    setLocalSelected(selectedActors) // Reset to original
    onClose()
  }

  const getActorTypeIcon = (type: ActorType) => {
    switch (type) {
      case 'PERSON': return '👤'
      case 'ORGANIZATION': return '🏢'
      case 'UNIT': return '⚔️'
      case 'GOVERNMENT': return '🏛️'
      case 'GROUP': return '👥'
      default: return '❓'
    }
  }

  const getActorTypeBadgeColor = (type: ActorType) => {
    switch (type) {
      case 'PERSON': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'ORGANIZATION': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      case 'UNIT': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'GOVERNMENT': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'GROUP': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Actors {domainName && `to ${domainName} Domain`}</DialogTitle>
          <DialogDescription>
            Search for and select actors relevant to this {domainName || 'section'}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actors by name, category, affiliation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchActors()}
                className="pl-10"
              />
            </div>
            <Button onClick={searchActors} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {/* Selected Actors Summary */}
          {localSelected.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {localSelected.length} actor{localSelected.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {localSelected.map(actor => (
                  <Badge key={actor.id} variant="secondary" className="flex items-center gap-1">
                    <span>{getActorTypeIcon(actor.type)}</span>
                    <span>{actor.name}</span>
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-600"
                      onClick={() => toggleActor(actor as Actor)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2 mt-4">
              <h5 className="text-sm font-medium">Results ({results.length})</h5>
              {results.map((actor) => {
                const isSelected = localSelected.some(a => a.id === actor.id)
                return (
                  <Card
                    key={actor.id}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 border-2'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => toggleActor(actor)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{getActorTypeIcon(actor.type)}</span>
                            <h6 className="font-medium text-sm">{actor.name}</h6>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className={`text-xs ${getActorTypeBadgeColor(actor.type)}`}>
                              {actor.type}
                            </Badge>
                            {actor.category && (
                              <Badge variant="outline" className="text-xs">
                                {actor.category}
                              </Badge>
                            )}
                            {actor.role && (
                              <Badge variant="outline" className="text-xs">
                                {actor.role}
                              </Badge>
                            )}
                          </div>

                          {actor.affiliation && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                              {actor.affiliation}
                            </p>
                          )}

                          {actor.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {actor.description}
                            </p>
                          )}
                        </div>

                        <a
                          href={`/dashboard/entities/actors/${actor.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        >
                          <ExternalLink className="h-4 w-4 text-gray-500" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && results.length === 0 && searchQuery && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No actors found. Try a different search term.
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Search for actors to link to this {domainName || 'section'}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Link {localSelected.length > 0 && `(${localSelected.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Badge component for displaying linked actors
export function ActorBadge({ actor, onRemove }: { actor: LinkedActor; onRemove?: () => void }) {
  const getActorTypeIcon = (type: ActorType) => {
    switch (type) {
      case 'PERSON': return '👤'
      case 'ORGANIZATION': return '🏢'
      case 'UNIT': return '⚔️'
      case 'GOVERNMENT': return '🏛️'
      case 'GROUP': return '👥'
      default: return '❓'
    }
  }

  const getActorTypeBadgeColor = (type: ActorType) => {
    switch (type) {
      case 'PERSON': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'ORGANIZATION': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      case 'UNIT': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'GOVERNMENT': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'GROUP': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <Badge className={`flex items-center gap-2 px-2 py-1 ${getActorTypeBadgeColor(actor.type)}`}>
      <span>{getActorTypeIcon(actor.type)}</span>
      <div className="flex flex-col items-start">
        <span className="font-medium text-xs">{actor.name}</span>
        {(actor.category || actor.role) && (
          <span className="text-xs opacity-75">
            {[actor.category, actor.role].filter(Boolean).join(' • ')}
          </span>
        )}
      </div>
      {onRemove && (
        <X
          className="h-3 w-3 cursor-pointer hover:text-red-600 ml-1"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        />
      )}
    </Badge>
  )
}
