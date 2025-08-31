'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, ArrowLeft, Lock, AlertTriangle, CheckCircle, Eye } from 'lucide-react'

export default function SecurityAssessmentPage() {
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
                Security Assessment Framework
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Comprehensive security evaluation using evidence-based analysis and SATS methodology
              </p>
            </div>
          </div>
        </div>

        {/* Framework Description */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              About Security Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Framework Overview</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  This comprehensive security assessment framework provides structured evaluation 
                  across 16 critical security questions organized into 4 main categories. Each 
                  question includes evidence collection and AI-assisted analysis.
                </p>
                <h3 className="font-semibold mb-2">SATS Methodology:</h3>
                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• <strong>Source</strong> - Evidence origin and credibility</li>
                  <li>• <strong>Accuracy</strong> - Data precision and reliability</li>
                  <li>• <strong>Timeliness</strong> - Currency and relevance</li>
                  <li>• <strong>Significance</strong> - Impact and importance</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Assessment Categories:</h3>
                <div className="space-y-3">
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <div className="font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Threat Assessment (4 questions)
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">External and internal threats</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                    <div className="font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Vulnerability Analysis (4 questions)
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">System weaknesses and gaps</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Control Effectiveness (4 questions)
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Security measure performance</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Risk Management (4 questions)
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Risk mitigation strategies</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Evidence-Based
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Structured evidence collection with reliability scoring and chain of custody tracking.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                AI-Assisted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Intelligent suggestions and automated analysis to enhance assessment quality.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Comprehensive
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                Covers all critical security domains with 16 specialized assessment questions.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/security-assessment/create">
            <Button className="flex items-center gap-2 bg-red-600 hover:bg-red-700">
              <Shield className="h-4 w-4" />
              Start Security Assessment
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Save & Export Results
            </Button>
          </Link>
        </div>

        {/* Available Now Notice */}
        <Card className="mt-8 border-green-200 dark:border-green-800">
          <CardContent className="p-6 text-center">
            <div className="text-green-600 dark:text-green-400 mb-2">
              <CheckCircle className="h-8 w-8 mx-auto" />
            </div>
            <h3 className="font-semibold mb-2 text-green-700 dark:text-green-400">
              Fully Functional Security Assessment
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This security assessment framework is fully operational with all 16 questions, 
              evidence collection, and AI-powered analysis capabilities.
            </p>
            <Link href="/security-assessment/create">
              <Button className="bg-green-600 hover:bg-green-700">
                Begin Assessment Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}