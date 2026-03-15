import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Radio, Users, MapPin, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCopHeaders } from '@/lib/cop-auth'

interface CopSessionsTabProps {
  workspaceId: string
  userRole: string
}

interface CopSession {
  id: string
  name: string
  template_type: string
  status: string
  collaborator_count: number
  marker_count: number
  evidence_count: number
  time_window_start: string | null
  time_window_end: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ARCHIVED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

export function CopSessionsTab({ workspaceId, userRole }: CopSessionsTabProps) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<CopSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = userRole !== 'VIEWER'

  useEffect(() => {
    const controller = new AbortController()
    fetchSessions(controller.signal)
    return () => controller.abort()
  }, [workspaceId])

  const fetchSessions = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/workspaces/${workspaceId}/cop-sessions?limit=50`, { headers: getCopHeaders(), signal })
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions)
        setError(null)
      } else {
        console.error('[CopSessionsTab] fetch failed:', response.status)
        setError(`Failed to load COP sessions (${response.status})`)
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') console.error('Failed to fetch COP sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeWindow = (start: string | null, end: string | null) => {
    if (!start && !end) return null
    const s = start ? new Date(start).toLocaleDateString() : '?'
    const e = end ? new Date(end).toLocaleDateString() : 'ongoing'
    return `${s} \u2014 ${e}`
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => navigate(`/dashboard/cop?team_workspace_id=${workspaceId}`)}>
            <Plus className="h-4 w-4 mr-2" />New COP
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-500 p-2">{error}</p>}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading COP sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <Radio className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No COP sessions are linked to this workspace yet.</p>
          <p className="text-sm text-gray-500 mt-1">Create a new COP or assign existing sessions from COP settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => navigate(`/dashboard/cop/${session.id}`)}
              className="text-left p-4 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-gray-900 dark:text-white truncate flex-1">{session.name}</div>
                <Badge className={`ml-2 text-xs ${STATUS_COLORS[session.status] || ''}`}>{session.status}</Badge>
              </div>
              <Badge variant="outline" className="text-xs mb-3">{session.template_type}</Badge>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.collaborator_count}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.marker_count}</span>
                <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{session.evidence_count}</span>
              </div>
              {formatTimeWindow(session.time_window_start, session.time_window_end) && (
                <div className="text-xs text-gray-500 mt-2">{formatTimeWindow(session.time_window_start, session.time_window_end)}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
