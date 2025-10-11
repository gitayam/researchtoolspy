/**
 * Actor Picker Component
 * Search and select actors from the database
 * Used in COG analysis, SWOT, and other frameworks
 */

import { useState, useEffect } from 'react'
import { Search, User, Building2, MapPin, Users as UsersIcon, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

interface Actor {
  id: string
  name: string
  type: 'person' | 'organization' | 'location' | 'group'
  description?: string
  credibility_rating?: number
  bias_rating?: number
}

interface ActorPickerProps {
  value?: { actor_id: string; actor_name: string } | null
  onChange: (actor: { actor_id: string; actor_name: string } | null) => void
  label?: string
  placeholder?: string
  helperText?: string
}

export function ActorPicker({
  value,
  onChange,
  label = 'Actor',
  placeholder = 'Search for an actor...',
  helperText
}: ActorPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Actor[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchActors()
    } else {
      setSearchResults([])
      setShowResults(false)
    }
  }, [searchQuery])

  const searchActors = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/claims/search-actors?q=${encodeURIComponent(searchQuery)}&limit=10`,
        { credentials: 'include' }
      )

      if (!response.ok) throw new Error('Failed to search actors')

      const data = await response.json()
      if (data.success) {
        setSearchResults(data.actors || [])
        setShowResults(true)
      }
    } catch (error) {
      console.error('Error searching actors:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectActor = (actor: Actor) => {
    onChange({ actor_id: actor.id, actor_name: actor.name })
    setSearchQuery('')
    setShowResults(false)
  }

  const clearSelection = () => {
    onChange(null)
  }

  const getActorIcon = (type: string) => {
    switch (type) {
      case 'person':
        return <User className="h-4 w-4" />
      case 'organization':
        return <Building2 className="h-4 w-4" />
      case 'location':
        return <MapPin className="h-4 w-4" />
      case 'group':
        return <UsersIcon className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getCredibilityColor = (rating?: number) => {
    if (!rating) return 'bg-gray-100 text-gray-600'
    if (rating >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    if (rating >= 60) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
    if (rating >= 40) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
    return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      {/* Selected Actor Display */}
      {value && (
        <div className="flex items-center gap-2 p-3 bg-accent rounded-lg">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 font-medium">{value.actor_name}</span>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Search Input */}
      {!value && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <Card className="absolute z-50 w-full mt-1 max-h-80 overflow-y-auto">
              <CardContent className="p-2">
                <div className="space-y-1">
                  {searchResults.map((actor) => (
                    <button
                      key={actor.id}
                      onClick={() => selectActor(actor)}
                      className="w-full text-left p-3 hover:bg-accent rounded-lg transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getActorIcon(actor.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{actor.name}</div>
                          {actor.description && (
                            <div className="text-sm text-muted-foreground truncate">
                              {actor.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {actor.type}
                            </Badge>
                            {actor.credibility_rating !== undefined && (
                              <Badge className={`text-xs ${getCredibilityColor(actor.credibility_rating)}`}>
                                Credibility: {actor.credibility_rating}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Results */}
          {showResults && searchResults.length === 0 && !loading && (
            <Card className="absolute z-50 w-full mt-1">
              <CardContent className="p-4 text-center text-muted-foreground">
                No actors found. Try a different search term.
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {loading && (
            <Card className="absolute z-50 w-full mt-1">
              <CardContent className="p-4 text-center text-muted-foreground">
                Searching...
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Helper Text */}
      {helperText && !value && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  )
}
