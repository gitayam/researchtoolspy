'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Grid, MoreVertical, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { apiClient } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'

interface ACHAnalysis {
  id: number
  title: string
  description: string
  framework_type: string
  status: string
  data: {
    hypotheses: Array<{ id: string; text: string }>
    evidence: Array<{ 
      id: string
      text: string
      hypotheses_scores?: any
    }>
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function ACHListPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [analyses, setAnalyses] = useState<ACHAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchAnalyses()
  }, [])

  const fetchAnalyses = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get<ACHAnalysis[]>('/frameworks/', {
        params: { framework_type: 'ach' }
      })
      setAnalyses(response)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load ACH analyses',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredAnalyses = analyses.filter(analysis =>
    analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analysis.description && analysis.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDiagnosticityLevel = (analysis: ACHAnalysis) => {
    if (!analysis.data.evidence || analysis.data.evidence.length === 0) return 'None'
    if (analysis.data.evidence.length >= 10) return 'High'
    if (analysis.data.evidence.length >= 5) return 'Medium'
    return 'Low'
  }

  const getDiagnosticityColor = (level: string) => {
    switch (level) {
      case 'High': return 'text-green-600'
      case 'Medium': return 'text-yellow-600'
      case 'Low': return 'text-red-600'
      case 'None': return 'text-gray-400'
      default: return 'text-gray-600'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return 'Unknown'
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/frameworks/${id}`)
      toast({
        title: 'Success',
        description: 'Analysis deleted successfully'
      })
      fetchAnalyses()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete analysis',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-gray-500">Loading ACH analyses...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analysis of Competing Hypotheses</h1>
          <p className="text-gray-600 mt-2">Systematic analysis of alternative explanations</p>
        </div>
        <Link href="/frameworks/ach/create">
          <Button className="bg-orange-600 hover:bg-orange-700">
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input 
            placeholder="Search analyses..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Grid className="h-4 w-4 mr-2" />
          Grid View
        </Button>
      </div>

      <div className="space-y-4">
        {filteredAnalyses.length === 0 ? (
          <Card className="text-center py-12">
            <div className="mx-auto max-w-md">
              <h3 className="text-xl font-semibold mb-2">
                {searchTerm ? 'No analyses found' : 'No ACH Analyses Yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Get started by creating your first Analysis of Competing Hypotheses'
                }
              </p>
              {!searchTerm && (
                <Link href="/frameworks/ach/create">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Analysis
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          filteredAnalyses.map((analysis) => (
            <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link href={`/frameworks/ach/${analysis.id}`}>
                      <h3 className="text-xl font-semibold hover:text-blue-600 transition-colors">
                        {analysis.title}
                      </h3>
                    </Link>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                      {analysis.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4">{analysis.description || 'No description'}</p>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-gray-500">Hypotheses:</span>
                      <span className="ml-2 font-medium">{analysis.data.hypotheses?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Evidence:</span>
                      <span className="ml-2 font-medium">{analysis.data.evidence?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Diagnosticity:</span>
                      <span className={`ml-2 font-medium ${getDiagnosticityColor(getDiagnosticityLevel(analysis))}`}>
                        {getDiagnosticityLevel(analysis)}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      Updated {formatDate(analysis.updated_at)}
                    </div>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/frameworks/ach/${analysis.id}`}>View</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/frameworks/ach/${analysis.id}/edit`}>Edit</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={() => handleDelete(analysis.id)}
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
    </div>
  )
}