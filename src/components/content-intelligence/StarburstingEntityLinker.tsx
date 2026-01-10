/**
 * Starbursting Entity Linker Component
 * Handles linking AI-extracted entities to actual database entities (Actors, Places, Events)
 */

import { useState, useEffect } from 'react'
import { Users, MapPin, Calendar, Plus, Link as LinkIcon, Check, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'

interface ExtractedEntity {
  name: string
  type: 'Actor' | 'Place' | 'Event' | 'Mechanism' | 'Cause'
  details?: string
  linked_id?: string
}

interface StarburstingEntityLinkerProps {
  entity: ExtractedEntity
  sessionId: string
  questionId: string
  onLinkCreated?: (linkedId: string) => void
}

export function StarburstingEntityLinker({
  entity,
  sessionId,
  questionId,
  onLinkCreated
}: StarburstingEntityLinkerProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<'idle' | 'checking' | 'linked' | 'suggesting' | 'error'>('idle')
  const [matchedEntity, setMatchedEntity] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Check if entity already exists in database
  useEffect(() => {
    if (entity.linked_id) {
      setStatus('linked')
      return
    }
    
    checkExisting()
  }, [entity.name, entity.type])

  const checkExisting = async () => {
    setStatus('checking')
    try {
      // Map ontology type to database type
      const dbType = entity.type === 'Actor' ? 'PERSON' : 
                     entity.type === 'Place' ? 'LOCATION' : 
                     entity.type === 'Event' ? 'EVENT' : 'OTHER'
      
      const response = await fetch(
        `/api/actors/search?name=${encodeURIComponent(entity.name)}&type=${dbType}`,
        { credentials: 'include' }
      )
      
      if (response.ok) {
        const data = await response.json()
        if (data.exists && data.actor) {
          setMatchedEntity(data.actor)
          setStatus('suggesting')
        } else {
          setStatus('idle')
        }
      } else {
        setStatus('idle')
      }
    } catch (error) {
      console.error('Error checking entity:', error)
      setStatus('idle')
    }
  }

  const handleLink = async () => {
    if (!matchedEntity) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/content-intelligence/starbursting/${sessionId}/link-entity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: questionId,
          entity_name: entity.name,
          linked_id: matchedEntity.id,
          entity_type: entity.type
        })
      })

      if (response.ok) {
        setStatus('linked')
        toast({
          title: 'Entity Linked',
          description: `Successfully linked to existing ${entity.type}: ${matchedEntity.name}`
        })
        if (onLinkCreated) onLinkCreated(matchedEntity.id)
      } else {
        throw new Error('Failed to link entity')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to link entity',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAndLink = async () => {
    setLoading(true)
    try {
      // Map ontology type to database type
      const dbType = entity.type === 'Actor' ? 'PERSON' : 
                     entity.type === 'Place' ? 'LOCATION' : 
                     entity.type === 'Event' ? 'EVENT' : 'OTHER'

      // 1. Create the entity
      const createResponse = await fetch('/api/actors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: entity.name,
          type: dbType,
          description: entity.details || `Extracted from Starbursting Analysis`,
          workspace_id: '1'
        })
      })

      if (!createResponse.ok) throw new Error('Failed to create entity')
      const newEntity = await createResponse.json()

      // 2. Link it to the question
      const linkResponse = await fetch(`/api/content-intelligence/starbursting/${sessionId}/link-entity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: questionId,
          entity_name: entity.name,
          linked_id: newEntity.id,
          entity_type: entity.type
        })
      })

      if (linkResponse.ok) {
        setStatus('linked')
        setMatchedEntity(newEntity)
        toast({
          title: 'Entity Created & Linked',
          description: `New ${entity.type} created and linked successfully`
        })
        if (onLinkCreated) onLinkCreated(newEntity.id)
      } else {
        throw new Error('Failed to link new entity')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create and link entity',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getIcon = () => {
    switch (entity.type) {
      case 'Actor': return <Users className="h-3 w-3 text-blue-500" />
      case 'Place': return <MapPin className="h-3 w-3 text-orange-500" />
      case 'Event': return <Calendar className="h-3 w-3 text-green-500" />
      default: return <AlertCircle className="h-3 w-3 text-gray-500" />
    }
  }

  return (
    <TooltipProvider>
      <div className="flex items-center">
        <Badge variant="outline" className={`flex items-center gap-1.5 py-1 px-2 ${status === 'linked' ? 'bg-green-50 border-green-200' : 'bg-white/50'}`}>
          {getIcon()}
          <span className="font-semibold text-xs">{entity.name}</span>
          {entity.details && (
            <span className="text-[10px] opacity-70 border-l pl-1 ml-0.5 border-gray-300">
              {entity.details}
            </span>
          )}

          <div className="ml-2 border-l pl-2 flex gap-1">
            {status === 'checking' && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            
            {status === 'suggesting' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={handleLink}
                    disabled={loading}
                  >
                    <LinkIcon className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Match found! Click to link to existing {entity.type}
                </TooltipContent>
              </Tooltip>
            )}

            {status === 'idle' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 text-gray-500 hover:text-blue-600"
                    onClick={handleCreateAndLink}
                    disabled={loading}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  No match found. Click to create new {entity.type} and link
                </TooltipContent>
              </Tooltip>
            )}

            {status === 'linked' && (
              <Check className="h-3 w-3 text-green-600" />
            )}
          </div>
        </Badge>
      </div>
    </TooltipProvider>
  )
}
