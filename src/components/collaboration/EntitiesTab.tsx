import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getCopHeaders } from '@/lib/cop-auth'

interface EntitiesTabProps {
  workspaceId: string
  userRole: string
}

interface Entity {
  id: string
  entity_type: string
  name: string
  type: string
  category: string
  created_by: number
  created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  actor: 'border-l-blue-500',
  source: 'border-l-green-500',
  event: 'border-l-red-500',
  place: 'border-l-amber-500',
  behavior: 'border-l-purple-500',
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  actor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  source: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  event: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  place: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  behavior: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

const ENTITY_TYPES = ['actor', 'source', 'event', 'place', 'behavior'] as const

export function EntitiesTab({ workspaceId, userRole }: EntitiesTabProps) {
  const navigate = useNavigate()
  const [entities, setEntities] = useState<Entity[]>([])
  const [total, setTotal] = useState(0)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const canCreate = userRole !== 'VIEWER'

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const controller = new AbortController()
    fetchEntities(controller.signal)
    return () => controller.abort()
  }, [workspaceId, typeFilter, search])

  const fetchEntities = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const headers: HeadersInit = { ...getCopHeaders() }
      const authToken = localStorage.getItem('auth_token')
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      if (search) params.set('search', search)
      params.set('limit', '50')

      const response = await fetch(`/api/workspaces/${workspaceId}/entities?${params}`, { headers, signal })
      if (response.ok) {
        const data = await response.json()
        setEntities(data.entities)
        setTotal(data.total)
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') console.error('Failed to fetch entities:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEntityClick = (entity: Entity) => {
    const typeRoutes: Record<string, string> = {
      actor: '/dashboard/entities/actors',
      source: '/dashboard/entities/sources',
      event: '/dashboard/entities/events',
      place: '/dashboard/entities/places',
      behavior: '/dashboard/entities/behaviors',
    }
    const route = typeRoutes[entity.entity_type]
    if (route) navigate(`${route}/${entity.id}?workspace_id=${workspaceId}`)
  }

  const handleNewEntity = (type: string) => {
    const typeRoutes: Record<string, string> = {
      actor: '/dashboard/entities/actors/new',
      source: '/dashboard/entities/sources/new',
      event: '/dashboard/entities/events/new',
      place: '/dashboard/entities/places/new',
      behavior: '/dashboard/entities/behaviors/new',
    }
    const route = typeRoutes[type]
    if (route) navigate(`${route}?workspace_id=${workspaceId}`)
  }

  return (
    <div className="space-y-4">
      {/* Filter chips + Search + Create */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !typeFilter ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All{!typeFilter ? ` (${total})` : ''}
        </button>
        {ENTITY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              typeFilter === type ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {type}s{typeFilter === type ? ` (${total})` : ''}
          </button>
        ))}

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search entities..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {canCreate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Entity</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {ENTITY_TYPES.map((type) => (
                <DropdownMenuItem key={type} onClick={() => handleNewEntity(type)} className="capitalize">
                  {type}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Entity Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading entities...</div>
      ) : entities.length === 0 ? (
        <div className="text-center py-12">
          <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No entities in this workspace yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {entities.map((entity) => (
            <button
              key={`${entity.entity_type}-${entity.id}`}
              onClick={() => handleEntityClick(entity)}
              className={`text-left p-4 rounded-lg border border-l-4 ${TYPE_COLORS[entity.entity_type] || 'border-l-gray-500'} bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}
            >
              <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{entity.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-xs ${TYPE_BADGE_COLORS[entity.entity_type] || ''}`}>
                  {entity.type}
                </Badge>
                <span className="text-xs text-gray-500 capitalize">{entity.entity_type}</span>
              </div>
              {entity.category && (
                <div className="text-xs text-gray-500 mt-1">{entity.category}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
