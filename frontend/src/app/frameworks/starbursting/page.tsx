'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, ArrowLeft, Star, HelpCircle, Lightbulb } from 'lucide-react'

export default function StarburstingPage() {
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
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Star className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Starbursting Framework
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Question-based brainstorming technique for comprehensive problem analysis
              </p>
            </div>
          </div>
        </div>

        {/* Framework Description */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              About Starbursting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">What is Starbursting?</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Starbursting is a brainstorming technique that focuses on generating questions 
                  rather than answers. It uses the six universal questions (Who, What, When, 
                  Where, Why, How) to explore all aspects of a topic or problem.
                </p>
                <h3 className="font-semibold mb-2">Key Benefits:</h3>
                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Comprehensive problem exploration</li>
                  <li>• Identifies knowledge gaps</li>
                  <li>• Encourages critical thinking</li>
                  <li>• Structured approach to analysis</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">The Six Questions:</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div className="font-medium text-blue-700 dark:text-blue-400">Who?</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">People involved</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div className="font-medium text-green-700 dark:text-green-400">What?</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Actions & events</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                    <div className="font-medium text-purple-700 dark:text-purple-400">When?</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Timing & schedule</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    <div className="font-medium text-orange-700 dark:text-orange-400">Where?</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Location & context</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <div className="font-medium text-red-700 dark:text-red-400">Why?</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Purpose & reasons</div>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
                    <div className="font-medium text-indigo-700 dark:text-indigo-400">How?</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Methods & processes</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/frameworks/starbursting/create">
            <Button className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Start New Starbursting Analysis
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Save & Access Previous Work
            </Button>
          </Link>
        </div>

        {/* Coming Soon Notice */}
        <Card className="mt-8">
          <CardContent className="p-6 text-center">
            <div className="text-blue-600 dark:text-blue-400 mb-2">
              <Star className="h-8 w-8 mx-auto" />
            </div>
            <h3 className="font-semibold mb-2">Interactive Framework Coming Soon</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We're building an interactive Starbursting analysis tool. For now, you can use 
              this framework as a reference guide.
            </p>
            <Link href="/login">
              <Button variant="outline">
                Get Notified When Ready
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}