'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Brain, Shield, Zap, Users, BarChart3, Target, Unlock, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsAuthenticated } from '@/stores/auth'

export default function LandingPage() {
  const router = useRouter()
  const isAuthenticated = useIsAuthenticated()

  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const features = [
    {
      icon: Brain,
      title: "10 Analysis Frameworks",
      description: "SWOT, COG, PMESII-PT, ACH, DOTMLPF, and more specialized research frameworks"
    },
    {
      icon: Zap,
      title: "AI-Powered Insights",
      description: "GPT-5 integration for intelligent suggestions and automated analysis validation"
    },
    {
      icon: BarChart3,
      title: "Research Tools",
      description: "URL processing, web scraping, social media analysis, and citation management"
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "Share analyses, work in teams, and maintain version control for all projects"
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Role-based access control, secure authentication, and enterprise-grade security"
    },
    {
      icon: Target,
      title: "Export & Reporting",
      description: "Generate professional reports in PDF, Word, PowerPoint, and other formats"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                ResearchTools
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button 
                  size="lg" 
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 shadow-md"
                >
                  <Unlock className="mr-2 h-5 w-5" />
                  Login / Access Work
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" className="font-medium">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Create Bookmark
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center">
          <div className="mb-6">
            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/20 px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-300">
              🎉 Free for IrregularChat Community
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            <span className="text-blue-600">ResearchTools</span>
            <span className="block text-gray-900 dark:text-white">Advanced Research Analysis Platform</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Streamline your research analysis workflow with 10 specialized frameworks, 
            AI-powered insights, and comprehensive research tools. ResearchTools is a free service for the IrregularChat community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button 
                size="lg" 
                className="text-lg px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                <Unlock className="mr-2 h-6 w-6" />
                Login to Access Work
              </Button>
            </Link>
            <Link href="/register">
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-4 border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-semibold"
              >
                <KeyRound className="mr-2 h-5 w-5" />
                Create New Bookmark
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need for Research Analysis
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              From strategic planning to threat assessment, ResearchTools provides the tools 
              and frameworks professional analysts trust.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-xl text-gray-900 dark:text-gray-100">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Frameworks Showcase */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-800/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Professional Analysis Frameworks
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Industry-standard research analysis methodologies at your fingertips
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              "SWOT Analysis",
              "COG Analysis", 
              "PMESII-PT",
              "ACH Analysis",
              "DOTMLPF",
              "Deception Detection",
              "Behavioral Analysis",
              "Starbursting",
              "Causeway",
              "DIME Framework"
            ].map((framework, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white text-sm font-bold">{index + 1}</span>
                </div>
                <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {framework}
                </h3>
              </div>
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
                Ready to Transform Your Analysis Workflow?
              </h2>
              <p className="text-blue-100 dark:text-blue-200 mb-6 text-lg">
                Join research professionals who trust ResearchTools for their critical analysis work.
              </p>
              <Link href="/login">
                <Button 
                  size="lg" 
                  className="text-lg px-8 py-3 bg-white hover:bg-gray-100 text-blue-700 font-bold shadow-md"
                >
                  <Unlock className="mr-2 h-5 w-5" />
                  Login Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
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
  )
}
