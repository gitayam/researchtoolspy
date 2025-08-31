'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, ArrowLeft, Users, TrendingUp, BarChart3 } from 'lucide-react'

export default function BehavioralAnalysisPage() {
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
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Behavioral Analysis Framework
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Systematic approach to understanding and predicting human behavior patterns
              </p>
            </div>
          </div>
        </div>

        {/* Framework Description */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              About Behavioral Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Framework Overview</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Behavioral Analysis provides structured methods for examining human behavior 
                  patterns, motivations, and decision-making processes. It combines psychological 
                  principles with analytical techniques to predict and understand actions.
                </p>
                <h3 className="font-semibold mb-2">Key Applications:</h3>
                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Individual behavior prediction</li>
                  <li>• Group dynamics analysis</li>
                  <li>• Risk assessment and profiling</li>
                  <li>• Intervention planning</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Analysis Dimensions:</h3>
                <div className="space-y-3">
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                    <div className="font-medium text-purple-700 dark:text-purple-400 flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Cognitive Patterns
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Thinking processes and decision-making</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Behavioral Trends
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Historical patterns and changes</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Social Context
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Environmental and social influences</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/frameworks/behavioral-analysis/create">
            <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
              <BarChart3 className="h-4 w-4" />
              Start Behavioral Analysis
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Access Professional Tools
            </Button>
          </Link>
        </div>

        {/* Coming Soon Notice */}
        <Card className="mt-8">
          <CardContent className="p-6 text-center">
            <div className="text-purple-600 dark:text-purple-400 mb-2">
              <Users className="h-8 w-8 mx-auto" />
            </div>
            <h3 className="font-semibold mb-2">Advanced Behavioral Tools Coming Soon</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We're developing comprehensive behavioral analysis tools with AI-powered pattern 
              recognition and predictive modeling capabilities.
            </p>
            <Link href="/login">
              <Button variant="outline">
                Join Beta Program
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}