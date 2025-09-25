"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Search, Brain, CheckCircle } from 'lucide-react'

interface SecurityQuestion {
  id: string
  category: string
  question: string
  description?: string
  evidence_required: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
}

interface SecurityQuestionFormProps {
  question: SecurityQuestion
  response?: string
  evidence?: string[]
  onResponse: (questionId: string, response: string) => void
  onEvidenceAdd: (questionId: string, evidence: string) => void
  onAISuggestion?: (questionId: string) => Promise<string>
}

const SecurityQuestionForm: React.FC<SecurityQuestionFormProps> = ({
  question,
  response = '',
  evidence = [],
  onResponse,
  onEvidenceAdd,
  onAISuggestion
}) => {
  const [currentResponse, setCurrentResponse] = useState(response)
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)

  const handleResponseChange = (value: string) => {
    setCurrentResponse(value)
    onResponse(question.id, value)
  }

  const handleAISuggestion = async () => {
    if (!onAISuggestion) return
    
    setIsLoadingAI(true)
    try {
      const suggestion = await onAISuggestion(question.id)
      setCurrentResponse(suggestion)
      onResponse(question.id, suggestion)
    } catch (error) {
      console.error('AI suggestion failed:', error)
    } finally {
      setIsLoadingAI(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-red-500 bg-red-50 dark:bg-red-900/20'
      case 'high': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
      case 'medium': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      case 'low': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
      default: return 'border-gray-500'
    }
  }

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive' 
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <Card className={`mb-4 ${getPriorityColor(question.priority)} border-l-4`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {question.question}
            </CardTitle>
            {question.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {question.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getPriorityBadgeVariant(question.priority)}>
              {question.priority.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {question.category}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Response Input */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Analysis & Response
            </label>
            <Textarea
              value={currentResponse}
              onChange={(e) => handleResponseChange(e.target.value)}
              placeholder="Provide your security analysis and evidence for this question..."
              className="min-h-[100px] resize-y"
            />
          </div>

          {/* Evidence Section */}
          {question.evidence_required && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEvidence(!showEvidence)}
                className="mb-2"
              >
                Evidence ({evidence.length})
                {showEvidence ? ' ▼' : ' ▶'}
              </Button>
              
              {showEvidence && (
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                  {evidence.length > 0 ? (
                    <ul className="space-y-2">
                      {evidence.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No evidence collected yet</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {onAISuggestion && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAISuggestion}
                disabled={isLoadingAI}
                className="flex items-center gap-2"
              >
                <Brain className="h-4 w-4" />
                {isLoadingAI ? 'Analyzing...' : 'AI Suggestion'}
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://google.com/search?q=${encodeURIComponent(question.question + ' cybersecurity')}`, '_blank')}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Research
            </Button>
            
            <Button
              variant="outline" 
              size="sm"
              onClick={() => onEvidenceAdd(question.id, 'Manual evidence entry')}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Add Evidence
            </Button>
          </div>

          {/* Response Status */}
          {currentResponse && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              Response recorded
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default SecurityQuestionForm