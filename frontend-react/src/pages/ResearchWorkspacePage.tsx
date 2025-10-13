import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  CheckSquare,
  BarChart3,
  Activity,
  Plus,
  ArrowLeft,
  Database,
  ClipboardList
} from 'lucide-react'

interface WorkflowStage {
  id: string
  name: string
  order: number
}

interface ResearchTask {
  id: string
  workflow_stage: string
  task_title: string
  task_description?: string
  status: string
  priority: string
  created_at: string
}

interface EvidenceItem {
  id: string
  evidence_type: string
  title: string
  content?: string
  verification_status: string
  credibility_score?: number
  collected_at: string
  tags?: string[]
}

interface ResearchWorkspace {
  researchQuestionId: string
  question: string
  researchContext: string
  workflow?: {
    template: string
    stages: WorkflowStage[]
    evidenceTypes: string[]
    analysisTypes: string[]
  }
  tasks: ResearchTask[]
  evidence: EvidenceItem[]
}

const CONTEXT_ICONS: Record<string, string> = {
  academic: '🎓',
  osint: '🔍',
  investigation: '🕵️',
  business: '💼',
  journalism: '📰',
  personal: '🌱'
}

const CONTEXT_LABELS: Record<string, string> = {
  academic: 'Academic Research',
  osint: 'OSINT Investigation',
  investigation: 'Private Investigation',
  business: 'Business Research',
  journalism: 'Investigative Journalism',
  personal: 'Personal Research'
}

export default function ResearchWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [workspace, setWorkspace] = useState<ResearchWorkspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (id) {
      loadWorkspace(id)
    }
  }, [id])

  const loadWorkspace = async (researchQuestionId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Load research question details (mock for now - need actual API)
      const questionData = {
        id: researchQuestionId,
        question: 'Sample Research Question',
        researchContext: 'osint'
      }

      // Load tasks
      const tasksResponse = await fetch(`/api/research/tasks/list?researchQuestionId=${researchQuestionId}`)
      const tasksData = await tasksResponse.json()

      // Load evidence
      const evidenceResponse = await fetch(`/api/research/evidence/list?researchQuestionId=${researchQuestionId}`)
      const evidenceData = await evidenceResponse.json()

      setWorkspace({
        researchQuestionId,
        question: questionData.question,
        researchContext: questionData.researchContext,
        tasks: tasksData.tasks || [],
        evidence: evidenceData.evidence || []
      })

    } catch (err) {
      console.error('Failed to load workspace:', err)
      setError('Failed to load research workspace')
    } finally {
      setIsLoading(false)
    }
  }

  const initializeWorkflow = async () => {
    if (!workspace) return

    try {
      const response = await fetch('/api/research/workflow/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          researchQuestionId: workspace.researchQuestionId,
          researchContext: workspace.researchContext
        })
      })

      const data = await response.json()

      if (data.success) {
        // Reload workspace to get new tasks
        loadWorkspace(workspace.researchQuestionId)
      }
    } catch (err) {
      console.error('Failed to initialize workflow:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (error || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
            <CardDescription>{error || 'Workspace not found'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/dashboard/tools/research-question-generator')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Research Generator
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const tasksByStage = workspace.tasks.reduce((acc, task) => {
    if (!acc[task.workflow_stage]) {
      acc[task.workflow_stage] = []
    }
    acc[task.workflow_stage].push(task)
    return acc
  }, {} as Record<string, ResearchTask[]>)

  const contextIcon = CONTEXT_ICONS[workspace.researchContext] || '📋'
  const contextLabel = CONTEXT_LABELS[workspace.researchContext] || workspace.researchContext

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard/tools/research-question-generator')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-2xl">{contextIcon}</span>
                  <Badge variant="outline">{contextLabel}</Badge>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {workspace.question}
                </h1>
              </div>
            </div>

            {workspace.tasks.length === 0 && (
              <Button onClick={initializeWorkflow}>
                <Plus className="h-4 w-4 mr-2" />
                Initialize Workflow
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="overview">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <CheckSquare className="h-4 w-4 mr-2" />
              Tasks ({workspace.tasks.length})
            </TabsTrigger>
            <TabsTrigger value="evidence">
              <Database className="h-4 w-4 mr-2" />
              Evidence ({workspace.evidence.length})
            </TabsTrigger>
            <TabsTrigger value="analysis">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analysis
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{workspace.tasks.length}</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {workspace.tasks.filter(t => t.status === 'completed').length} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Evidence Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{workspace.evidence.length}</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {workspace.evidence.filter(e => e.verification_status === 'verified').length} verified
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Research Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center">
                    <span className="mr-2">{contextIcon}</span>
                    {contextLabel.split(' ')[0]}
                  </div>
                </CardContent>
              </Card>
            </div>

            {workspace.tasks.length === 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Get Started</CardTitle>
                  <CardDescription>
                    Initialize your research workflow to get started with evidence collection and analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={initializeWorkflow}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Initialize {contextLabel} Workflow
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-6">
            {workspace.workflow?.stages.map(stage => (
              <div key={stage.id} className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{stage.name}</h3>
                <div className="space-y-2">
                  {(tasksByStage[stage.id] || []).map(task => (
                    <Card key={task.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-3">
                          <CheckSquare className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{task.task_title}</p>
                            {task.task_description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {task.task_description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={task.priority === 'urgent' ? 'destructive' : 'outline'}>
                            {task.priority}
                          </Badge>
                          <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                            {task.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!tasksByStage[stage.id] || tasksByStage[stage.id].length === 0) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic p-4">
                      No tasks in this stage
                    </p>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Evidence Tab */}
          <TabsContent value="evidence" className="mt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Evidence Collection</h3>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Evidence
                </Button>
              </div>

              {workspace.evidence.map(item => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <FileText className="h-5 w-5 text-gray-400 mt-1" />
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          {item.content && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {item.content.substring(0, 200)}...
                            </p>
                          )}
                          <div className="flex items-center space-x-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {item.evidence_type}
                            </Badge>
                            <Badge
                              variant={item.verification_status === 'verified' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {item.verification_status}
                            </Badge>
                            {item.credibility_score && (
                              <span className="text-xs text-gray-500">
                                Score: {(item.credibility_score * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {workspace.evidence.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No evidence yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Start collecting evidence for your research
                    </p>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Evidence
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="mt-6">
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Analysis Tools</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Analysis tools coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
