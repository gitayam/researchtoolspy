import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Globe, 
  Search, 
  FileText, 
  Quote, 
  Share2, 
  ArrowLeft,
  ExternalLink,
  Zap
} from 'lucide-react'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'

export default function ToolsPage() {
  const tools = [
    {
      icon: Globe,
      title: "URL Processing",
      description: "Extract and analyze content from web URLs, process multiple links, and gather structured data",
      path: "/tools/url-processing",
      features: ["Bulk URL processing", "Content extraction", "Metadata analysis"]
    },
    {
      icon: Search,
      title: "Web Scraping",
      description: "Advanced web scraping tools for research data collection and content analysis",
      path: "/tools/web-scraping", 
      features: ["Custom scraping rules", "Data export", "Real-time monitoring"]
    },
    {
      icon: Share2,
      title: "Social Media Analysis",
      description: "Analyze social media content, trends, and sentiment for research insights",
      path: "/tools/social-media",
      features: ["Sentiment analysis", "Trend tracking", "Content classification"]
    },
    {
      icon: Quote,
      title: "Citation Management",
      description: "Organize, format, and manage research citations and bibliographic data",
      path: "/tools/citations",
      features: ["Multiple formats", "Auto-formatting", "Export options"]
    },
    {
      icon: FileText,
      title: "Document Processing",
      description: "Process, analyze, and extract insights from various document formats",
      path: "/tools/document-processing",
      features: ["PDF analysis", "Text extraction", "Content summarization"]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Sidebar */}
      <DashboardSidebar />
      
      {/* Main content with sidebar offset */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  Research Tools
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="sm">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Research <span className="text-blue-600">Tools</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Comprehensive research tools for data collection, processing, and analysis. 
              Extract insights from web content, manage citations, and process documents efficiently.
            </p>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tools.map((tool, index) => (
              <Card key={index} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-200 group">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
                    <tool.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-xl text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {tool.title}
                    <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-400 mb-4">
                    {tool.description}
                  </CardDescription>
                  
                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-200">Key Features:</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {tool.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link href={tool.path}>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                      Launch Tool
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <Card className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 border-0">
            <CardContent className="p-8 text-center">
              <h2 className="text-3xl font-bold mb-4 text-white">
                Need More Advanced Features?
              </h2>
              <p className="text-blue-100 dark:text-blue-200 mb-6 text-lg">
                Sign up for full access to all research tools, analysis frameworks, and collaboration features.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" className="bg-white hover:bg-gray-100 text-blue-700 font-bold">
                    Create Free Account
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                    Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-700 py-8 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white">ResearchTools</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Research Analysis Platform • Free for IrregularChat Community
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Research Tools - ResearchTools',
  description: 'Comprehensive research tools for data collection, processing, and analysis.',
}