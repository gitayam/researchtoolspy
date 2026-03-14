import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Play, ListChecks, ClipboardList, Table2, Microscope, Globe, Target, Satellite, Scale, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCopHeaders } from '@/lib/cop-auth'

interface ToolsTabProps {
  workspaceId: string
  userRole: string
}

interface CopTemplate {
  id: string
  name: string
  description?: string
  cop_session_id: string
  cop_session_name: string
  created_at: string
}

// Hardcoded analysis tools
const ANALYSIS_TOOLS: { id: string; name: string; description: string; icon: typeof Table2; route: string }[] = [
  { id: 'cross-table', name: 'Cross-Table Analysis', description: 'Compare entities across multiple dimensions', icon: Table2, route: '/dashboard/cross-table' },
  { id: 'ach', name: 'ACH (Analysis of Competing Hypotheses)', description: 'Evaluate hypotheses against evidence', icon: Microscope, route: '/dashboard/frameworks/new' },
  { id: 'swot', name: 'SWOT Analysis', description: 'Strengths, weaknesses, opportunities, threats', icon: BarChart3, route: '/dashboard/frameworks/new' },
  { id: 'pmesii', name: 'PMESII-PT', description: 'Political, military, economic, social, information, infrastructure', icon: Globe, route: '/dashboard/frameworks/new' },
  { id: 'mom-pop', name: 'MOM-POP Assessment', description: 'Motive, opportunity, means \u2014 profile, operation, posture', icon: Target, route: '/dashboard/entities/actors' },
  { id: 'moses', name: 'MOSES Evaluation', description: 'Source vulnerability and reliability assessment', icon: Satellite, route: '/dashboard/entities/sources' },
  { id: 'cog', name: 'COG Analysis', description: 'Center of gravity analysis', icon: Scale, route: '/dashboard/frameworks/new' },
]

export function ToolsTab({ workspaceId, userRole }: ToolsTabProps) {
  const navigate = useNavigate()
  const [playbooks, setPlaybooks] = useState<CopTemplate[]>([])
  const [taskTemplates, setTaskTemplates] = useState<CopTemplate[]>([])
  const [intakeForms, setIntakeForms] = useState<CopTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetchTools(controller.signal)
    return () => controller.abort()
  }, [workspaceId])

  const fetchTools = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const headers: HeadersInit = { ...getCopHeaders() }
      const authToken = localStorage.getItem('auth_token')
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const response = await fetch(`/api/workspaces/${workspaceId}/tools`, { headers, signal })
      if (response.ok) {
        const data = await response.json()
        setPlaybooks(data.playbooks || [])
        setTaskTemplates(data.task_templates || [])
        setIntakeForms(data.intake_forms || [])
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') console.error('Failed to fetch tools:', error)
    } finally {
      setLoading(false)
    }
  }

  const hasTemplates = playbooks.length > 0 || taskTemplates.length > 0 || intakeForms.length > 0

  return (
    <div className="space-y-8">
      {/* Analysis Tools */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analysis Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ANALYSIS_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => navigate(`${tool.route}?workspace_id=${workspaceId}`)}
              className="text-left p-4 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <tool.icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                <div className="font-semibold text-sm text-gray-900 dark:text-white">{tool.name}</div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* COP Templates */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">COP Templates</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading templates...</div>
        ) : !hasTemplates ? (
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No COP templates in this workspace yet.</p>
            <p className="text-sm text-gray-500 mt-1">Create playbooks, task templates, or intake forms in a COP session.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {playbooks.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Play className="h-4 w-4" />Playbooks ({playbooks.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {playbooks.map((pb) => (
                    <button key={pb.id} onClick={() => navigate(`/dashboard/cop/${pb.cop_session_id}`)} className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="font-medium text-sm">{pb.name}</div>
                      <div className="text-xs text-gray-500">From: {pb.cop_session_name}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
            {taskTemplates.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Task Templates ({taskTemplates.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {taskTemplates.map((tt) => (
                    <button key={tt.id} onClick={() => navigate(`/dashboard/cop/${tt.cop_session_id}`)} className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="font-medium text-sm">{tt.name}</div>
                      <div className="text-xs text-gray-500">From: {tt.cop_session_name}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
            {intakeForms.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" />Intake Forms ({intakeForms.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {intakeForms.map((form) => (
                    <button key={form.id} onClick={() => navigate(`/dashboard/cop/${form.cop_session_id}`)} className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="font-medium text-sm">{form.name}</div>
                      <div className="text-xs text-gray-500">From: {form.cop_session_name}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
