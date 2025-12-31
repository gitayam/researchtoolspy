/**
 * Deception Detection Form
 * Combines MOM-POP-MOSES-EVE text analysis with visual scoring system
 * Integrates AI-powered analysis and real-time likelihood calculation
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Save, Sparkles, AlertTriangle } from 'lucide-react'
import { AIFieldAssistant, AIUrlScraper } from '@/components/ai'
import { DeceptionScoringForm } from './DeceptionScoringForm'
import { DeceptionDashboard } from './DeceptionDashboard'
import { DeceptionPDFExport } from './DeceptionPDFExport'
import { DeceptionClaimImporter } from './DeceptionClaimImporter'
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
  const { t, i18n } = useTranslation('deception')

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
  const [claimReferences, setClaimReferences] = useState<string[]>(initialData?.claimReferences || [])

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

  const handleUrlExtract = (extractedData: Record<string, any>) => {
    // Populate fields with extracted data
    if (extractedData.scenario) {
      setScenario(extractedData.scenario)
    }
    if (extractedData.mom && Array.isArray(extractedData.mom)) {
      setMom(extractedData.mom.join('\n'))
    }
    if (extractedData.pop && Array.isArray(extractedData.pop)) {
      setPop(extractedData.pop.join('\n'))
    }
    if (extractedData.moses && Array.isArray(extractedData.moses)) {
      setMoses(extractedData.moses.join('\n'))
    }
    if (extractedData.eve && Array.isArray(extractedData.eve)) {
      setEve(extractedData.eve.join('\n'))
    }

    // Switch to the first populated tab
    if (extractedData.scenario) {
      setActiveTab('scenario')
    }
  }

  const handleRunAI = async () => {
    if (!scenario) {
      setError(t('errors.scenarioRequired'))
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
        additionalContext: assessment,
        outputLanguage: i18n.language
      })

      setAiAnalysis(analysis)
      setScores(analysis.scores)
      setAssessment(analysis.bottomLine + '\n\n' + analysis.executiveSummary)
      setActiveTab('assessment')
    } catch (err) {
      console.error('AI analysis error:', err)
      setError(t('errors.aiAnalysisFailed'))
    } finally {
      setRunningAI(false)
    }
  }

  const handleClaimImport = (data: {
    scenario: string
    scores: Partial<DeceptionScores>
    claimReferences: string[]
    eveIndicators: string[]
    mosesIndicators: string[]
  }) => {
    // Set scenario from claims
    setScenario(prev => prev ? `${prev}\n\n--- Imported Claims ---\n${data.scenario}` : data.scenario)

    // Update MOSES field with indicators
    if (data.mosesIndicators.length > 0) {
      const mosesText = data.mosesIndicators.map((ind, idx) => `${idx + 1}. ${ind}`).join('\n')
      setMoses(prev => prev ? `${prev}\n\n--- From Claims ---\n${mosesText}` : mosesText)
    }

    // Update EVE field with indicators
    if (data.eveIndicators.length > 0) {
      const eveText = data.eveIndicators.map((ind, idx) => `${idx + 1}. ${ind}`).join('\n')
      setEve(prev => prev ? `${prev}\n\n--- From Claims ---\n${eveText}` : eveText)
    }

    // Merge scores (preserve existing scores, add new ones)
    setScores(prev => ({ ...prev, ...data.scores }))

    // Store claim references for traceability
    setClaimReferences(data.claimReferences)

    // Switch to scenario tab to show imported content
    setActiveTab('scenario')
  }

  const handleSave = async () => {
    if (!title || !scenario) {
      setError(t('errors.titleRequired'))
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
        claimReferences,
        lastUpdated: new Date().toISOString()
      })

      navigate(backPath)
    } catch (err) {
      console.error('Save error:', err)
      setError(t('errors.saveFailed'))
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
          {t('form.backToAnalyses')}
        </Button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {mode === 'create' ? t('form.newAnalysis') : t('form.editAnalysis')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <DeceptionClaimImporter onImport={handleClaimImport} />
            <AIUrlScraper
              framework="deception"
              onExtract={handleUrlExtract}
            />
            {aiAvailable && (
              <Button
                variant="outline"
                onClick={handleRunAI}
                disabled={runningAI || !scenario}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {runningAI ? t('form.analyzing') : t('form.aiAnalysis')}
              </Button>
            )}
            {mode === 'edit' && calculatedAssessment && (
              <DeceptionPDFExport
                analysis={{
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
                  claimReferences,
                  lastUpdated: new Date().toISOString()
                }}
                variant="outline"
              />
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('form.saving') : t('form.saveAnalysis')}
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
              <CardTitle>{t('basicInfo.title')}</CardTitle>
              <CardDescription>{t('basicInfo.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">{t('basicInfo.analysisTitle')} *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('basicInfo.analysisTitlePlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="description">{t('basicInfo.descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('basicInfo.descriptionPlaceholder')}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tabbed Analysis Sections */}
          <Card>
            <CardHeader>
              <CardTitle>{t('sats.title')}</CardTitle>
              <CardDescription>
                {t('sats.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-6 w-full">
                  <TabsTrigger value="scenario">{t('sats.tabs.scenario')}</TabsTrigger>
                  <TabsTrigger value="mom">{t('sats.tabs.mom')}</TabsTrigger>
                  <TabsTrigger value="pop">{t('sats.tabs.pop')}</TabsTrigger>
                  <TabsTrigger value="moses">{t('sats.tabs.moses')}</TabsTrigger>
                  <TabsTrigger value="eve">{t('sats.tabs.eve')}</TabsTrigger>
                  <TabsTrigger value="assessment">{t('sats.tabs.assessment')}</TabsTrigger>
                </TabsList>

                <TabsContent value="scenario" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="scenario">
                      {t('scenario.title')} *
                      <span className="text-xs text-muted-foreground ml-2">
                        {t('scenario.description')}
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="scenario"
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                        placeholder={t('scenario.placeholder')}
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName={t('scenario.title')}
                        currentValue={scenario}
                        onAccept={(value) => setScenario(value)}
                        context={{
                          framework: 'Deception Detection (MOM-POP-MOSES-EVE)',
                          relatedFields: { title, description, mom, pop, moses, eve, assessment }
                        }}
                        placeholder={t('scenario.placeholder')}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="mom" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="mom">
                      {t('categories.mom.fieldLabel')}
                      <span className="text-xs text-muted-foreground ml-2">
                        {t('categories.mom.fieldDescription')}
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="mom"
                        value={mom}
                        onChange={(e) => setMom(e.target.value)}
                        placeholder={t('categories.mom.placeholder')}
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName={t('categories.mom.fieldLabel')}
                        currentValue={mom}
                        onAccept={(value) => setMom(value)}
                        context={{
                          framework: 'Deception Detection (MOM)',
                          relatedFields: { scenario, pop, moses, eve }
                        }}
                        placeholder={t('categories.mom.placeholder')}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="pop" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="pop">
                      {t('categories.pop.fieldLabel')}
                      <span className="text-xs text-muted-foreground ml-2">
                        {t('categories.pop.fieldDescription')}
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="pop"
                        value={pop}
                        onChange={(e) => setPop(e.target.value)}
                        placeholder={t('categories.pop.placeholder')}
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName={t('categories.pop.fieldLabel')}
                        currentValue={pop}
                        onAccept={(value) => setPop(value)}
                        context={{
                          framework: 'Deception Detection (POP)',
                          relatedFields: { scenario, mom, moses, eve }
                        }}
                        placeholder={t('categories.pop.placeholder')}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="moses" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="moses">
                      {t('categories.moses.fieldLabel')}
                      <span className="text-xs text-muted-foreground ml-2">
                        {t('categories.moses.fieldDescription')}
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="moses"
                        value={moses}
                        onChange={(e) => setMoses(e.target.value)}
                        placeholder={t('categories.moses.placeholder')}
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName={t('categories.moses.fieldLabel')}
                        currentValue={moses}
                        onAccept={(value) => setMoses(value)}
                        context={{
                          framework: 'Deception Detection (MOSES)',
                          relatedFields: { scenario, mom, pop, eve }
                        }}
                        placeholder={t('categories.moses.placeholder')}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="eve" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="eve">
                      {t('categories.eve.fieldLabel')}
                      <span className="text-xs text-muted-foreground ml-2">
                        {t('categories.eve.fieldDescription')}
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="eve"
                        value={eve}
                        onChange={(e) => setEve(e.target.value)}
                        placeholder={t('categories.eve.placeholder')}
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName={t('categories.eve.fieldLabel')}
                        currentValue={eve}
                        onAccept={(value) => setEve(value)}
                        context={{
                          framework: 'Deception Detection (EVE)',
                          relatedFields: { scenario, mom, pop, moses }
                        }}
                        placeholder={t('categories.eve.placeholder')}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="assessment" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="assessment">
                      {t('assessment.title')}
                      <span className="text-xs text-muted-foreground ml-2">
                        {t('assessment.description')}
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="assessment"
                        value={assessment}
                        onChange={(e) => setAssessment(e.target.value)}
                        placeholder={t('assessment.placeholder')}
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName={t('assessment.title')}
                        currentValue={assessment}
                        onAccept={(value) => setAssessment(value)}
                        context={{
                          framework: 'Deception Detection (SATS)',
                          relatedFields: { scenario, mom, pop, moses, eve, scores }
                        }}
                        placeholder={t('assessment.placeholder')}
                      />
                    </div>
                  </div>

                  {aiAnalysis && (
                    <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          {t('aiResults.title')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        <div>
                          <strong>{t('aiResults.bottomLine')}:</strong>
                          <p className="mt-1">{aiAnalysis.bottomLine}</p>
                        </div>
                        <div>
                          <strong>{t('aiResults.executiveSummary')}:</strong>
                          <p className="mt-1">{aiAnalysis.executiveSummary}</p>
                        </div>
                        <div>
                          <strong>{t('aiResults.keyIndicators')}:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {aiAnalysis.keyIndicators.map((ind, idx) => (
                              <li key={idx}>{ind}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <strong>{t('aiResults.recommendations')}:</strong>
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
              <CardTitle>{t('scoring.title')}</CardTitle>
              <CardDescription>
                {t('scoring.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeceptionScoringForm
                scenario={{
                  scenario,
                  mom,
                  pop,
                  moses,
                  eve,
                  additionalContext: assessment
                }}
                initialScores={scores}
                onScoresChange={(newScores) => setScores(newScores)}
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
          <div className="sticky top-8 space-y-4" style={{ minHeight: '400px' }}>
            {calculatedAssessment && (
              <DeceptionDashboard
                key={`dashboard-${calculatedAssessment.overallLikelihood}`}
                scores={scores}
                assessment={calculatedAssessment}
              />
            )}

            {!calculatedAssessment && (
              <Card>
                <CardContent className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {t('scoring.fillScoring')}
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
