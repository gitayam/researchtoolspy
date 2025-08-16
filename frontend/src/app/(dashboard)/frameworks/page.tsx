'use client'

import Link from 'next/link'
import { 
  Target, 
  Brain, 
  BarChart3, 
  Search, 
  Shield, 
  Zap, 
  Globe, 
  Users, 
  TrendingUp, 
  Eye,
  Lightbulb
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const frameworks = [
  {
    id: 'swot',
    title: 'SWOT Analysis',
    description: 'Strategic planning framework analyzing Strengths, Weaknesses, Opportunities, and Threats',
    icon: Target,
    color: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
    category: 'Strategic Planning',
    complexity: 'Beginner',
    estimatedTime: '15-30 min',
    available: true
  },
  {
    id: 'cog',
    title: 'COG Analysis',
    description: 'Center of Gravity analysis for identifying critical capabilities and vulnerabilities',
    icon: Brain,
    color: 'bg-green-500',
    hoverColor: 'hover:bg-green-600',
    category: 'Military Strategy',
    complexity: 'Intermediate',
    estimatedTime: '30-45 min',
    available: true
  },
  {
    id: 'pmesii-pt',
    title: 'PMESII-PT',
    description: 'Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time',
    icon: BarChart3,
    color: 'bg-purple-500',
    hoverColor: 'hover:bg-purple-600',
    category: 'Environmental Analysis',
    complexity: 'Advanced',
    estimatedTime: '45-60 min',
    available: true
  },
  {
    id: 'ach',
    title: 'ACH Analysis',
    description: 'Analysis of Competing Hypotheses for structured analytical thinking',
    icon: Search,
    color: 'bg-orange-500',
    hoverColor: 'hover:bg-orange-600',
    category: 'Hypothesis Testing',
    complexity: 'Advanced',
    estimatedTime: '60-90 min',
    available: true
  },
  {
    id: 'dime',
    title: 'DIME Analysis',
    description: 'Diplomatic, Information, Military, Economic instruments of national power',
    icon: Shield,
    color: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
    category: 'National Power',
    complexity: 'Intermediate',
    estimatedTime: '30-45 min',
    available: true
  },
  {
    id: 'vrio',
    title: 'VRIO Framework',
    description: 'Value, Rarity, Imitability, Organization analysis for competitive advantage',
    icon: Zap,
    color: 'bg-yellow-500',
    hoverColor: 'hover:bg-yellow-600',
    category: 'Competitive Analysis',
    complexity: 'Intermediate',
    estimatedTime: '20-30 min',
    available: true
  },
  {
    id: 'pest',
    title: 'PEST Analysis',
    description: 'Political, Economic, Social, Technological environmental factors analysis',
    icon: Globe,
    color: 'bg-teal-500',
    hoverColor: 'hover:bg-teal-600',
    category: 'Environmental Analysis',
    complexity: 'Beginner',
    estimatedTime: '20-30 min',
    available: true
  },
  {
    id: 'stakeholder',
    title: 'Stakeholder Analysis',
    description: 'Systematic identification and analysis of stakeholder influence and interest',
    icon: Users,
    color: 'bg-pink-500',
    hoverColor: 'hover:bg-pink-600',
    category: 'Relationship Mapping',
    complexity: 'Beginner',
    estimatedTime: '15-25 min',
    available: true
  },
  {
    id: 'trend',
    title: 'Trend Analysis',
    description: 'Systematic analysis of patterns and trends for forecasting and planning',
    icon: TrendingUp,
    color: 'bg-indigo-500',
    hoverColor: 'hover:bg-indigo-600',
    category: 'Forecasting',
    complexity: 'Intermediate',
    estimatedTime: '30-40 min',
    available: true
  },
  {
    id: 'surveillance',
    title: 'Surveillance Analysis',
    description: 'Systematic monitoring and analysis framework for research gathering',
    icon: Eye,
    color: 'bg-gray-500',
    hoverColor: 'hover:bg-gray-600',
    category: 'Research',
    complexity: 'Advanced',
    estimatedTime: '45-60 min',
    available: true
  },
  {
    id: 'starbursting',
    title: 'Starbursting',
    description: 'Systematic questioning framework with 5W analysis and URL processing',
    icon: Lightbulb,
    color: 'bg-amber-500',
    hoverColor: 'hover:bg-amber-600',
    category: 'Question Analysis',
    complexity: 'Intermediate',
    estimatedTime: '30-45 min',
    available: true
  }
]

const categories = ['All', 'Strategic Planning', 'Military Strategy', 'Environmental Analysis', 'Hypothesis Testing', 'National Power', 'Competitive Analysis', 'Relationship Mapping', 'Forecasting', 'Research', 'Question Analysis']

export default function FrameworksPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Analysis Frameworks</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Choose from 10 research analysis frameworks to structure your research and analysis
        </p>
      </div>

      {/* Available Frameworks */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-green-700 dark:text-green-400">Available Frameworks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {frameworks.filter(f => f.available).map((framework) => (
            <Link key={framework.id} href={`/frameworks/${framework.id}/create`}>
              <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full group">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${framework.color} ${framework.hoverColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <framework.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{framework.title}</CardTitle>
                  <CardDescription className="text-sm line-clamp-2">
                    {framework.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Category:</span>
                      <span className="font-medium">{framework.category}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Complexity:</span>
                      <span className={`font-medium ${
                        framework.complexity === 'Beginner' ? 'text-green-600' :
                        framework.complexity === 'Intermediate' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {framework.complexity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Time:</span>
                      <span className="font-medium">{framework.estimatedTime}</span>
                    </div>
                  </div>
                  <Button className={`w-full mt-4 ${framework.color} ${framework.hoverColor} text-white`}>
                    Start Analysis
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Coming Soon Frameworks */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-gray-500">Coming Soon</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {frameworks.filter(f => !f.available).map((framework) => (
            <Card key={framework.id} className="opacity-60 h-full">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${framework.color} opacity-50 flex items-center justify-center mb-3`}>
                  <framework.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">{framework.title}</CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {framework.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-medium">{framework.category}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Complexity:</span>
                    <span className={`font-medium ${
                      framework.complexity === 'Beginner' ? 'text-green-600' :
                      framework.complexity === 'Intermediate' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {framework.complexity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Time:</span>
                    <span className="font-medium">{framework.estimatedTime}</span>
                  </div>
                </div>
                <Button disabled className="w-full mt-4">
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}