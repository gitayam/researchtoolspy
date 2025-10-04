import { FrameworkPlaceholder } from './FrameworkPlaceholder'
import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Plus, Search, Grid3x3, MoreVertical, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SwotForm } from '@/components/frameworks/SwotForm'
import { SwotView } from '@/components/frameworks/SwotView'
import { GenericFrameworkForm } from '@/components/frameworks/GenericFrameworkForm'
import { GenericFrameworkView } from '@/components/frameworks/GenericFrameworkView'
import { DeceptionForm } from '@/components/frameworks/DeceptionForm'
import { DeceptionView } from '@/components/frameworks/DeceptionView'
import { frameworkConfigs } from '@/config/framework-configs'
import { frameworkDescriptions } from '@/config/framework-descriptions'

export const SwotPage = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [analyses, setAnalyses] = useState<any[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()

  // Check if we're in create/edit/view mode
  const isCreateMode = location.pathname.includes('/create')
  const isEditMode = location.pathname.includes('/edit')
  const isViewMode = id && !isEditMode && !isCreateMode

  // Load analyses
  useEffect(() => {
    loadAnalyses()
  }, [])

  // Load specific analysis
  useEffect(() => {
    if (id) {
      loadAnalysis(id)
    }
  }, [id])

  const loadAnalyses = async () => {
    try {
      const response = await fetch('/api/frameworks')
      if (response.ok) {
        const data = await response.json()
        // Filter for SWOT analyses only
        const swotAnalyses = (data.frameworks || []).filter((f: any) => f.framework_type === 'swot')
        setAnalyses(swotAnalyses)
      }
    } catch (error) {
      console.error('Failed to load analyses:', error)
    }
  }

  const loadAnalysis = async (analysisId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/frameworks?id=${analysisId}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentAnalysis(data)
      }
    } catch (error) {
      console.error('Failed to load analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: any) => {
    const payload = {
      framework_type: 'swot',
      title: data.title,
      description: data.description,
      data: data,
      status: 'active'
    }

    if (isEditMode && id) {
      // Update existing
      const response = await fetch(`/api/frameworks?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error('Failed to update')
    } else {
      // Create new
      const response = await fetch('/api/frameworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error('Failed to create')
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('Are you sure you want to delete this analysis?')) return

    try {
      const response = await fetch(`/api/frameworks?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        navigate('/dashboard/analysis-frameworks/swot-dashboard')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete analysis')
    }
  }

  // Show form for create mode
  if (isCreateMode) {
    return <SwotForm mode="create" onSave={handleSave} />
  }

  // Show form for edit mode
  if (isEditMode && currentAnalysis) {
    const parsedData = JSON.parse(currentAnalysis.data || '{}')
    return (
      <SwotForm
        mode="edit"
        initialData={{
          ...parsedData,
          title: currentAnalysis.title,
          description: currentAnalysis.description
        }}
        onSave={handleSave}
      />
    )
  }

  // Show view for view mode
  if (isViewMode && currentAnalysis) {
    const parsedData = JSON.parse(currentAnalysis.data || '{}')
    return (
      <SwotView
        data={{
          ...parsedData,
          id: currentAnalysis.id,
          title: currentAnalysis.title,
          description: currentAnalysis.description,
          created_at: currentAnalysis.created_at,
          updated_at: currentAnalysis.updated_at
        }}
        onEdit={() => navigate(`/dashboard/analysis-frameworks/swot-dashboard/${id}/edit`)}
        onDelete={handleDelete}
      />
    )
  }

  // Loading state
  if ((isEditMode || isViewMode) && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  const filteredAnalyses = analyses.filter(analysis =>
    analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analysis.description && analysis.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
      case 'active': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
      case 'draft': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const frameworkInfo = frameworkDescriptions['swot']

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">SWOT Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Strengths, Weaknesses, Opportunities, and Threats</p>
        </div>
        <Button onClick={() => {
          console.log('SWOT New Analysis button clicked, navigating to:', '/dashboard/analysis-frameworks/swot-dashboard/create')
          navigate('/dashboard/analysis-frameworks/swot-dashboard/create')
        }}>
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {/* Framework Context */}
      <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">{frameworkInfo.context}</p>

            {frameworkInfo.wikipediaUrl && (
              <a
                href={frameworkInfo.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                Learn more on Wikipedia
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Good Use Cases
                </h4>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  {frameworkInfo.goodUseCases.map((useCase, idx) => (
                    <li key={idx}>{useCase}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Not Ideal For
                </h4>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  {frameworkInfo.notIdealFor.map((useCase, idx) => (
                    <li key={idx}>{useCase}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search analyses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredAnalyses.map((analysis) => {
          const parsedData = JSON.parse(analysis.data || '{}')
          return (
            <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3
                        className="text-xl font-semibold hover:text-blue-600 transition-colors cursor-pointer"
                        onClick={() => navigate(`/dashboard/analysis-frameworks/swot-dashboard/${analysis.id}`)}
                      >
                        {analysis.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                        {analysis.status}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{analysis.description}</p>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Strengths</p>
                        <p className="text-xl font-semibold text-green-600 dark:text-green-400">{parsedData.strengths?.length || 0}</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Weaknesses</p>
                        <p className="text-xl font-semibold text-red-600 dark:text-red-400">{parsedData.weaknesses?.length || 0}</p>
                      </div>
                      <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Opportunities</p>
                        <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">{parsedData.opportunities?.length || 0}</p>
                      </div>
                      <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Threats</p>
                        <p className="text-xl font-semibold text-orange-600 dark:text-orange-400">{parsedData.threats?.length || 0}</p>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      Updated {new Date(analysis.updated_at).toLocaleDateString()}
                    </div>
                  </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/dashboard/analysis-frameworks/swot-dashboard/${analysis.id}`)}>
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/dashboard/analysis-frameworks/swot-dashboard/${analysis.id}/edit`)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem>Export</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
          )
        })}
      </div>

      {filteredAnalyses.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Grid3x3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No analyses found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first SWOT analysis'}
            </p>
            {!searchTerm && (
              <Button onClick={() => navigate('/dashboard/analysis-frameworks/swot-dashboard/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Analysis
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Generic Framework Page with full CRUD
const GenericFrameworkPage = ({ frameworkKey }: { frameworkKey: string }) => {
  const config = frameworkConfigs[frameworkKey]
  const [analyses, setAnalyses] = useState<any[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()

  const isCreateMode = location.pathname.includes('/create')
  const isEditMode = location.pathname.includes('/edit')
  const isViewMode = id && !isEditMode && !isCreateMode
  const basePath = `/dashboard/analysis-frameworks/${frameworkKey}`

  useEffect(() => {
    loadAnalyses()
  }, [])

  useEffect(() => {
    if (id) {
      loadAnalysis(id)
    }
  }, [id])

  const loadAnalyses = async () => {
    try {
      const response = await fetch('/api/frameworks')
      if (response.ok) {
        const data = await response.json()
        const filtered = (data.frameworks || []).filter((f: any) => f.framework_type === frameworkKey)
        setAnalyses(filtered)
      }
    } catch (error) {
      console.error('Failed to load analyses:', error)
    }
  }

  const loadAnalysis = async (analysisId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/frameworks?id=${analysisId}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentAnalysis(data)
      }
    } catch (error) {
      console.error('Failed to load analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: any) => {
    const payload = {
      framework_type: frameworkKey,
      title: data.title,
      description: data.description,
      data: data,
      status: 'active'
    }

    if (isEditMode && id) {
      const response = await fetch(`/api/frameworks?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error('Failed to update')
    } else {
      const response = await fetch('/api/frameworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error('Failed to create')
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('Are you sure you want to delete this analysis?')) return

    try {
      const response = await fetch(`/api/frameworks?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        navigate(basePath)
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete analysis')
    }
  }

  if (isCreateMode) {
    return <GenericFrameworkForm mode="create" sections={config.sections} frameworkType={config.type} frameworkTitle={config.title} onSave={handleSave} backPath={basePath} />
  }

  if (isEditMode && currentAnalysis) {
    const parsedData = JSON.parse(currentAnalysis.data || '{}')
    return (
      <GenericFrameworkForm
        mode="edit"
        sections={config.sections}
        frameworkType={config.type}
        frameworkTitle={config.title}
        initialData={{
          ...parsedData,
          title: currentAnalysis.title,
          description: currentAnalysis.description
        }}
        onSave={handleSave}
        backPath={basePath}
        frameworkId={currentAnalysis.id.toString()}
      />
    )
  }

  if (isViewMode && currentAnalysis) {
    const parsedData = JSON.parse(currentAnalysis.data || '{}')
    return (
      <GenericFrameworkView
        data={{
          ...parsedData,
          id: currentAnalysis.id,
          title: currentAnalysis.title,
          description: currentAnalysis.description,
          created_at: currentAnalysis.created_at,
          updated_at: currentAnalysis.updated_at
        }}
        sections={config.sections}
        frameworkTitle={config.title}
        onEdit={() => navigate(`${basePath}/${id}/edit`)}
        onDelete={handleDelete}
        backPath={basePath}
      />
    )
  }

  if ((isEditMode || isViewMode) && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  const filteredAnalyses = analyses.filter(analysis =>
    analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analysis.description && analysis.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
      case 'active': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
      case 'draft': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const frameworkInfo = frameworkDescriptions[frameworkKey]

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{config.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{config.description}</p>
        </div>
        <Button onClick={() => navigate(`${basePath}/create`)}>
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {/* Framework Context */}
      {frameworkInfo && (
        <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">{frameworkInfo.context}</p>

              {frameworkInfo.wikipediaUrl && (
                <a
                  href={frameworkInfo.wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Learn more on Wikipedia
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Good Use Cases
                  </h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {frameworkInfo.goodUseCases.map((useCase, idx) => (
                      <li key={idx}>{useCase}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Not Ideal For
                  </h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {frameworkInfo.notIdealFor.map((useCase, idx) => (
                      <li key={idx}>{useCase}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search analyses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredAnalyses.map((analysis) => {
          const parsedData = JSON.parse(analysis.data || '{}')
          return (
            <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3
                        className="text-xl font-semibold hover:text-blue-600 transition-colors cursor-pointer"
                        onClick={() => navigate(`${basePath}/${analysis.id}`)}
                      >
                        {analysis.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                        {analysis.status}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{analysis.description}</p>

                    <div className={`grid grid-cols-${config.sections.length} gap-2 mb-4`}>
                      {config.sections.map(section => (
                        <div key={section.key} className={`text-center p-2 ${section.bgColor} rounded`}>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{section.label}</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{parsedData[section.key]?.length || 0}</p>
                        </div>
                      ))}
                    </div>

                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      Updated {new Date(analysis.updated_at).toLocaleDateString()}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`${basePath}/${analysis.id}`)}>
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`${basePath}/${analysis.id}/edit`)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>Export</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredAnalyses.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Grid3x3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No analyses found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : `Get started by creating your first ${config.title} analysis`}
            </p>
            {!searchTerm && (
              <Button onClick={() => navigate(`${basePath}/create`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Analysis
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Generic Framework List Component (for frameworks not yet implemented)
const FrameworkListPage = ({ title, description, frameworkType }: { title: string; description: string; frameworkType: string }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const { id, action } = useParams()
  const location = useLocation()
  const mockAnalyses: any[] = []

  // Check if we're in create/edit/view mode
  const isCreateMode = location.pathname.includes('/create') || action === 'create'
  const isEditMode = location.pathname.includes('/edit') || action === 'edit'
  const isViewMode = (id && !isEditMode && !isCreateMode) || (action && action !== 'create' && action !== 'edit')

  // Show placeholder for create/edit/view modes
  if (isCreateMode || isEditMode || isViewMode) {
    return (
      <FrameworkPlaceholder
        title={isCreateMode ? `Create ${title}` : isEditMode ? `Edit ${title}` : `View ${title}`}
        description={`${title} form will be implemented here`}
        frameworkType={frameworkType}
      />
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{description}</p>
        </div>
        <Button onClick={() => navigate(`/dashboard/analysis-frameworks/${frameworkType}/create`)}>
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search analyses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="text-center py-12">
          <Grid3x3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No analyses found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get started by creating your first {title.toLowerCase()} analysis
          </p>
          <Button onClick={() => navigate(`/dashboard/analysis-frameworks/${frameworkType}/create`)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Analysis
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export const AchPage = () => (
  <FrameworkListPage
    title="ACH Analysis"
    description="Analysis of Competing Hypotheses"
    frameworkType="ach-dashboard"
  />
)

export const CogPage = () => <GenericFrameworkPage frameworkKey="cog" />

export const PmesiiPtPage = () => <GenericFrameworkPage frameworkKey="pmesii-pt" />

export const DotmlpfPage = () => <GenericFrameworkPage frameworkKey="dotmlpf" />

export const DeceptionPage = () => {
  const config = frameworkConfigs['deception']
  const [analyses, setAnalyses] = useState<any[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()

  const isCreateMode = location.pathname.includes('/create')
  const isEditMode = location.pathname.includes('/edit')
  const isViewMode = id && !isEditMode && !isCreateMode
  const basePath = '/dashboard/analysis-frameworks/deception'

  useEffect(() => {
    loadAnalyses()
  }, [])

  useEffect(() => {
    if (id) {
      loadAnalysis(id)
    }
  }, [id])

  const loadAnalyses = async () => {
    try {
      const response = await fetch('/api/frameworks')
      if (response.ok) {
        const data = await response.json()
        const filtered = (data.frameworks || []).filter((f: any) => f.framework_type === 'deception')
        setAnalyses(filtered)
      }
    } catch (error) {
      console.error('Failed to load analyses:', error)
    }
  }

  const loadAnalysis = async (analysisId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/frameworks?id=${analysisId}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentAnalysis(data)
      }
    } catch (error) {
      console.error('Failed to load analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: any) => {
    const payload = {
      framework_type: 'deception',
      title: data.title,
      description: data.description,
      data: data,
      status: 'active'
    }

    if (isEditMode && id) {
      const response = await fetch(`/api/frameworks?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error('Failed to update')
    } else {
      const response = await fetch('/api/frameworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error('Failed to create')
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('Are you sure you want to delete this analysis?')) return

    try {
      const response = await fetch(`/api/frameworks?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        navigate(basePath)
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete analysis')
    }
  }

  if (isCreateMode) {
    return <DeceptionForm mode="create" onSave={handleSave} backPath={basePath} />
  }

  if (isEditMode && currentAnalysis) {
    const parsedData = JSON.parse(currentAnalysis.data || '{}')
    return (
      <DeceptionForm
        mode="edit"
        initialData={{
          ...parsedData,
          title: currentAnalysis.title,
          description: currentAnalysis.description
        }}
        onSave={handleSave}
        backPath={basePath}
        frameworkId={currentAnalysis.id.toString()}
      />
    )
  }

  if (isViewMode && currentAnalysis) {
    const parsedData = JSON.parse(currentAnalysis.data || '{}')
    return (
      <DeceptionView
        data={{
          ...parsedData,
          id: currentAnalysis.id,
          title: currentAnalysis.title,
          description: currentAnalysis.description,
          created_at: currentAnalysis.created_at,
          updated_at: currentAnalysis.updated_at
        }}
        onEdit={() => navigate(`${basePath}/${id}/edit`)}
        onDelete={handleDelete}
        backPath={basePath}
      />
    )
  }

  if ((isEditMode || isViewMode) && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  const filteredAnalyses = analyses.filter(analysis =>
    analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analysis.description && analysis.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
      case 'active': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
      case 'draft': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const frameworkInfo = frameworkDescriptions['deception']

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{config.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{config.description}</p>
        </div>
        <Button onClick={() => navigate(`${basePath}/create`)}>
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {/* Framework Context */}
      <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">{frameworkInfo.context}</p>

            {frameworkInfo.wikipediaUrl && (
              <a
                href={frameworkInfo.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                Learn more on Wikipedia
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Good Use Cases
                </h4>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  {frameworkInfo.goodUseCases.map((useCase, idx) => (
                    <li key={idx}>{useCase}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Not Ideal For
                </h4>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  {frameworkInfo.notIdealFor.map((useCase, idx) => (
                    <li key={idx}>{useCase}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search deception analyses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredAnalyses.map((analysis) => {
          const parsedData = JSON.parse(analysis.data || '{}')
          const assessment = parsedData.calculatedAssessment
          return (
            <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3
                        className="text-xl font-semibold hover:text-blue-600 transition-colors cursor-pointer"
                        onClick={() => navigate(`${basePath}/${analysis.id}`)}
                      >
                        {analysis.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                        {analysis.status}
                      </span>
                      {assessment && (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          assessment.riskLevel === 'CRITICAL' ? 'bg-red-600 text-white' :
                          assessment.riskLevel === 'HIGH' ? 'bg-orange-500 text-white' :
                          assessment.riskLevel === 'MEDIUM' ? 'bg-yellow-500 text-gray-900' :
                          'bg-green-600 text-white'
                        }`}>
                          {assessment.overallLikelihood}% DECEPTION RISK
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{analysis.description}</p>

                    {assessment && (
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          <p className="text-xs text-gray-600 dark:text-gray-400">MOM</p>
                          <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                            {assessment.categoryScores.mom.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                          <p className="text-xs text-gray-600 dark:text-gray-400">POP</p>
                          <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                            {assessment.categoryScores.pop.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          <p className="text-xs text-gray-600 dark:text-gray-400">MOSES</p>
                          <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                            {assessment.categoryScores.moses.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <p className="text-xs text-gray-600 dark:text-gray-400">EVE</p>
                          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                            {assessment.categoryScores.eve.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      Updated {new Date(analysis.updated_at).toLocaleDateString()}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`${basePath}/${analysis.id}`)}>
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`${basePath}/${analysis.id}/edit`)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>Export</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredAnalyses.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Grid3x3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No analyses found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first deception analysis using CIA SATS methodology'}
            </p>
            {!searchTerm && (
              <Button onClick={() => navigate(`${basePath}/create`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Analysis
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export const BehaviorPage = () => <GenericFrameworkPage frameworkKey="behavior" />

export const StarburstingPage = () => <GenericFrameworkPage frameworkKey="starbursting" />

export const CausewayPage = () => <GenericFrameworkPage frameworkKey="causeway" />

export const DimePage = () => <GenericFrameworkPage frameworkKey="dime" />

export const PestPage = () => <GenericFrameworkPage frameworkKey="pest" />

export const StakeholderPage = () => <GenericFrameworkPage frameworkKey="stakeholder" />

export const SurveillancePage = () => (
  <FrameworkListPage
    title="Surveillance Framework"
    description="Surveillance Pattern Analysis"
    frameworkType="surveillance"
  />
)

export const FundamentalFlowPage = () => (
  <FrameworkListPage
    title="Fundamental Flow Analysis"
    description="Flow and Process Analysis"
    frameworkType="fundamental-flow"
  />
)
