/**
 * Deception Detection Form
 * Combines MOM-POP-MOSES-EVE text analysis with visual scoring system
 * Integrates AI-powered analysis and real-time likelihood calculation
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Save, Sparkles, AlertTriangle } from 'lucide-react'
import { AIFieldAssistant } from '@/components/ai'
import { DeceptionScoringForm } from './DeceptionScoringForm'
import { DeceptionDashboard } from './DeceptionDashboard'
import type { DeceptionScores } from '@/lib/deception-scoring'
import { calculateDeceptionLikelihood } from '@/lib/deception-scoring'
import type { AIDeceptionAnalysis } from '@/lib/ai-deception-analysis'
import { analyzeDeceptionWithAI, checkAIAvailability } from '@/lib/ai-deception-analysis'

interface DeceptionFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  onSave: (data: any) => Promise<void>
  backPath?: string
  frameworkId?: string
}

export function DeceptionForm({
  mode,
  initialData,
  onSave,
  backPath = '/dashboard/analysis-frameworks/deception',
  frameworkId
}: DeceptionFormProps) {
  const navigate = useNavigate()

  // Form fields
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [scenario, setScenario] = useState(initialData?.scenario || '')
  const [mom, setMom] = useState(initialData?.mom || '')
  const [pop, setPop] = useState(initialData?.pop || '')
  const [moses, setMoses] = useState(initialData?.moses || '')
  const [eve, setEve] = useState(initialData?.eve || '')
  const [assessment, setAssessment] = useState(initialData?.assessment || '')

  // Scoring
  const [scores, setScores] = useState<Partial<DeceptionScores>>(initialData?.scores || {})
  const [aiAnalysis, setAiAnalysis] = useState<AIDeceptionAnalysis | null>(initialData?.aiAnalysis || null)

  // UI state
  const [activeTab, setActiveTab] = useState('scenario')
  const [saving, setSaving] = useState(false)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [runningAI, setRunningAI] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check AI availability on mount
  useEffect(() => {
    checkAIAvailability().then(setAiAvailable)
  }, [])

  const handleRunAI = async () => {
    if (!scenario) {
      setError('Please provide a scenario description before running AI analysis')
      return
    }

    setRunningAI(true)
    setError(null)

    try {
      const analysis = await analyzeDeceptionWithAI({
        scenario,
        mom,
        pop,
        moses,
        eve,
        additionalContext: assessment
      })

      setAiAnalysis(analysis)
      setScores(analysis.scores)
      setAssessment(analysis.bottomLine + '\n\n' + analysis.executiveSummary)
      setActiveTab('assessment')
    } catch (err) {
      console.error('AI analysis error:', err)
      setError('AI analysis failed. Please check your API key configuration.')
    } finally {
      setRunningAI(false)
    }
  }

  const handleSave = async () => {
    if (!title || !scenario) {
      setError('Title and scenario are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const calculatedAssessment = calculateDeceptionLikelihood(scores)

      await onSave({
        title,
        description,
        scenario,
        mom,
        pop,
        moses,
        eve,
        assessment,
        scores,
        aiAnalysis,
        calculatedAssessment,
        lastUpdated: new Date().toISOString()
      })

      navigate(backPath)
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save analysis. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const calculatedAssessment = scores && Object.keys(scores).length > 0
    ? calculateDeceptionLikelihood(scores)
    : null

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(backPath)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Analyses
        </Button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {mode === 'create' ? 'New Deception Analysis' : 'Edit Deception Analysis'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              CIA SATS MOM-POP-MOSES-EVE Framework
            </p>
          </div>
          <div className="flex gap-2">
            {aiAvailable && (
              <Button
                variant="outline"
                onClick={handleRunAI}
                disabled={runningAI || !scenario}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {runningAI ? 'Analyzing...' : 'AI Analysis'}
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Analysis'}
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Identify the analysis and scenario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Analysis Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Russian Maskirovka Assessment - Operation XYZ"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief overview of this analysis"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tabbed Analysis Sections */}
          <Card>
            <CardHeader>
              <CardTitle>SATS Analysis Framework</CardTitle>
              <CardDescription>
                Complete each section to build comprehensive deception assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-6 w-full">
                  <TabsTrigger value="scenario">Scenario</TabsTrigger>
                  <TabsTrigger value="mom">MOM</TabsTrigger>
                  <TabsTrigger value="pop">POP</TabsTrigger>
                  <TabsTrigger value="moses">MOSES</TabsTrigger>
                  <TabsTrigger value="eve">EVE</TabsTrigger>
                  <TabsTrigger value="assessment">Assessment</TabsTrigger>
                </TabsList>

                <TabsContent value="scenario" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="scenario">
                      Scenario Description *
                      <span className="text-xs text-muted-foreground ml-2">
                        Describe the information or situation being analyzed
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="scenario"
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                        placeholder="Provide detailed description of the scenario, including source of information, context, and what claims or information are being assessed..."
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName="Scenario Description"
                        currentValue={scenario}
                        onAccept={(value) => setScenario(value)}
                        context={{
                          framework: 'Deception Detection (MOM-POP-MOSES-EVE)',
                          relatedFields: { title, description, mom, pop, moses, eve, assessment }
                        }}
                        placeholder="Describe the scenario..."
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="mom" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="mom">
                      MOM (Motive, Opportunity, Means)
                      <span className="text-xs text-muted-foreground ml-2">
                        Assess whether adversary has motive, opportunity, and means to deceive
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="mom"
                        value={mom}
                        onChange={(e) => setMom(e.target.value)}
                        placeholder="Motive: Why would they want to deceive? What do they gain?&#10;Opportunity: Do they control information channels?&#10;Means: Do they have capabilities to execute deception?"
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName="MOM Analysis"
                        currentValue={mom}
                        onAccept={(value) => setMom(value)}
                        context={{
                          framework: 'Deception Detection (MOM)',
                          relatedFields: { scenario, pop, moses, eve }
                        }}
                        placeholder="Analyze motive, opportunity, and means..."
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="pop" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="pop">
                      POP (Patterns of Practice)
                      <span className="text-xs text-muted-foreground ml-2">
                        Examine historical deception patterns
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="pop"
                        value={pop}
                        onChange={(e) => setPop(e.target.value)}
                        placeholder="Historical patterns: Has this actor used deception before?&#10;Sophistication: How advanced are their deception techniques?&#10;Success rate: Have their past deceptions worked?"
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName="POP Analysis"
                        currentValue={pop}
                        onAccept={(value) => setPop(value)}
                        context={{
                          framework: 'Deception Detection (POP)',
                          relatedFields: { scenario, mom, moses, eve }
                        }}
                        placeholder="Analyze patterns of practice..."
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="moses" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="moses">
                      MOSES (My Own Sources Evaluation)
                      <span className="text-xs text-muted-foreground ml-2">
                        Evaluate vulnerability of your sources to manipulation
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="moses"
                        value={moses}
                        onChange={(e) => setMoses(e.target.value)}
                        placeholder="Source vulnerability: Could our sources be compromised?&#10;Access: Do adversaries have access to our collection methods?&#10;Manipulation evidence: Any signs of source manipulation?"
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName="MOSES Analysis"
                        currentValue={moses}
                        onAccept={(value) => setMoses(value)}
                        context={{
                          framework: 'Deception Detection (MOSES)',
                          relatedFields: { scenario, mom, pop, eve }
                        }}
                        placeholder="Analyze source vulnerability..."
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="eve" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="eve">
                      EVE (Evaluation of Evidence)
                      <span className="text-xs text-muted-foreground ml-2">
                        Assess internal consistency and corroboration
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="eve"
                        value={eve}
                        onChange={(e) => setEve(e.target.value)}
                        placeholder="Internal consistency: Does the information hang together logically?&#10;External corroboration: Do independent sources confirm it?&#10;Anomalies: Are there any suspicious patterns or oddities?"
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName="EVE Analysis"
                        currentValue={eve}
                        onAccept={(value) => setEve(value)}
                        context={{
                          framework: 'Deception Detection (EVE)',
                          relatedFields: { scenario, mom, pop, moses }
                        }}
                        placeholder="Analyze evidence evaluation..."
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="assessment" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="assessment">
                      Overall Assessment
                      <span className="text-xs text-muted-foreground ml-2">
                        Synthesize findings and determine deception likelihood
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="assessment"
                        value={assessment}
                        onChange={(e) => setAssessment(e.target.value)}
                        placeholder="Bottom Line Up Front (BLUF):&#10;&#10;Key Findings:&#10;&#10;Recommendations:&#10;&#10;Confidence Level:"
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName="Overall Assessment"
                        currentValue={assessment}
                        onAccept={(value) => setAssessment(value)}
                        context={{
                          framework: 'Deception Detection (SATS)',
                          relatedFields: { scenario, mom, pop, moses, eve, scores }
                        }}
                        placeholder="Synthesize findings..."
                      />
                    </div>
                  </div>

                  {aiAnalysis && (
                    <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          AI Analysis Results
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        <div>
                          <strong>Bottom Line:</strong>
                          <p className="mt-1">{aiAnalysis.bottomLine}</p>
                        </div>
                        <div>
                          <strong>Executive Summary:</strong>
                          <p className="mt-1">{aiAnalysis.executiveSummary}</p>
                        </div>
                        <div>
                          <strong>Key Indicators:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {aiAnalysis.keyIndicators.map((ind, idx) => (
                              <li key={idx}>{ind}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <strong>Recommendations:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {aiAnalysis.recommendations.slice(0, 3).map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Scoring Section */}
          <Card>
            <CardHeader>
              <CardTitle>Deception Likelihood Scoring</CardTitle>
              <CardDescription>
                Score each criterion (0-5) based on your analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeceptionScoringForm
                scenario={scenario}
                initialScores={scores}
                onScoresChange={setScores}
                onAIAnalysisComplete={(analysis) => {
                  setAiAnalysis(analysis)
                  setAssessment(analysis.bottomLine + '\n\n' + analysis.executiveSummary)
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-4">
            {calculatedAssessment && (
              <DeceptionDashboard
                scores={scores}
                assessment={calculatedAssessment}
              />
            )}

            {!calculatedAssessment && (
              <Card>
                <CardContent className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Fill in the scoring section to see real-time deception likelihood analysis
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
