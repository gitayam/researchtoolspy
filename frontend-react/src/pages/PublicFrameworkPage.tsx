import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Copy, Download, Eye, ArrowLeft, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

export function PublicFrameworkPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [framework, setFramework] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cloning, setCloning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    fetch(`/api/frameworks/public/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Framework not found')
        return res.json()
      })
      .then(setFramework)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  const handleClone = async () => {
    if (!token) return

    setCloning(true)
    try {
      const response = await fetch(`/api/frameworks/public/${token}/clone`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.saved_to === 'workspace') {
        // Logged-in user - redirect to their copy
        navigate(data.redirect)
      } else {
        // Guest user - save to localStorage and redirect to create page
        const draftKey = `draft_${framework.framework_type}_new`
        localStorage.setItem(draftKey, JSON.stringify(data.framework))
        navigate(`/frameworks/${framework.framework_type}/create`)
        alert('Framework cloned! You\'re now working in guest mode (7 days). Sign in to save permanently.')
      }
    } catch (error) {
      console.error('Failed to clone:', error)
      alert('Failed to clone framework')
    } finally {
      setCloning(false)
    }
  }

  const handleExport = () => {
    // TODO: Implement export functionality
    alert('Export functionality coming soon!')
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading public framework...</p>
        </div>
      </div>
    )
  }

  if (error || !framework) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {error || 'Framework not found'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/')} className="mt-4" variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Home
        </Button>
      </div>
    )
  }

  const frameworkTypeLabel = framework.framework_type === 'behavior' ? 'Behavior Analysis' :
    framework.framework_type === 'comb-analysis' ? 'COM-B Analysis' :
    framework.framework_type.toUpperCase()

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className="gap-1">
            <Eye className="h-3 w-3" />
            Public
          </Badge>
          <Badge variant="outline">{frameworkTypeLabel}</Badge>
          {framework.category && (
            <Badge variant="outline" className="capitalize">{framework.category}</Badge>
          )}
        </div>

        <h1 className="text-3xl font-bold mt-2">{framework.title}</h1>

        {framework.description && (
          <p className="text-gray-600 dark:text-gray-400 mt-2">{framework.description}</p>
        )}

        <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {framework.view_count} views
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {framework.clone_count} clones
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Button onClick={handleClone} disabled={cloning} className="gap-2">
          <Copy className="h-4 w-4" />
          {cloning ? 'Cloning...' : 'Clone to My Workspace'}
        </Button>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <Separator className="mb-6" />

      {/* Framework Content */}
      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Framework details and context</CardDescription>
          </CardHeader>
          <CardContent>
            {framework.data?.source_url && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-1">Source</p>
                <a
                  href={framework.data.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {framework.data.source_url}
                </a>
              </div>
            )}

            {/* Behavior-specific context */}
            {framework.framework_type === 'behavior' && framework.data?.location_context && (
              <div className="space-y-3">
                {framework.data.location_context.specific_locations?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Locations</p>
                    <div className="flex flex-wrap gap-2">
                      {framework.data.location_context.specific_locations.map((loc: string, i: number) => (
                        <Badge key={i} variant="secondary">{loc}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {framework.data.behavior_settings?.settings?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Settings</p>
                    <div className="flex flex-wrap gap-2">
                      {framework.data.behavior_settings.settings.map((setting: string, i: number) => (
                        <Badge key={i} variant="outline">{setting}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {framework.data.temporal_context?.frequency_pattern && (
                  <div>
                    <p className="text-sm font-medium mb-1">Frequency</p>
                    <Badge variant="outline" className="capitalize">
                      {framework.data.temporal_context.frequency_pattern.replace('_', ' ')}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Framework Data Sections */}
        {Object.entries(framework.data || {}).map(([key, value]) => {
          if (!value || !Array.isArray(value) || value.length === 0) return null
          if (['title', 'description', 'source_url', 'location_context', 'behavior_settings', 'temporal_context', 'eligibility', 'complexity', 'com_b_deficits', 'selected_interventions'].includes(key)) return null

          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="capitalize">{key.replace(/_/g, ' ')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {value.map((item: any, index: number) => (
                    <li key={index} className="text-sm">
                      {typeof item === 'string' ? item : item.label || item.question || item.name || JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}

        {/* Empty State */}
        {Object.keys(framework.data || {}).filter(key =>
          Array.isArray(framework.data[key]) && framework.data[key].length > 0
        ).length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <p>This framework doesn't have detailed content yet.</p>
              <p className="text-sm mt-2">Clone it to add your own analysis!</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <strong>Want to use this framework?</strong> Click "Clone to My Workspace" to create your own copy.
          {!framework.is_authenticated && ' Sign in to save permanently, or work in guest mode for 7 days.'}
        </p>
      </div>
    </div>
  )
}
