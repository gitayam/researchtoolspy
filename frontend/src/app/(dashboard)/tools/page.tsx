'use client'

import Link from 'next/link'
import { 
  Globe, 
  FileText, 
  Link2, 
  Twitter, 
  Search, 
  Database,
  Clock,
  ChevronRight 
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const tools = [
  {
    id: 'content-extraction',
    title: 'Content Extraction',
    description: 'Extract and summarize content from web pages with AI',
    icon: Globe,
    status: 'available',
    href: '/tools/content-extraction'
  },
  {
    id: 'batch-processing',
    title: 'Batch Processing',
    description: 'Process multiple URLs simultaneously for bulk analysis',
    icon: Database,
    status: 'available',
    href: '/tools/batch-processing'
  },
  {
    id: 'citations',
    title: 'Citation Manager',
    description: 'Manage and format research citations',
    icon: FileText,
    status: 'coming-soon',
    href: '/tools/citations'
  },
  {
    id: 'scraping',
    title: 'Web Scraping',
    description: 'Extract structured data from websites',
    icon: Link2,
    status: 'coming-soon',
    href: '/tools/scraping'
  },
  {
    id: 'social-media',
    title: 'Social Media Analysis',
    description: 'Analyze social media content and trends',
    icon: Twitter,
    status: 'coming-soon',
    href: '/tools/social-media'
  },
  {
    id: 'documents',
    title: 'Document Analysis',
    description: 'Process and analyze documents',
    icon: Database,
    status: 'coming-soon',
    href: '/tools/documents'
  },
  {
    id: 'search',
    title: 'Advanced Search',
    description: 'Deep web and specialized database search',
    icon: Search,
    status: 'coming-soon',
    href: '/tools/search'
  }
]

export default function ToolsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Research Tools</h1>
        <p className="text-gray-600">
          Powerful tools for data collection, analysis, and research
        </p>
      </div>

      {/* Available Tools */}
      {tools.some(tool => tool.status === 'available') && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-green-700">Available Tools</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tools.filter(tool => tool.status === 'available').map((tool) => {
              const Icon = tool.icon
              return (
                <Card 
                  key={tool.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <Link href={tool.href}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Icon className="h-8 w-8 text-green-600" />
                        <Badge className="bg-green-100 text-green-800">Available</Badge>
                      </div>
                      <CardTitle className="mt-4">{tool.title}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-sm text-green-600">
                        <span>Use now</span>
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Coming Soon Tools */}
      {tools.some(tool => tool.status === 'coming-soon') && (
        <>
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-900">Coming Soon</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-blue-800">
                Additional research tools are being developed and will be available in upcoming releases. 
                These tools will integrate with your analysis frameworks to provide comprehensive research capabilities.
              </p>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-600">In Development</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tools.filter(tool => tool.status === 'coming-soon').map((tool) => {
                const Icon = tool.icon
                return (
                  <Card 
                    key={tool.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer opacity-75"
                  >
                    <Link href={tool.href}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Icon className="h-8 w-8 text-gray-400" />
                          <Badge variant="secondary">Coming Soon</Badge>
                        </div>
                        <CardTitle className="mt-4">{tool.title}</CardTitle>
                        <CardDescription>{tool.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center text-sm text-gray-500">
                          <span>Learn more</span>
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Planned Features</h2>
        <ul className="space-y-2 text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-1">•</span>
            <span>Real-time web content extraction and analysis</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-1">•</span>
            <span>Automated citation formatting (APA, MLA, Chicago)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-1">•</span>
            <span>Social media sentiment analysis and trend detection</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-1">•</span>
            <span>PDF and document text extraction with OCR</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-1">•</span>
            <span>Integration with analysis frameworks for seamless workflow</span>
          </li>
        </ul>
      </div>
    </div>
  )
}