/**
 * Public Frameworks Directory
 * 
 * Available to all users (anonymous and authenticated)
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Grid3x3, Target, TrendingUp, Brain, Search, Users, Building, DollarSign, Zap, Shield, AlertTriangle, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FrameworkRecommendationPanel } from '@/components/frameworks/framework-recommendation-panel'
// import { useIsAuthenticated } from '@/stores/auth' // Temporarily disabled

const frameworks = [
  {
    id: 'swot',
    title: 'SWOT Analysis',
    description: 'Analyze Strengths, Weaknesses, Opportunities, and Threats',
    icon: Grid3x3,
    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
    href: '/frameworks/swot/create',
    category: 'Strategic Planning'
  },
  {
    id: 'ach',
    title: 'ACH Analysis',
    description: 'Analysis of Competing Hypotheses with evidence evaluation',
    icon: Target,
    color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    href: '/frameworks/ach/create',
    category: 'Intelligence Analysis'
  },
  {
    id: 'cog',
    title: 'Center of Gravity',
    description: 'Identify critical capabilities and vulnerabilities',
    icon: Zap,
    color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
    href: '/frameworks/cog/create',
    category: 'Strategic Analysis'
  },
  {
    id: 'pmesii-pt',
    title: 'PMESII-PT Analysis',
    description: 'Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time',
    icon: BarChart3,
    color: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700',
    href: '/frameworks/pmesii-pt/create',
    category: 'Environmental Analysis'
  },
  {
    id: 'pest',
    title: 'PEST Analysis',
    description: 'Political, Economic, Social, and Technological factors',
    icon: TrendingUp,
    color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700',
    href: '/frameworks/pest/create',
    category: 'Environmental Analysis'
  },
  {
    id: 'stakeholder',
    title: 'Stakeholder Analysis',
    description: 'Map and analyze key stakeholders and their influence',
    icon: Users,
    color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700',
    href: '/frameworks/stakeholder/create',
    category: 'Stakeholder Management'
  },
  {
    id: 'vrio',
    title: 'VRIO Framework',
    description: 'Valuable, Rare, Inimitable, Organized resource analysis',
    icon: DollarSign,
    color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
    href: '/frameworks/vrio/create',
    category: 'Resource Analysis'
  }
]

export default function PublicFrameworksPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const isAuthenticated = false // Temporarily disabled to prevent infinite loop
  
  const filteredFrameworks = frameworks.filter(framework =>
    framework.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    framework.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    framework.category.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const categories = [...new Set(frameworks.map(f => f.category))]
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-12 px-4 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Strategic Analysis Frameworks
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Professional-grade analytical frameworks for strategic decision making, 
            intelligence analysis, and business planning. {!isAuthenticated && 'Start working immediately - no account required.'}
          </p>
          
          {!isAuthenticated && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg max-w-2xl mx-auto">
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                💡 <strong>Get started instantly:</strong> All frameworks work without an account. 
                Your work is automatically saved locally. Sign up to save to the cloud and access from any device.
              </p>
            </div>
          )}
        </div>
        
        {/* AI Framework Recommendations */}
        <div className="mb-8 max-w-4xl mx-auto">
          <FrameworkRecommendationPanel className="mb-8" />
        </div>
        
        {/* Search */}
        <div className="mb-8 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search frameworks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {/* Authentication Status */}
        <div className="flex justify-center mb-8">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Signed in - your work will be saved to your account
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                Working locally - work is saved in your browser
              </div>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Sign In to Save to Cloud
                </Button>
              </Link>
            </div>
          )}
        </div>
        
        {/* Framework Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFrameworks.map((framework) => {
            const Icon = framework.icon
            
            return (
              <Link key={framework.id} href={framework.href}>
                <Card className={`${framework.color} hover:shadow-lg transition-all duration-200 cursor-pointer group h-full`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm group-hover:scale-105 transition-transform">
                          <Icon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                        </div>
                        <div>
                          <CardTitle className="text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {framework.title}
                          </CardTitle>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {framework.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      {framework.description}
                    </CardDescription>
                    
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                        Start Analysis →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
        
        {/* No Results */}
        {filteredFrameworks.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No frameworks found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search terms
            </p>
          </div>
        )}
        
        {/* Features */}
        <div className="mt-16 pt-16 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Professional Analysis Tools
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Built for researchers, analysts, and strategic planners
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Auto-Save
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your work is automatically saved as you type. Never lose progress again.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Privacy First
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Work anonymously with local storage, or sign up for cloud sync and sharing.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Export Ready
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Professional reports in PDF, Word, Excel, and PowerPoint formats.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}