import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Grid3x3, MoreVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface SWOTAnalysis {
  session_id: number
  title: string
  objective: string
  context?: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  status: string
  version: number
  lastUpdated: string
}

export default function SWOTListPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [analyses, setAnalyses] = useState<SWOTAnalysis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalyses()
  }, [])

  const fetchAnalyses = async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<SWOTAnalysis[]>('/frameworks/swot')
      setAnalyses(data)
    } catch (error: any) {
      console.error('Failed to fetch SWOT analyses:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load SWOT analyses',
        variant: 'destructive'
      })
      // Use empty array as fallback
      setAnalyses([])
    } finally {
      setLoading(false)
    }
  }

  const filteredAnalyses = analyses.filter(analysis =>
    analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    analysis.objective.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analysis.context && analysis.context.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
      case 'in_progress': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
      case 'draft': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  const handleCreateNew = () => {
    navigate('/frameworks/swot/create')
  }

  const handleView = (id: number) => {
    navigate(`/frameworks/swot/${id}`)
  }

  const handleEdit = (id: number) => {
    navigate(`/frameworks/swot/${id}/edit`)
  }

  const handleDuplicate = async (analysis: SWOTAnalysis) => {
    try {
      const payload = {
        title: `${analysis.title} (Copy)`,
        objective: analysis.objective,
        context: analysis.context || '',
        initial_strengths: analysis.strengths,
        initial_weaknesses: analysis.weaknesses,
        initial_opportunities: analysis.opportunities,
        initial_threats: analysis.threats,
        request_ai_suggestions: false
      }

      const response = await apiClient.post<{ session_id: number }>('/frameworks/swot/', payload)

      toast({
        title: 'Success',
        description: 'SWOT analysis duplicated successfully'
      })

      // Refresh the list
      fetchAnalyses()

      // Navigate to the new analysis
      navigate(`/frameworks/swot/${response.session_id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate SWOT analysis',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await apiClient.delete(`/frameworks/swot/${id}`)
      toast({
        title: 'Success',
        description: 'SWOT analysis deleted successfully'
      })
      // Refresh the list
      fetchAnalyses()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete SWOT analysis',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">SWOT Analysis</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Strengths, Weaknesses, Opportunities, and Threats</p>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading SWOT analyses...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">SWOT Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Strengths, Weaknesses, Opportunities, and Threats</p>
        </div>
        <Button onClick={handleCreateNew}>
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

      <div className="grid gap-4">
        {filteredAnalyses.map((analysis) => (
          <Card key={analysis.session_id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => handleView(analysis.session_id)}
                      className="text-xl font-semibold hover:text-blue-600 transition-colors text-left"
                    >
                      {analysis.title}
                    </button>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                      {analysis.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{analysis.objective}</p>
                  {analysis.context && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">{analysis.context}</p>
                  )}

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Strengths</p>
                      <p className="text-xl font-semibold text-green-600 dark:text-green-400">{analysis.strengths.length}</p>
                    </div>
                    <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Weaknesses</p>
                      <p className="text-xl font-semibold text-red-600 dark:text-red-400">{analysis.weaknesses.length}</p>
                    </div>
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Opportunities</p>
                      <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">{analysis.opportunities.length}</p>
                    </div>
                    <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Threats</p>
                      <p className="text-xl font-semibold text-orange-600 dark:text-orange-400">{analysis.threats.length}</p>
                    </div>
                  </div>

                  <div className="text-sm text-gray-500 dark:text-gray-500">
                    Updated {new Date(analysis.lastUpdated).toLocaleDateString()}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleView(analysis.session_id)}>
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEdit(analysis.session_id)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(analysis)}>
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem>Export</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleDelete(analysis.session_id, analysis.title)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAnalyses.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <Grid3x3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No analyses found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first SWOT analysis'}
            </p>
            {!searchTerm && (
              <Button onClick={handleCreateNew}>
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