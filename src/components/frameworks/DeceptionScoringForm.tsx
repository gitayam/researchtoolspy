/**
 * Enhanced Deception Detection Scoring Form
 * Interactive scoring interface with real-time deception likelihood calculation
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'
import type { DeceptionScores, DeceptionAssessment } from '@/lib/deception-scoring'
import {
  calculateDeceptionLikelihood,
  SCORING_CRITERIA,
  getRiskColor,
  getConfidenceColor,
  generateKeyIndicators
} from '@/lib/deception-scoring'
import type { DeceptionScenario } from '@/lib/ai-deception-analysis'
import { analyzeDeceptionWithAI, checkAIAvailability } from '@/lib/ai-deception-analysis'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Helper to get translated criteria
function useTranslatedCriteria() {
  const { t } = useTranslation('deception')

  return {
    getCriterionLabel: (criterion: string) => t(`criteria.${criterion}.label`),
    getCriterionDescription: (criterion: string) => t(`criteria.${criterion}.description`),
    getLevelLabel: (criterion: string, value: number) => t(`criteria.${criterion}.levels.${value}.label`),
    getLevelDescription: (criterion: string, value: number) => t(`criteria.${criterion}.levels.${value}.description`),
    getLevels: (criterion: string) => {
      // Return levels in the same format as SCORING_CRITERIA
      const levels = []
      for (let i = 0; i <= 5; i++) {
        levels.push({
          value: i,
          label: t(`criteria.${criterion}.levels.${i}.label`),
          description: t(`criteria.${criterion}.levels.${i}.description`)
        })
      }
      return levels
    }
  }
}

interface DeceptionScoringFormProps {
  scenario: DeceptionScenario
  initialScores?: Partial<DeceptionScores>
  onScoresChange?: (scores: DeceptionScores, assessment: DeceptionAssessment) => void
  onAIAnalysisComplete?: (analysis: any) => void
}

export function DeceptionScoringForm({
  scenario,
  initialScores,
  onScoresChange,
  onAIAnalysisComplete
}: DeceptionScoringFormProps) {
  const { t } = useTranslation('deception')
  const translatedCriteria = useTranslatedCriteria()

  const [scores, setScores] = useState<DeceptionScores>({
    motive: initialScores?.motive ?? 0,
    opportunity: initialScores?.opportunity ?? 0,
    means: initialScores?.means ?? 0,
    historicalPattern: initialScores?.historicalPattern ?? 0,
    sophisticationLevel: initialScores?.sophisticationLevel ?? 0,
    successRate: initialScores?.successRate ?? 0,
    sourceVulnerability: initialScores?.sourceVulnerability ?? 0,
    manipulationEvidence: initialScores?.manipulationEvidence ?? 0,
    internalConsistency: initialScores?.internalConsistency ?? 5,
    externalCorroboration: initialScores?.externalCorroboration ?? 5,
    anomalyDetection: initialScores?.anomalyDetection ?? 0
  })

  const [assessment, setAssessment] = useState<DeceptionAssessment>(calculateDeceptionLikelihood(scores))
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiAvailable, setAiAvailable] = useState(false)

  // Check AI availability on mount
  useEffect(() => {
    checkAIAvailability().then(setAiAvailable)
  }, [])

  // Recalculate assessment when scores change
  useEffect(() => {
    const newAssessment = calculateDeceptionLikelihood(scores)
    setAssessment(newAssessment)
    onScoresChange?.(scores, newAssessment)
  }, [scores])

  const handleScoreChange = (criterion: keyof DeceptionScores, value: number[]) => {
    setScores(prev => ({ ...prev, [criterion]: value[0] }))
  }

  const handleAIAssist = async () => {
    setAiAnalyzing(true)
    try {
      const aiAnalysis = await analyzeDeceptionWithAI(scenario)
      setScores(aiAnalysis.scores)
      onAIAnalysisComplete?.(aiAnalysis)
    } catch (error) {
      console.error('AI analysis failed:', error)
    } finally {
      setAiAnalyzing(false)
    }
  }

  const indicators = generateKeyIndicators(assessment)

  return (
    <div className="space-y-6">
      {/* Overall Assessment Card */}
      <Card className={`border-2 ${getRiskColor(assessment.riskLevel)}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{t('assessment.deceptionLikelihood')}</CardTitle>
              <CardDescription>{t('assessment.realTimeScoring')}</CardDescription>
            </div>
            {aiAvailable && (
              <Button onClick={handleAIAssist} disabled={aiAnalyzing} variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                {aiAnalyzing ? t('form.analyzing') : t('form.aiAssist')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Deception Likelihood Gauge */}
            <div className="text-center">
              <div className="text-6xl font-bold mb-2" style={{
                color: assessment.overallLikelihood >= 80 ? '#dc2626' :
                       assessment.overallLikelihood >= 60 ? '#ea580c' :
                       assessment.overallLikelihood >= 40 ? '#ca8a04' :
                       assessment.overallLikelihood >= 20 ? '#2563eb' : '#16a34a'
              }}>
                {assessment.overallLikelihood}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('assessment.overallLikelihood')}</div>
              <div className={`text-lg font-semibold mt-2 ${getRiskColor(assessment.riskLevel)}`}>
                {t(`riskLevels.${assessment.riskLevel.toLowerCase()}`)} {t('assessment.riskLevel')}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('categories.mom.shortTitle')}</span>
                <span className="text-sm font-bold">{assessment.categoryScores.mom.toFixed(1)}/5.0</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full"
                  style={{ width: `${(assessment.categoryScores.mom / 5) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('categories.pop.shortTitle')}</span>
                <span className="text-sm font-bold">{assessment.categoryScores.pop.toFixed(1)}/5.0</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full"
                  style={{ width: `${(assessment.categoryScores.pop / 5) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('categories.moses.shortTitle')}</span>
                <span className="text-sm font-bold">{assessment.categoryScores.moses.toFixed(1)}/5.0</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ width: `${(assessment.categoryScores.moses / 5) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('categories.eve.shortTitle')}</span>
                <span className="text-sm font-bold">{assessment.categoryScores.eve.toFixed(1)}/5.0</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${(assessment.categoryScores.eve / 5) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm font-medium">{t('assessment.confidenceLevel')}</span>
                <span className={`text-sm font-bold ${getConfidenceColor(assessment.confidenceLevel)}`}>
                  {t(`confidenceLevels.${assessment.confidenceLevel.toLowerCase().replace('_', '')}`)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MOM Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            {t('categories.mom.title')}
          </CardTitle>
          <CardDescription>{t('categories.mom.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ScoringSlider
            criterion="motive"
            label={translatedCriteria.getCriterionLabel('motive')}
            description={translatedCriteria.getCriterionDescription('motive')}
            value={scores.motive}
            levels={translatedCriteria.getLevels('motive')}
            onChange={(value) => handleScoreChange('motive', value)}
          />
          <ScoringSlider
            criterion="opportunity"
            label={translatedCriteria.getCriterionLabel('opportunity')}
            description={translatedCriteria.getCriterionDescription('opportunity')}
            value={scores.opportunity}
            levels={translatedCriteria.getLevels('opportunity')}
            onChange={(value) => handleScoreChange('opportunity', value)}
          />
          <ScoringSlider
            criterion="means"
            label={translatedCriteria.getCriterionLabel('means')}
            description={translatedCriteria.getCriterionDescription('means')}
            value={scores.means}
            levels={translatedCriteria.getLevels('means')}
            onChange={(value) => handleScoreChange('means', value)}
          />
        </CardContent>
      </Card>

      {/* POP Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            {t('categories.pop.title')}
          </CardTitle>
          <CardDescription>{t('categories.pop.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ScoringSlider
            criterion="historicalPattern"
            label={translatedCriteria.getCriterionLabel('historicalPattern')}
            description={translatedCriteria.getCriterionDescription('historicalPattern')}
            value={scores.historicalPattern}
            levels={translatedCriteria.getLevels('historicalPattern')}
            onChange={(value) => handleScoreChange('historicalPattern', value)}
          />
          <ScoringSlider
            criterion="sophisticationLevel"
            label={translatedCriteria.getCriterionLabel('sophisticationLevel')}
            description={translatedCriteria.getCriterionDescription('sophisticationLevel')}
            value={scores.sophisticationLevel}
            levels={translatedCriteria.getLevels('sophisticationLevel')}
            onChange={(value) => handleScoreChange('sophisticationLevel', value)}
          />
          <ScoringSlider
            criterion="successRate"
            label={translatedCriteria.getCriterionLabel('successRate')}
            description={translatedCriteria.getCriterionDescription('successRate')}
            value={scores.successRate}
            levels={translatedCriteria.getLevels('successRate')}
            onChange={(value) => handleScoreChange('successRate', value)}
          />
        </CardContent>
      </Card>

      {/* MOSES Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            {t('categories.moses.title')}
          </CardTitle>
          <CardDescription>{t('categories.moses.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ScoringSlider
            criterion="sourceVulnerability"
            label={translatedCriteria.getCriterionLabel('sourceVulnerability')}
            description={translatedCriteria.getCriterionDescription('sourceVulnerability')}
            value={scores.sourceVulnerability}
            levels={translatedCriteria.getLevels('sourceVulnerability')}
            onChange={(value) => handleScoreChange('sourceVulnerability', value)}
          />
          <ScoringSlider
            criterion="manipulationEvidence"
            label={translatedCriteria.getCriterionLabel('manipulationEvidence')}
            description={translatedCriteria.getCriterionDescription('manipulationEvidence')}
            value={scores.manipulationEvidence}
            levels={translatedCriteria.getLevels('manipulationEvidence')}
            onChange={(value) => handleScoreChange('manipulationEvidence', value)}
          />
        </CardContent>
      </Card>

      {/* EVE Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            {t('categories.eve.title')}
          </CardTitle>
          <CardDescription>{t('categories.eve.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ScoringSlider
            criterion="internalConsistency"
            label={translatedCriteria.getCriterionLabel('internalConsistency')}
            description={translatedCriteria.getCriterionDescription('internalConsistency')}
            value={scores.internalConsistency}
            levels={translatedCriteria.getLevels('internalConsistency')}
            onChange={(value) => handleScoreChange('internalConsistency', value)}
            inverted
          />
          <ScoringSlider
            criterion="externalCorroboration"
            label={translatedCriteria.getCriterionLabel('externalCorroboration')}
            description={translatedCriteria.getCriterionDescription('externalCorroboration')}
            value={scores.externalCorroboration}
            levels={translatedCriteria.getLevels('externalCorroboration')}
            onChange={(value) => handleScoreChange('externalCorroboration', value)}
            inverted
          />
          <ScoringSlider
            criterion="anomalyDetection"
            label={translatedCriteria.getCriterionLabel('anomalyDetection')}
            description={translatedCriteria.getCriterionDescription('anomalyDetection')}
            value={scores.anomalyDetection}
            levels={translatedCriteria.getLevels('anomalyDetection')}
            onChange={(value) => handleScoreChange('anomalyDetection', value)}
          />
        </CardContent>
      </Card>

      {/* Key Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>{t('indicators.title')}</CardTitle>
          <CardDescription>{t('indicators.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {indicators.deceptionIndicators.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t('indicators.deceptionIndicators')}
              </h4>
              <ul className="space-y-1">
                {indicators.deceptionIndicators.map((indicator, idx) => (
                  <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    {indicator}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {indicators.counterIndicators.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {t('indicators.counterIndicators')}
              </h4>
              <ul className="space-y-1">
                {indicators.counterIndicators.map((indicator, idx) => (
                  <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <TrendingDown className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {indicator}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {indicators.deceptionIndicators.length === 0 && indicators.counterIndicators.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Minus className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">{t('indicators.noIndicators')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Scoring Slider Component
interface ScoringSliderProps {
  criterion: string
  label: string
  description: string
  value: number
  levels: Array<{ value: number; label: string; description: string }>
  onChange: (value: number[]) => void
  inverted?: boolean
}

function ScoringSlider({ criterion, label, description, value, levels, onChange, inverted }: ScoringSliderProps) {
  const selectedLevel = levels.find(l => l.value === value)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={criterion} className="font-medium">{label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
          {selectedLevel?.label} ({value}/5)
        </span>
      </div>

      <Slider
        id={criterion}
        min={0}
        max={5}
        step={1}
        value={[value]}
        onValueChange={onChange}
        className="w-full"
      />

      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{inverted ? levels[levels.length - 1].label : levels[0].label}</span>
        <span>{inverted ? levels[0].label : levels[levels.length - 1].label}</span>
      </div>

      {selectedLevel && (
        <p className="text-xs text-gray-600 dark:text-gray-400 italic">
          {selectedLevel.description}
        </p>
      )}
    </div>
  )
}
