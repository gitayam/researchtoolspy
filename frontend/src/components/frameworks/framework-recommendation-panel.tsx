/**
 * Framework Recommendation Panel
 * AI-powered framework selection assistance for researchers
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Bot, 
  Lightbulb, 
  Clock, 
  TrendingUp, 
  ArrowRight, 
  Star,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { 
  generateFrameworkRecommendations, 
  checkRecommendationServiceAvailability,
  FrameworkRecommendation,
  RecommendationResult 
} from '@/lib/framework-recommender'

interface FrameworkRecommendationPanelProps {
  onFrameworkSelected?: (frameworkId: string) => void
  className?: string
}

export function FrameworkRecommendationPanel({ 
  onFrameworkSelected, 
  className 
}: FrameworkRecommendationPanelProps) {
  const [researchQuestion, setResearchQuestion] = useState('')
  const [context, setContext] = useState('')
  const [timeAvailable, setTimeAvailable] = useState('')
  const [expertiseLevel, setExpertiseLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
  const [primaryGoal, setPrimaryGoal] = useState('')
  const [recommendations, setRecommendations] = useState<RecommendationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  // Check AI availability on component mount
  useState(() => {
    checkRecommendationServiceAvailability().then(setAiAvailable)
  })

  const generateRecommendations = async () => {
    if (!researchQuestion.trim()) {
      toast({
        title: 'Research Question Required',
        description: 'Please enter your research question to get framework recommendations',
        variant: 'destructive'
      })
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateFrameworkRecommendations(
        researchQuestion,
        context || undefined,
        {
          timeAvailable: timeAvailable || undefined,
          expertiseLevel,
          primaryGoal: primaryGoal || undefined
        }
      )

      setRecommendations(result)
      toast({
        title: 'Recommendations Generated',
        description: `Found ${result.primaryRecommendations.length} primary framework recommendations`,
      })
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
      toast({
        title: 'Recommendation Failed', 
        description: 'Failed to generate framework recommendations. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleFrameworkSelect = (framework: FrameworkRecommendation) => {
    if (onFrameworkSelected) {
      onFrameworkSelected(framework.framework)
    } else {
      // Navigate to framework creation page
      router.push(`/frameworks/${framework.framework}/create`)
    }
  }

  const getSuitabilityColor = (suitability: string) => {
    switch (suitability) {
      case 'excellent': return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30'
      case 'good': return 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30'
      case 'fair': return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30'
      case 'poor': return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30'
      default: return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-900/30'
    }
  }

  const getComplexityIcon = (complexity: string) => {
    switch (complexity) {
      case 'low': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'medium': return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'high': return <Info className="h-4 w-4 text-red-600" />
      default: return <Info className="h-4 w-4 text-gray-600" />
    }
  }

  if (aiAvailable === false) {
    return (
      <Card className={`bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 ${className}`}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-gray-400" />
            <CardTitle className="text-gray-600 dark:text-gray-400">Framework Recommendations Unavailable</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Framework recommendations require an OpenAI API key. Browse available frameworks manually or contact your administrator to enable AI-powered recommendations.
          </p>
          <Button 
            className="mt-4"
            onClick={() => router.push('/frameworks')}
          >
            Browse All Frameworks
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${className}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-gray-900 dark:text-gray-100">AI Framework Recommendations</CardTitle>
        </div>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Get personalized framework recommendations based on your research question and requirements
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!recommendations ? (
          <div className="space-y-4">
            {/* Research Question Input */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Research Question *
              </label>
              <Textarea
                value={researchQuestion}
                onChange={(e) => setResearchQuestion(e.target.value)}
                placeholder="e.g., How can our organization improve its competitive position in the market?"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                rows={3}
              />
            </div>

            {/* Context */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Additional Context (Optional)
              </label>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., Technology startup, limited resources, need quick results..."
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                rows={2}
              />
            </div>

            {/* Constraints */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Time Available
                </label>
                <Input
                  value={timeAvailable}
                  onChange={(e) => setTimeAvailable(e.target.value)}
                  placeholder="e.g., 2 days, 1 week"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Expertise Level
                </label>
                <Select value={expertiseLevel} onValueChange={(value: 'beginner' | 'intermediate' | 'advanced') => setExpertiseLevel(value)}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Primary Goal
                </label>
                <Input
                  value={primaryGoal}
                  onChange={(e) => setPrimaryGoal(e.target.value)}
                  placeholder="e.g., Decision making"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Generate Button */}
            <Button 
              onClick={generateRecommendations}
              disabled={isGenerating || !researchQuestion.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
            >
              {isGenerating ? (
                <>
                  <Bot className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Your Requirements...
                </>
              ) : (
                <>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Get Framework Recommendations
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Rationale */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Recommendation Strategy
              </h4>
              <p className="text-blue-800 dark:text-blue-200 text-sm">{recommendations.rationale}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-blue-700 dark:text-blue-300">
                <span>Estimated Time: {recommendations.estimatedTime}</span>
                <span>Skill Level: {recommendations.skillLevel}</span>
              </div>
            </div>

            {/* Primary Recommendations */}
            {recommendations.primaryRecommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Primary Recommendations
                </h4>
                <div className="space-y-3">
                  {recommendations.primaryRecommendations.map((framework, index) => (
                    <Card key={index} className="border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-gray-900 dark:text-gray-100">{framework.title}</h5>
                              <Badge className={getSuitabilityColor(framework.suitability)}>
                                {framework.suitability}
                              </Badge>
                              <div className="flex items-center gap-1">
                                {getComplexityIcon(framework.complexity)}
                                <span className="text-xs text-gray-600 dark:text-gray-400">{framework.complexity}</span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{framework.description}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{framework.rationale}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {framework.timeEstimate}
                              </div>
                              <span>Output: {framework.outputType}</span>
                              <span>Confidence: {framework.confidence}%</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleFrameworkSelect(framework)}
                            className="ml-4 bg-yellow-600 hover:bg-yellow-700 text-white"
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Use This
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Supporting Recommendations */}
            {recommendations.supportingRecommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  Supporting Frameworks
                </h4>
                <div className="space-y-3">
                  {recommendations.supportingRecommendations.map((framework, index) => (
                    <Card key={index} className="border border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-medium text-gray-900 dark:text-gray-100">{framework.title}</h5>
                              <Badge className={getSuitabilityColor(framework.suitability)}>
                                {framework.suitability}
                              </Badge>
                              <div className="flex items-center gap-1">
                                {getComplexityIcon(framework.complexity)}
                                <span className="text-xs text-gray-600 dark:text-gray-400">{framework.complexity}</span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{framework.rationale}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {framework.timeEstimate}
                              </div>
                              <span>Confidence: {framework.confidence}%</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleFrameworkSelect(framework)}
                            className="ml-4"
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Use
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Considerations */}
            {recommendations.considerations.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Important Considerations
                </h4>
                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {recommendations.considerations.map((consideration, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5">•</span>
                      {consideration}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setRecommendations(null)}
              >
                New Recommendation
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/frameworks')}
              >
                Browse All Frameworks
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}