/**
 * Universal Entity Selector Component
 * Allows frameworks to select and link actors, sources, events, and places
 */

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type EntityType = 'ACTOR' | 'SOURCE' | 'EVENT' | 'PLACE'

interface Entity {
  id: string
  name: string
  type?: string // Actor type, source type, etc.
  description?: string
}

interface EntitySelectorProps {
  entityType: EntityType
  value?: string[] // Selected entity IDs
  onChange: (entityIds: string[]) => void
  placeholder?: string
  label?: string
  multiSelect?: boolean
  className?: string
}

export function EntitySelector({
  entityType,
  value = [],
  onChange,
  placeholder = 'Select entity...',
  label,
  multiSelect = true,
  className
}: EntitySelectorProps) {
  const [open, setOpen] = useState(false)
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadEntities()
  }, [entityType])

  const loadEntities = async () => {
    setLoading(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const endpoint = getEndpoint(entityType)

      const response = await fetch(endpoint, {
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to load ${entityType.toLowerCase()}s`)
      }

      const data = await response.json()
      const entities = extractEntities(data, entityType)
      setEntities(entities)
    } catch (error) {
      console.error(`Error loading ${entityType}s:`, error)
    } finally {
      setLoading(false)
    }
  }

  const getEndpoint = (type: EntityType): string => {
    switch (type) {
      case 'ACTOR':
        return '/api/actors'
      case 'SOURCE':
        return '/api/sources'
      case 'EVENT':
        return '/api/events'
      case 'PLACE':
        return '/api/places'
      default:
        return '/api/actors'
    }
  }

  const extractEntities = (data: any, type: EntityType): Entity[] => {
    switch (type) {
      case 'ACTOR':
        return (data.actors || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          description: a.description
        }))
      case 'SOURCE':
        return (data.sources || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          description: s.description
        }))
      case 'EVENT':
        return (data.events || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          type: e.event_type,
          description: e.description
        }))
      case 'PLACE':
        return (data.places || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          type: p.place_type,
          description: p.description
        }))
      default:
        return []
    }
  }

  const selectedEntities = entities.filter(e => value.includes(e.id))

  const handleSelect = (entityId: string) => {
    if (multiSelect) {
      if (value.includes(entityId)) {
        onChange(value.filter(id => id !== entityId))
      } else {
        onChange([...value, entityId])
      }
    } else {
      onChange([entityId])
      setOpen(false)
    }
  }

  const handleRemove = (entityId: string) => {
    onChange(value.filter(id => id !== entityId))
  }

  const filteredEntities = entities.filter(entity =>
    entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entity.type?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={loading}
          >
            {loading ? (
              'Loading...'
            ) : selectedEntities.length > 0 ? (
              `${selectedEntities.length} ${entityType.toLowerCase()}${selectedEntities.length > 1 ? 's' : ''} selected`
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder={`Search ${entityType.toLowerCase()}s...`}
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandEmpty>No {entityType.toLowerCase()} found.</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {filteredEntities.map((entity) => (
                  <CommandItem
                    key={entity.id}
                    value={entity.id}
                    onSelect={() => handleSelect(entity.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.includes(entity.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{entity.name}</div>
                      {entity.type && (
                        <div className="text-xs text-muted-foreground">{entity.type}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedEntities.map((entity) => (
            <Badge key={entity.id} variant="secondary" className="gap-1">
              {entity.name}
              <button
                onClick={() => handleRemove(entity.id)}
                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
