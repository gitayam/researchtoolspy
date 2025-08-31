"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Shield, FileText, Download, Eye } from 'lucide-react'
import SecurityQuestionForm from './SecurityQuestionForm'

interface SecurityQuestion {
  id: string
  category: string
  question: string
  description?: string
  evidence_required: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
}

interface SecurityAssessment {
  id: string
  title: string
  description: string
  responses: Record<string, string>
  evidence: Record<string, string[]>
  completion_percentage: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  last_updated: string
}

// Security questions based on the implementation plan
const SECURITY_QUESTIONS: SecurityQuestion[] = [
  // Threat Assessment Questions
  {
    id: 'threat_attack_vectors',
    category: 'Threat Assessment',
    question: 'What are the specific attack vectors targeting our API endpoints?',
    description: 'Identify potential attack methods such as injection attacks, authentication bypass, DDoS, etc.',
    evidence_required: true,
    priority: 'critical'
  },
  {
    id: 'threat_breach_evidence',
    category: 'Threat Assessment', 
    question: 'What evidence do we have of current or attempted security breaches?',
    description: 'Review logs, monitoring alerts, and incident reports for breach indicators',
    evidence_required: true,
    priority: 'high'
  },
  {
    id: 'threat_valuable_assets',
    category: 'Threat Assessment',
    question: 'What are the most valuable assets accessible through our API?',
    description: 'Catalog sensitive data, critical functions, and high-value endpoints',
    evidence_required: true,
    priority: 'high'
  },
  {
    id: 'threat_attacker_sophistication',
    category: 'Threat Assessment',
    question: 'How sophisticated are the potential attackers (script kiddies vs. nation-state)?',
    description: 'Assess threat actor capabilities and motivations based on industry and exposure',
    evidence_required: false,
    priority: 'medium'
  },
  {
    id: 'threat_landscape',
    category: 'Threat Assessment',
    question: 'What is the current threat landscape for similar applications?',
    description: 'Research recent vulnerabilities and attacks against similar API platforms',
    evidence_required: false,
    priority: 'medium'
  },

  // Vulnerability Evidence Collection
  {
    id: 'vuln_security_testing',
    category: 'Vulnerability Assessment',
    question: 'What security testing has been performed on our API endpoints?',
    description: 'Document penetration tests, vulnerability scans, and security audits',
    evidence_required: true,
    priority: 'critical'
  },
  {
    id: 'vuln_dependencies',
    category: 'Vulnerability Assessment',
    question: 'What dependencies have known vulnerabilities?',
    description: 'Scan package.json, requirements.txt, and other dependency files for CVEs',
    evidence_required: true,
    priority: 'high'
  },
  {
    id: 'vuln_auth_gaps',
    category: 'Vulnerability Assessment',
    question: 'What authentication/authorization gaps exist?',
    description: 'Review auth mechanisms, token validation, and access controls',
    evidence_required: true,
    priority: 'critical'
  },
  {
    id: 'vuln_input_validation',
    category: 'Vulnerability Assessment',
    question: 'What input validation weaknesses are present?',
    description: 'Examine all API inputs for injection vulnerabilities and validation bypasses',
    evidence_required: true,
    priority: 'high'
  },
  {
    id: 'vuln_monitoring_gaps',
    category: 'Vulnerability Assessment',
    question: 'What logging and monitoring blind spots exist?',
    description: 'Identify gaps in security event detection and incident response capabilities',
    evidence_required: true,
    priority: 'medium'
  },

  // Risk Impact Analysis
  {
    id: 'risk_business_impact',
    category: 'Risk Analysis',
    question: 'What would be the business impact of a successful API breach?',
    description: 'Quantify financial, operational, and reputational consequences',
    evidence_required: false,
    priority: 'high'
  },
  {
    id: 'risk_data_exposure',
    category: 'Risk Analysis', 
    question: 'What sensitive data could be exposed through API vulnerabilities?',
    description: 'Map data flows and identify PII, financial, or confidential information at risk',
    evidence_required: true,
    priority: 'critical'
  },
  {
    id: 'risk_compliance',
    category: 'Risk Analysis',
    question: 'What regulatory compliance issues would arise from a breach?',
    description: 'Consider GDPR, PCI DSS, HIPAA, SOX, and other applicable regulations',
    evidence_required: false,
    priority: 'high'
  },

  // Mitigation Evidence
  {
    id: 'mitigation_current_controls',
    category: 'Mitigation Analysis',
    question: 'What security controls are currently implemented?',
    description: 'Document existing firewalls, WAF, rate limiting, encryption, etc.',
    evidence_required: true,
    priority: 'medium'
  },
  {
    id: 'mitigation_best_practices',
    category: 'Mitigation Analysis',
    question: 'What industry best practices are we following?',
    description: 'Assess alignment with OWASP, NIST, and other security frameworks',
    evidence_required: false,
    priority: 'medium'
  },
  {
    id: 'mitigation_incident_response',
    category: 'Mitigation Analysis',
    question: 'What incident response procedures are in place?',
    description: 'Review playbooks, escalation procedures, and recovery capabilities',
    evidence_required: true,
    priority: 'high'
  }
]

const SecurityAssessmentDashboard: React.FC = () => {
  const [assessment, setAssessment] = useState<SecurityAssessment>({
    id: 'security_assessment_001',
    title: 'API Security Hardening Assessment',
    description: 'Comprehensive security analysis following evidence-based framework methodology',
    responses: {},
    evidence: {},
    completion_percentage: 0,
    risk_level: 'high',
    last_updated: new Date().toISOString()
  })

  const [activeCategory, setActiveCategory] = useState('Threat Assessment')

  const categories = Array.from(new Set(SECURITY_QUESTIONS.map(q => q.category)))

  useEffect(() => {
    // Calculate completion percentage
    const totalQuestions = SECURITY_QUESTIONS.length
    const answeredQuestions = Object.keys(assessment.responses).filter(
      key => assessment.responses[key]?.trim()
    ).length
    
    const percentage = Math.round((answeredQuestions / totalQuestions) * 100)
    
    setAssessment(prev => ({
      ...prev,
      completion_percentage: percentage,
      last_updated: new Date().toISOString()
    }))
  }, [assessment.responses])

  const handleResponse = (questionId: string, response: string) => {
    setAssessment(prev => ({
      ...prev,
      responses: {
        ...prev.responses,
        [questionId]: response
      }
    }))
  }

  const handleEvidenceAdd = (questionId: string, evidence: string) => {
    setAssessment(prev => ({
      ...prev,
      evidence: {
        ...prev.evidence,
        [questionId]: [...(prev.evidence[questionId] || []), evidence]
      }
    }))
  }

  const handleAISuggestion = async (questionId: string): Promise<string> => {
    // Simulate AI suggestion - in real implementation, call your AI service
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`AI-generated security analysis for ${questionId}. This would include threat modeling, vulnerability assessment recommendations, and mitigation strategies based on current security best practices.`)
      }, 1500)
    })
  }

  const exportAssessment = () => {
    const exportData = {
      assessment,
      questions: SECURITY_QUESTIONS,
      exported_at: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `security_assessment_${new Date().getTime()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'text-red-600'
      case 'high': return 'text-orange-600' 
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 60) return 'bg-yellow-500' 
    if (percentage >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="h-6 w-6 text-red-500" />
                {assessment.title}
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {assessment.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={getRiskColor(assessment.risk_level)}>
                Risk Level: {assessment.risk_level.toUpperCase()}
              </Badge>
              <Button onClick={exportAssessment} size="sm" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Progress</div>
              <Progress value={assessment.completion_percentage} className="h-2" />
              <div className="text-sm font-medium mt-1">
                {assessment.completion_percentage}% Complete
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Questions</div>
              <div className="text-lg font-semibold">
                {Object.keys(assessment.responses).filter(k => assessment.responses[k]?.trim()).length} / {SECURITY_QUESTIONS.length}
              </div>
              <div className="text-sm text-gray-500">Answered</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Last Updated</div>
              <div className="text-sm">
                {new Date(assessment.last_updated).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Questions by Category */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-4">
          {categories.map((category) => (
            <TabsTrigger key={category} value={category} className="text-xs">
              {category.split(' ')[0]}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">{category}</h3>
              <Badge variant="outline">
                {SECURITY_QUESTIONS.filter(q => q.category === category).length} questions
              </Badge>
            </div>

            {SECURITY_QUESTIONS
              .filter(q => q.category === category)
              .map((question) => (
                <SecurityQuestionForm
                  key={question.id}
                  question={question}
                  response={assessment.responses[question.id] || ''}
                  evidence={assessment.evidence[question.id] || []}
                  onResponse={handleResponse}
                  onEvidenceAdd={handleEvidenceAdd}
                  onAISuggestion={handleAISuggestion}
                />
              ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* Summary Card */}
      {assessment.completion_percentage > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Assessment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Critical Priority Questions</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {SECURITY_QUESTIONS.filter(q => q.priority === 'critical').length} questions require immediate attention
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Evidence Collection</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Object.values(assessment.evidence).flat().length} pieces of evidence collected
                </div>
              </div>
            </div>
            
            {assessment.completion_percentage >= 80 && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Assessment Complete</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your security assessment is ready for review and implementation planning.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SecurityAssessmentDashboard