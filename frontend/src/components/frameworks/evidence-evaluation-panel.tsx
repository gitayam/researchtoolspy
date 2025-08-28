'use client'

import { useState } from 'react'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  ChevronDown,
  ChevronRight,
  Scale,
  Eye,
  Target,
  Clock,
  User,
  Key
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  EVIDENCE_QUESTIONS,
  calculateEvidenceConfidence,
  getCredibilityRating,
  analyzeEvidencePatterns
} from '@/lib/evidence-evaluation'

interface EvidenceEvaluationPanelProps {
  evidenceId: string
  evidenceText: string
  onEvaluationComplete: (evaluation: {
    confidence: number
    level: string
    responses: Record<string, number>
  }) => void
  initialResponses?: Record<string, number>
}

export function EvidenceEvaluationPanel({
  evidenceId,
  evidenceText,
  onEvaluationComplete,
  initialResponses = {}
}: EvidenceEvaluationPanelProps) {
  const [responses, setResponses] = useState<Record<string, number>>(initialResponses)
  const [expandedSections, setExpandedSections] = useState<string[]>(['source_type'])
  
  const handleResponseChange = (questionId: string, weight: number) => {
    const newResponses = { ...responses, [questionId]: weight }
    setResponses(newResponses)
    
    const evaluation = calculateEvidenceConfidence(newResponses)
    onEvaluationComplete({
      confidence: evaluation.confidence,
      level: evaluation.level,
      responses: newResponses
    })
  }
  
  const completedQuestions = Object.keys(responses).length
  const totalQuestions = EVIDENCE_QUESTIONS.length
  const completionPercentage = (completedQuestions / totalQuestions) * 100
  
  const currentConfidence = calculateEvidenceConfidence(responses)
  const credibilityRating = getCredibilityRating(currentConfidence.confidence)
  
  // Group questions by category
  const questionsByCategory = EVIDENCE_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = []
    }
    acc[question.category].push(question)
    return acc
  }, {} as Record<string, typeof EVIDENCE_QUESTIONS>)
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Source Classification': return User
      case 'Verification': return CheckCircle
      case 'Bias Assessment': return AlertTriangle
      case 'Deception Risk': return Eye
      case 'Information Chain': return Target
      case 'Temporal Relevance': return Clock
      case 'Source Competence': return Shield
      case 'Information Access': return Key
      default: return Info
    }
  }
  
  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-blue-600" />
          Evidence Evaluation (SATS Methodology)
        </CardTitle>
        <CardDescription>
          Systematic assessment of evidence credibility and reliability
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6">
        {/* Evidence Text Display */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <p className="text-sm italic">"{evidenceText}"</p>
        </div>
        
        {/* Progress and Current Rating */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Evaluation Progress</span>
              <Badge variant="outline" className="text-xs">
                {completedQuestions}/{totalQuestions} Questions
              </Badge>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(completionPercentage)}%
            </span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>
        
        {/* Current Confidence Rating */}
        <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Current Confidence Level
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Badge className={cn(
                  "text-lg font-bold px-3 py-1",
                  currentConfidence.level === 'VERY_HIGH' && "bg-green-600",
                  currentConfidence.level === 'HIGH' && "bg-green-500",
                  currentConfidence.level === 'MODERATE' && "bg-yellow-500",
                  currentConfidence.level === 'LOW' && "bg-orange-500",
                  currentConfidence.level === 'VERY_LOW' && "bg-red-500"
                )}>
                  {currentConfidence.confidence}/13
                </Badge>
                <span className="text-sm font-medium">
                  {currentConfidence.level.replace('_', ' ')}
                </span>
              </div>
            </div>
            
            <div className="text-center">
              <div className={cn(
                "text-3xl font-bold",
                credibilityRating.color
              )}>
                {credibilityRating.letter}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {credibilityRating.description}
              </p>
            </div>
          </div>
        </div>
        
        <Separator className="my-6" />
        
        {/* Evaluation Questions by Category */}
        <Accordion 
          type="multiple" 
          value={expandedSections}
          onValueChange={setExpandedSections}
          className="space-y-3"
        >
          {Object.entries(questionsByCategory).map(([category, questions]) => {
            const Icon = getCategoryIcon(category)
            const categoryResponses = questions.filter(q => responses[q.id] !== undefined).length
            const categoryTotal = questions.length
            
            return (
              <AccordionItem key={category} value={category} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{category}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {categoryResponses}/{categoryTotal}
                    </Badge>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-6">
                    {questions.map(question => (
                      <div key={question.id} className="space-y-3">
                        <div className="flex items-start justify-between">
                          <Label className="text-sm font-medium">
                            {question.question}
                          </Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-gray-400" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-sm">{question.guidance}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        
                        <RadioGroup
                          value={responses[question.id]?.toString() || ""}
                          onValueChange={(value) => handleResponseChange(question.id, parseInt(value))}
                        >
                          <div className="space-y-2">
                            {question.options.map(option => (
                              <label
                                key={option.value}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                  "hover:bg-gray-50 dark:hover:bg-gray-800",
                                  responses[question.id] === option.weight && 
                                  "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                                )}
                              >
                                <RadioGroupItem value={option.weight.toString()} />
                                <div className="flex-1">
                                  <span className="text-sm">{option.label}</span>
                                </div>
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    option.weight >= 8 && "text-green-600 dark:text-green-400",
                                    option.weight >= 5 && option.weight < 8 && "text-yellow-600 dark:text-yellow-400",
                                    option.weight >= 1 && option.weight < 5 && "text-orange-600 dark:text-orange-400",
                                    option.weight < 1 && "text-red-600 dark:text-red-400"
                                  )}
                                >
                                  {option.weight > 0 ? '+' : ''}{option.weight}
                                </Badge>
                              </label>
                            ))}
                          </div>
                        </RadioGroup>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
        
        {/* Quick Actions */}
        <div className="mt-6 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedSections(Object.keys(questionsByCategory))}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedSections([])}
          >
            <ChevronRight className="h-4 w-4 mr-2" />
            Collapse All
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface EvidenceQualitySummaryProps {
  evaluations: Array<{
    evidenceId: string
    confidence: number
    level: string
    responses: Record<string, number>
  }>
}

export function EvidenceQualitySummary({ evaluations }: EvidenceQualitySummaryProps) {
  if (evaluations.length === 0) return null
  
  const avgConfidence = evaluations.reduce((sum, e) => sum + e.confidence, 0) / evaluations.length
  const patterns = analyzeEvidencePatterns(evaluations.map(e => e.responses))
  
  return (
    <Card className="border-2 border-dashed border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Evidence Quality Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Average Evidence Confidence
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-green-600 text-lg">
                {avgConfidence.toFixed(1)}/13
              </Badge>
              <span className="text-sm">
                {getCredibilityRating(avgConfidence).description}
              </span>
            </div>
          </div>
        </div>
        
        <Separator />
        
        {patterns.strengths.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Strengths
            </h4>
            <ul className="space-y-1">
              {patterns.strengths.map((strength, i) => (
                <li key={i} className="text-sm text-green-700 dark:text-green-400">
                  • {strength}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {patterns.weaknesses.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Weaknesses
            </h4>
            <ul className="space-y-1">
              {patterns.weaknesses.map((weakness, i) => (
                <li key={i} className="text-sm text-orange-700 dark:text-orange-400">
                  • {weakness}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {patterns.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              Recommendations
            </h4>
            <ul className="space-y-1">
              {patterns.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-blue-700 dark:text-blue-400">
                  • {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}