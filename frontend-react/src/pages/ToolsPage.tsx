import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, Globe, FileText, Link as LinkIcon, Code, Database, Share2, FileStack, ArrowLeft, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const tools = [
  {
    id: 'content-extraction',
    name: 'Content Extraction',
    description: 'Extract and analyze content from documents and web pages',
    icon: FileText,
    features: ['PDF parsing', 'HTML extraction', 'Text analysis', 'Metadata extraction']
  },
  {
    id: 'batch-processing',
    name: 'Batch Processing',
    description: 'Process multiple documents or URLs simultaneously',
    icon: FileStack,
    features: ['Bulk upload', 'Queue management', 'Progress tracking', 'Export results']
  },
  {
    id: 'url',
    name: 'URL Processing',
    description: 'Analyze and extract data from web URLs',
    icon: Globe,
    features: ['URL validation', 'Content scraping', 'Metadata extraction', 'Link analysis']
  },
  {
    id: 'citations-generator',
    name: 'Citations Generator',
    description: 'Generate and manage citations in multiple formats',
    icon: LinkIcon,
    features: ['APA 7th Edition', 'MLA 9th Edition', 'Chicago 17th', 'Harvard format']
  },
  {
    id: 'ach',
    name: 'ACH Analysis',
    description: 'Analysis of Competing Hypotheses - Structured intelligence methodology',
    icon: Grid3x3,
    features: ['Hypothesis matrix', 'Evidence evaluation', 'Logarithmic scoring', 'SATS integration']
  },
  {
    id: 'scraping',
    name: 'Web Scraping',
    description: 'Automated web data collection and extraction',
    icon: Code,
    features: ['Custom selectors', 'Scheduled scraping', 'Data transformation', 'Export options']
  },
  {
    id: 'social-media',
    name: 'Social Media Analysis',
    description: 'Analyze social media content and trends',
    icon: Share2,
    features: ['Platform integration', 'Sentiment analysis', 'Trend tracking', 'Export data']
  },
  {
    id: 'documents',
    name: 'Document Processing',
    description: 'Advanced document analysis and processing',
    icon: Database,
    features: ['Format conversion', 'Text extraction', 'OCR support', 'Batch processing']
  }
]

export function ToolsPage() {
  const { toolId } = useParams()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // If toolId is provided, show the specific tool detail
  if (toolId) {
    const tool = tools.find(t => t.id === toolId)
    if (!tool) {
      return (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Tool not found</h2>
          <Button onClick={() => navigate('/dashboard/tools')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tools
          </Button>
        </div>
      )
    }

    const Icon = tool.icon

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard/tools')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Icon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tool.name}</h1>
                <p className="text-gray-600 dark:text-gray-400">{tool.description}</p>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>Key capabilities of this tool</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tool.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Icon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Tool Interface Coming Soon</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The interactive interface for this tool is currently under development.
              </p>
              <Button disabled>
                Launch Tool
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show tools list
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Research Tools</h1>
        <p className="text-gray-600 dark:text-gray-400">Powerful tools for research and analysis</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search tools..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon
          return (
            <Card
              key={tool.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/dashboard/tools/${tool.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Icon className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="mt-4">{tool.name}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {tool.features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <div className="h-1 w-1 rounded-full bg-blue-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
