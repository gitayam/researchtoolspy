'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, ArrowLeft, GitBranch, Target, Layers } from 'lucide-react'

export default function CausewayPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/frameworks">
            <Button variant="ghost" className="mb-4 flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Frameworks
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <GitBranch className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Causeway Framework
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Structured approach for analyzing causal relationships and pathways in complex systems
              </p>
            </div>
          </div>
        </div>

        {/* Framework Description */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              About Causeway Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Framework Overview</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  The Causeway framework provides a systematic method for mapping and analyzing 
                  causal relationships within complex systems. It helps identify root causes, 
                  intermediate factors, and potential intervention points.
                </p>
                <h3 className="font-semibold mb-2">Key Applications:</h3>
                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Root cause analysis</li>
                  <li>• System dynamics mapping</li>
                  <li>• Policy impact assessment</li>
                  <li>• Risk pathway identification</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Analysis Components:</h3>
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Primary Causes
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Direct causal factors</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Pathways
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Causal chains and connections</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    <div className="font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Context Factors
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Environmental and situational influences</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/frameworks/causeway/create">
            <Button className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
              <GitBranch className="h-4 w-4" />
              Start Causeway Analysis
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Save & Collaborate
            </Button>
          </Link>
        </div>

        {/* Coming Soon Notice */}
        <Card className="mt-8">
          <CardContent className="p-6 text-center">
            <div className="text-green-600 dark:text-green-400 mb-2">
              <GitBranch className="h-8 w-8 mx-auto" />
            </div>
            <h3 className="font-semibold mb-2">Interactive Causeway Mapping Coming Soon</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We're building advanced causeway mapping tools with visual pathway diagrams 
              and AI-assisted causal relationship detection.
            </p>
            <Link href="/login">
              <Button variant="outline">
                Get Early Access
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}