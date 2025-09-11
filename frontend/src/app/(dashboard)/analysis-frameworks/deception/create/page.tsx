'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, AlertTriangle, Brain, Search, FileText, Shield, Eye, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

// Enhanced SAT Deception Detection Questions - 2024 IC Standards
const MOM_QUESTIONS = {
  "motive": "What are the goals and motives of the potential deceiver?",
  "channels": "What means are available to feed information to us?",
  "risks": "What consequences would the adversary suffer if deception was revealed?",
  "costs": "Would they need to sacrifice sensitive information for credibility?",
  "feedback": "Do they have a way to monitor the impact of the deception?",
  "digital_channels": "What digital platforms and social media channels could they use for deception?",
  "ai_capabilities": "Do they have access to AI tools for generating deepfakes, synthetic text, or manipulated content?",
  "cyber_infrastructure": "What cyber infrastructure and technical capabilities do they possess for digital deception?",
  "influence_operations": "Are they capable of conducting coordinated information influence operations?",
  "detection_awareness": "How aware are they of our detection capabilities and methods?"
}

const POP_QUESTIONS = {
  "history": "What is the history of deception by this actor or similar actors?",
  "patterns": "Are there patterns or signatures in their previous deception attempts?",
  "success": "How successful have their previous deception operations been?",
  "digital_precedents": "Have they previously used deepfakes, AI-generated content, or synthetic media?",
  "social_media_history": "What is their track record with social media manipulation and disinformation campaigns?",
  "cyber_deception": "Have they engaged in previous cyber deception operations or false flag activities?",
  "attribution_methods": "How have they previously attempted to obscure attribution or create false narratives?",
  "learning_adaptation": "How have they adapted their deception methods over time based on previous exposures?"
}

const MOSES_QUESTIONS = {
  "control": "How much control does the potential deceiver have over our sources?",
  "access": "Do they have access to our collection methods?",
  "vulnerability": "How vulnerable are our sources to manipulation?",
  "digital_manipulation": "Could our digital sources (social media, online content) be manipulated or fabricated?",
  "source_verification": "Can we verify the authenticity and credibility of sources through multiple platforms?",
  "ai_detection": "Have we applied AI-powered tools to detect potential deepfakes or synthetic content?",
  "cross_platform_consistency": "Is the information consistent across multiple independent platforms and sources?",
  "technical_forensics": "What digital forensics evidence supports or contradicts the source material?",
  "behavioral_analysis": "Are there behavioral patterns or linguistic markers that suggest manipulation?",
  "metadata_analysis": "Does technical metadata support the claimed origin and authenticity of the information?",
  "network_analysis": "Can we trace the information flow and identify potential manipulation points?"
}

const EVE_QUESTIONS = {
  "consistency": "Is the information internally consistent?",
  "corroboration": "Is it confirmed by multiple independent sources?",
  "gaps": "Are there gaps or missing information in the evidence?",
  "digital_provenance": "Can we establish a clear digital chain of custody for the evidence?",
  "timeline_analysis": "Are all temporal elements and sequences logically consistent?",
  "technical_authenticity": "Does technical analysis support the claimed authenticity of digital evidence?",
  "multi_modal_consistency": "Is the information consistent across text, audio, video, and image formats?",
  "linguistic_analysis": "Are there linguistic patterns or markers consistent with the claimed source?",
  "behavioral_coherence": "Do behavioral patterns in the evidence align with known characteristics of the source?",
  "contextual_plausibility": "Is the evidence plausible within the broader geopolitical and technical context?"
}

const BIAS_CHECK_PROMPTS = {
  "confirmation_bias": "Have I actively sought evidence that contradicts my initial assessment?",
  "anchoring_bias": "Am I overly influenced by the first piece of evidence I encountered?",
  "availability_heuristic": "Am I giving too much weight to recent or memorable examples?",
  "groupthink": "Have I independently verified this assessment or am I following group consensus?",
  "attribution_error": "Am I properly considering alternative explanations for observed behaviors?"
}

interface SATResponses {
  mom: { [key: string]: string }
  pop: { [key: string]: string }
  moses: { [key: string]: string }
  eve: { [key: string]: string }
  biasCheck: { [key: string]: string }
}

interface ConfidenceScores {
  mom: number
  pop: number
  moses: number
  eve: number
  overall: number
}

export default function CreateDeceptionDetectionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [scenario, setScenario] = useState('')
  const [responses, setResponses] = useState<SATResponses>({
    mom: {},
    pop: {},
    moses: {},
    eve: {},
    biasCheck: {}
  })
  const [confidenceScores, setConfidenceScores] = useState<ConfidenceScores>({
    mom: 0,
    pop: 0,
    moses: 0,
    eve: 0,
    overall: 0
  })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('scenario')

  // Calculate progress
  const calculateProgress = () => {
    let progress = 0
    if (scenario.trim()) progress += 15
    if (Object.values(responses.mom).some(v => v.trim())) progress += 15
    if (Object.values(responses.pop).some(v => v.trim())) progress += 15
    if (Object.values(responses.moses).some(v => v.trim())) progress += 15
    if (Object.values(responses.eve).some(v => v.trim())) progress += 15
    if (Object.values(responses.biasCheck).some(v => v.trim())) progress += 15
    if (confidenceScores.overall > 0) progress += 10
    return progress
  }

  // Calculate overall confidence automatically
  useEffect(() => {
    const overall = (confidenceScores.mom + confidenceScores.pop + confidenceScores.moses + confidenceScores.eve) / 4
    setConfidenceScores(prev => ({ ...prev, overall }))
  }, [confidenceScores.mom, confidenceScores.pop, confidenceScores.moses, confidenceScores.eve])

  const updateResponse = (section: keyof SATResponses, key: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }))
  }

  const updateConfidence = (section: keyof Omit<ConfidenceScores, 'overall'>, value: number[]) => {
    setConfidenceScores(prev => ({ ...prev, [section]: value[0] }))
  }

  const saveSession = async () => {
    if (!title.trim() || !scenario.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title and scenario',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const sessionData = {
        framework_type: 'deception_detection',
        title,
        data: {
          scenario,
          responses,
          confidenceScores,
          progress: calculateProgress(),
          methodology: 'SAT (MOM/POP/MOSES/EVE)',
          version: '2024_IC_Standards'
        }
      }

      const response = await apiClient.post('/frameworks/', sessionData)
      
      toast({
        title: 'Success',
        description: 'Deception detection analysis saved successfully'
      })
      
      router.push(`/analysis-frameworks/deception/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to save analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const renderQuestionSection = (
    title: string, 
    questions: { [key: string]: string }, 
    section: keyof SATResponses,
    icon: any,
    color: string
  ) => {
    const Icon = icon
    return (
      <Card className={`border-l-4 border-l-${color}-500`}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 text-${color}-700`}>
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>
            {section === 'mom' && 'Assess the deceiver\'s motives, opportunities, and means'}
            {section === 'pop' && 'Analyze past opposition practices and historical patterns'}
            {section === 'moses' && 'Evaluate the manipulability of sources'}
            {section === 'eve' && 'Examine the evaluation of evidence'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(questions).map(([key, question]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium">
                {question}
              </Label>
              <Textarea
                value={responses[section][key] || ''}
                onChange={(e) => updateResponse(section, key, e.target.value)}
                placeholder="Provide your analysis..."
                className="min-h-[80px]"
              />
            </div>
          ))}
          
          {section !== 'biasCheck' && (
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium mb-2 block">
                Confidence Level: {confidenceScores[section as keyof Omit<ConfidenceScores, 'overall'>]}%
              </Label>
              <Slider
                value={[confidenceScores[section as keyof Omit<ConfidenceScores, 'overall'>]]}
                onValueChange={(value) => updateConfidence(section as keyof Omit<ConfidenceScores, 'overall'>, value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SAT Deception Detection Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Structured Analytic Technique using MOM, POP, MOSES, and EVE methodology
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <div className="font-medium">Progress: {calculateProgress()}%</div>
            <Progress value={calculateProgress()} className="w-24 h-2" />
          </div>
          <Button 
            onClick={saveSession} 
            disabled={saving || !title.trim() || !scenario.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Analysis'}
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Analysis Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title for your analysis"
            />
          </div>
        </CardContent>
      </Card>

      {/* SAT Framework Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="scenario">Scenario</TabsTrigger>
          <TabsTrigger value="mom">MOM</TabsTrigger>
          <TabsTrigger value="pop">POP</TabsTrigger>
          <TabsTrigger value="moses">MOSES</TabsTrigger>
          <TabsTrigger value="eve">EVE</TabsTrigger>
          <TabsTrigger value="bias">Bias Check</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="scenario" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Analysis Scenario
              </CardTitle>
              <CardDescription>
                Describe the situation, information, or content you want to analyze for potential deception
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Provide a detailed description of the scenario, including the source of information, context, and any relevant background..."
                className="min-h-[200px]"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mom">
          {renderQuestionSection('Motive, Opportunity, and Means (MOM)', MOM_QUESTIONS, 'mom', Brain, 'blue')}
        </TabsContent>

        <TabsContent value="pop">
          {renderQuestionSection('Past Opposition Practices (POP)', POP_QUESTIONS, 'pop', Search, 'green')}
        </TabsContent>

        <TabsContent value="moses">
          {renderQuestionSection('Manipulability of Sources (MOSES)', MOSES_QUESTIONS, 'moses', Shield, 'purple')}
        </TabsContent>

        <TabsContent value="eve">
          {renderQuestionSection('Evaluation of Evidence (EVE)', EVE_QUESTIONS, 'eve', Eye, 'orange')}
        </TabsContent>

        <TabsContent value="bias">
          {renderQuestionSection('Cognitive Bias Check', BIAS_CHECK_PROMPTS, 'biasCheck', AlertTriangle, 'red')}
        </TabsContent>

        <TabsContent value="assessment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Assessment Matrix
              </CardTitle>
              <CardDescription>
                Overall confidence assessment and integrated analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Confidence Matrix */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'mom', label: 'MOM Analysis', color: 'blue' },
                  { key: 'pop', label: 'POP Analysis', color: 'green' },
                  { key: 'moses', label: 'MOSES Analysis', color: 'purple' },
                  { key: 'eve', label: 'EVE Analysis', color: 'orange' }
                ].map(({ key, label, color }) => (
                  <Card key={key} className={`border-l-4 border-l-${color}-500`}>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">
                          {confidenceScores[key as keyof Omit<ConfidenceScores, 'overall'>]}%
                        </div>
                        <div className="text-sm text-gray-600">{label}</div>
                        <Progress 
                          value={confidenceScores[key as keyof Omit<ConfidenceScores, 'overall'>]} 
                          className="mt-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Overall Assessment */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-700 mb-2">
                      {confidenceScores.overall.toFixed(1)}%
                    </div>
                    <div className="text-lg font-medium text-blue-800 mb-1">
                      Overall Confidence
                    </div>
                    <Badge 
                      variant="outline" 
                      className={
                        confidenceScores.overall > 70 
                          ? 'bg-red-100 text-red-800 border-red-200' 
                          : confidenceScores.overall > 40 
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          : 'bg-green-100 text-green-800 border-green-200'
                      }
                    >
                      {confidenceScores.overall > 70 ? 'High Deception Risk' : 
                       confidenceScores.overall > 40 ? 'Medium Risk' : 'Low Risk'}
                    </Badge>
                    <div className="mt-3 text-sm text-blue-700">
                      {confidenceScores.overall > 60 
                        ? 'Further investigation recommended' 
                        : confidenceScores.overall > 30 
                        ? 'Monitor situation closely' 
                        : 'Low priority for deception concern'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Note */}
      <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            <strong>Framework:</strong> Based on Richards J. Heuer Jr.'s work and CIA Structured Analytic Techniques (SATs) • 
            Enhanced for 2024-2025 Intelligence Community Standards
          </p>
        </CardContent>
      </Card>
    </div>
  )
}