'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, ArrowLeft, Shield, Eye, AlertTriangle } from 'lucide-react'

export default function DeceptionDetectionPage() {
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
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Deception Detection Framework
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Systematic approach to identifying potential deception in information and communications
              </p>
            </div>
          </div>
        </div>

        {/* Framework Description */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              About Deception Detection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Framework Overview</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  This framework provides structured methods for identifying potential deception 
                  in various forms of communication and information sources. It combines behavioral 
                  analysis, linguistic patterns, and contextual evaluation.
                </p>
                <h3 className="font-semibold mb-2">Key Applications:</h3>
                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Information verification</li>
                  <li>• Source credibility assessment</li>
                  <li>• Interview and statement analysis</li>
                  <li>• Digital communication evaluation</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Analysis Components:</h3>
                <div className="space-y-3">
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <div className="font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Behavioral Indicators
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Verbal and non-verbal cues</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    <div className="font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Linguistic Analysis
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Word choice and speech patterns</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                    <div className="font-medium text-yellow-700 dark:text-yellow-400">Contextual Evaluation</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Situational and environmental factors</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/frameworks/deception-detection/create">
            <Button className="flex items-center gap-2 bg-red-600 hover:bg-red-700">
              <Shield className="h-4 w-4" />
              Start Deception Analysis
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Access Advanced Tools
            </Button>
          </Link>
        </div>

        {/* Coming Soon Notice */}
        <Card className="mt-8">
          <CardContent className="p-6 text-center">
            <div className="text-red-600 dark:text-red-400 mb-2">
              <Shield className="h-8 w-8 mx-auto" />
            </div>
            <h3 className="font-semibold mb-2">Advanced Detection Tools Coming Soon</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We're developing comprehensive deception detection tools with AI-powered analysis 
              capabilities. Stay tuned for the full interactive experience.
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