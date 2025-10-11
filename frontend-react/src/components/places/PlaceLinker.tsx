/**
 * Place Linker
 * Link places to framework items (e.g., Starbursting "Where" questions)
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Loader2, MapPin, ExternalLink, X, CheckCircle2 } from 'lucide-react'
import type { Place, PlaceType } from '@/types/entities'

export interface LinkedPlace {
  id: string
  name: string
  place_type: PlaceType
  coordinates: { lat: number; lng: number }
  address?: string
  country?: string
  region?: string
}

interface PlaceLinkerProps {
  isOpen: boolean
  onClose: () => void
  selectedPlaces: LinkedPlace[]
  onPlacesChange: (places: LinkedPlace[]) => void
  contextLabel?: string
}

export function PlaceLinker({
  isOpen,
  onClose,
  selectedPlaces,
  onPlacesChange,
  contextLabel
}: PlaceLinkerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Place[]>([])
  const [localSelected, setLocalSelected] = useState<LinkedPlace[]>(selectedPlaces)

  useEffect(() => {
    setLocalSelected(selectedPlaces)
  }, [selectedPlaces, isOpen])

  const searchPlaces = async () => {
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

      const response = await fetch(`/api/entities/places?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to search places')

      const data = await response.json()
      if (data.success) {
        setResults(data.places || [])
      }
    } catch (error) {
      console.error('Error searching places:', error)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const togglePlace = (place: Place) => {
    const linkedPlace: LinkedPlace = {
      id: place.id,
      name: place.name,
      place_type: place.place_type,
      coordinates: place.coordinates,
      address: place.address,
      country: place.country,
      region: place.region
    }

    const exists = localSelected.find(p => p.id === place.id)
    if (exists) {
      setLocalSelected(localSelected.filter(p => p.id !== place.id))
    } else {
      setLocalSelected([...localSelected, linkedPlace])
    }
  }

  const handleSave = () => {
    onPlacesChange(localSelected)
    onClose()
  }

  const handleClose = () => {
    setLocalSelected(selectedPlaces)
    onClose()
  }

  const getPlaceTypeIcon = (type: PlaceType) => {
    switch (type) {
      case 'FACILITY': return '🏢'
      case 'CITY': return '🏙️'
      case 'REGION': return '🗺️'
      case 'COUNTRY': return '🌍'
      case 'INSTALLATION': return '🏗️'
      default: return '📍'
    }
  }

  const getPlaceTypeBadgeColor = (type: PlaceType) => {
    switch (type) {
      case 'FACILITY': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'CITY': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      case 'REGION': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'COUNTRY': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'INSTALLATION': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Places {contextLabel && `to ${contextLabel}`}</DialogTitle>
          <DialogDescription>
            Search for and select locations relevant to this {contextLabel || 'item'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search places by name, country, region..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchPlaces()}
                className="pl-10"
              />
            </div>
            <Button onClick={searchPlaces} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {localSelected.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {localSelected.length} place{localSelected.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {localSelected.map(place => (
                  <Badge key={place.id} variant="secondary" className="flex items-center gap-1">
                    <span>{getPlaceTypeIcon(place.place_type)}</span>
                    <span>{place.name}</span>
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-600"
                      onClick={() => togglePlace(place as Place)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2 mt-4">
              <h5 className="text-sm font-medium">Results ({results.length})</h5>
              {results.map((place) => {
                const isSelected = localSelected.some(p => p.id === place.id)
                return (
                  <Card
                    key={place.id}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 border-2'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => togglePlace(place)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{getPlaceTypeIcon(place.place_type)}</span>
                            <h6 className="font-medium text-sm">{place.name}</h6>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className={`text-xs ${getPlaceTypeBadgeColor(place.place_type)}`}>
                              {place.place_type}
                            </Badge>
                            {place.country && (
                              <Badge variant="outline" className="text-xs">
                                🌍 {place.country}
                              </Badge>
                            )}
                            {place.region && (
                              <Badge variant="outline" className="text-xs">
                                📍 {place.region}
                              </Badge>
                            )}
                          </div>

                          {place.address && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                              {place.address}
                            </p>
                          )}

                          {place.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {place.description}
                            </p>
                          )}
                        </div>

                        <a
                          href={`/dashboard/entities/places/${place.id}`}
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
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No places found. Try a different search term.
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Search for locations to link to this {contextLabel || 'item'}
            </div>
          )}
        </div>

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

export function PlaceBadge({ place, onRemove }: { place: LinkedPlace; onRemove?: () => void }) {
  const getPlaceTypeIcon = (type: PlaceType) => {
    switch (type) {
      case 'FACILITY': return '🏢'
      case 'CITY': return '🏙️'
      case 'REGION': return '🗺️'
      case 'COUNTRY': return '🌍'
      case 'INSTALLATION': return '🏗️'
      default: return '📍'
    }
  }

  const getPlaceTypeBadgeColor = (type: PlaceType) => {
    switch (type) {
      case 'FACILITY': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'CITY': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      case 'REGION': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'COUNTRY': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'INSTALLATION': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <Badge className={`flex items-center gap-2 px-2 py-1 ${getPlaceTypeBadgeColor(place.place_type)}`}>
      <span>{getPlaceTypeIcon(place.place_type)}</span>
      <div className="flex flex-col items-start">
        <span className="font-medium text-xs">{place.name}</span>
        {(place.region || place.country) && (
          <span className="text-xs opacity-75">
            {[place.region, place.country].filter(Boolean).join(', ')}
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
