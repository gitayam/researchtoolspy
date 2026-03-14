import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCopHeaders } from '@/lib/cop-auth'

interface FrameworksTabProps {
  workspaceId: string
  userRole: string
}

interface Framework {
  id: number
  title: string
  framework_type: string
  status: string
  tags: string[]
  created_by_username: string | null
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

const FRAMEWORK_TYPES = ['ach', 'swot', 'pmesii', 'mom-pop', 'moses', 'cog'] as const

export function FrameworksTab({ workspaceId, userRole }: FrameworksTabProps) {
  const navigate = useNavigate()
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const canCreate = userRole !== 'VIEWER'

  useEffect(() => {
    fetchFrameworks()
  }, [workspaceId, typeFilter])

  const fetchFrameworks = async () => {
    try {
      setLoading(true)
      const headers: HeadersInit = { ...getCopHeaders() }
      const authToken = localStorage.getItem('auth_token')
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const params = new URLSearchParams({ limit: '50' })
      if (typeFilter) params.set('type', typeFilter)

      const response = await fetch(`/api/workspaces/${workspaceId}/frameworks?${params}`, { headers })
      if (response.ok) {
        const data = await response.json()
        setFrameworks(data.frameworks)
      }
    } catch (error) {
      console.error('Failed to fetch frameworks:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !typeFilter ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {FRAMEWORK_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium uppercase transition-colors ${
              typeFilter === type ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {type}
          </button>
        ))}

        <div className="flex-1" />

        {canCreate && (
          <Button onClick={() => navigate(`/dashboard/frameworks/new?workspace_id=${workspaceId}`)}>
            <Plus className="h-4 w-4 mr-2" />New Framework
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading frameworks...</div>
      ) : frameworks.length === 0 ? (
        <div className="text-center py-12">
          <FlaskConical className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No frameworks in this workspace yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {frameworks.map((fw) => (
            <button
              key={fw.id}
              onClick={() => navigate(`/dashboard/frameworks/${fw.id}?workspace_id=${workspaceId}`)}
              className="text-left p-4 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-gray-900 dark:text-white truncate flex-1">{fw.title}</div>
                <Badge className={`ml-2 text-xs ${STATUS_COLORS[fw.status] || ''}`}>{fw.status}</Badge>
              </div>
              <Badge variant="outline" className="text-xs uppercase mb-2">{fw.framework_type}</Badge>
              {fw.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {fw.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400">{tag}</span>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-500">
                {fw.created_by_username && <span>By {fw.created_by_username} · </span>}
                Updated {new Date(fw.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
