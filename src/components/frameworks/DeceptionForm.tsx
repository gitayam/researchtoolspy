/**
 * Deception Detection Form
 * Combines MOM-POP-MOSES-EVE text analysis with visual scoring system
 * Integrates AI-powered analysis and real-time likelihood calculation
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Save, Sparkles, AlertTriangle, Search, User, Shield, TrendingUp, History, Loader2, X, Building2, MapPin, Users as UsersIcon, Plus } from 'lucide-react'
import { AIFieldAssistant, AIUrlScraper } from '@/components/ai'
import { DeceptionScoringForm } from './DeceptionScoringForm'
import { DeceptionDashboard } from './DeceptionDashboard'
import { DeceptionPDFExport } from './DeceptionPDFExport'
import { DeceptionClaimImporter } from './DeceptionClaimImporter'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import type { DeceptionScores } from '@/lib/deception-scoring'
import { calculateDeceptionLikelihood } from '@/lib/deception-scoring'
import type { AIDeceptionAnalysis } from '@/lib/ai-deception-analysis'
import { analyzeDeceptionWithAI, checkAIAvailability } from '@/lib/ai-deception-analysis'

interface ActorSearchResult {
  id: string
  name: string
  type: string
  description?: string
}

interface CredibilityData {
  actor: { id: string; name: string; type: string; description?: string; aliases?: string[] }
  credibility: {
    assessment_count: number
    framework_count: number
    mom_count: number
    avg_mom: { motive: number; opportunity: number; means: number }
    avg_pop: { historicalPattern: number; sophisticationLevel: number; successRate: number }
    avg_moses: { sourceVulnerability: number; manipulationEvidence: number }
    avg_eve: { internalConsistency: number; externalCorroboration: number; anomalyDetection: number }
    most_recent_likelihood: number
    deception_profile: Record<string, any> | null
  } | null
  previous_assessments: Array<{
    framework_id: string
    title: string
    likelihood: number
    scores: Partial<DeceptionScores>
    created_at: string
  }>
  mom_assessments: Array<{
    id: string
    motive: number
    opportunity: number
    means: number
    notes?: string
    assessed_at: string
  }>
}

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
  const { currentWorkspaceId } = useWorkspace()

  // Actor picker state
  const [selectedActor, setSelectedActor] = useState<{ id: string; name: string } | null>(
    initialData?.actorId ? { id: initialData.actorId, name: initialData.actorName || '' } : null
  )
  const [actorCredibility, setActorCredibility] = useState<CredibilityData | null>(null)
  const [loadingCredibility, setLoadingCredibility] = useState(false)
  const [credibilityError, setCredibilityError] = useState<string | null>(null)
  const [actorSearchQuery, setActorSearchQuery] = useState('')
  const [actorSearchResults, setActorSearchResults] = useState<ActorSearchResult[]>([])
  const [actorSearchLoading, setActorSearchLoading] = useState(false)
  const [showActorResults, setShowActorResults] = useState(false)
  const actorSearchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Form fields
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [scenario, setScenario] = useState(initialData?.scenario || '')
  const [mom, setMom] = useState(initialData?.mom || '')
  const [pop, setPop] = useState(initialData?.pop || '')
  const [moses, setMoses] = useState(initialData?.moses || '')
  const [eve, setEve] = useState(initialData?.eve || '')
  const [rageCheck, setRageCheck] = useState(initialData?.rageCheck || '')
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

  // Close actor search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actorSearchRef.current && !actorSearchRef.current.contains(e.target as Node)) {
        setShowActorResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load credibility on mount in edit mode
  useEffect(() => {
    if (initialData?.actorId) {
      fetchCredibility(initialData.actorId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced actor search
  const handleActorSearch = useCallback((query: string) => {
    setActorSearchQuery(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 2) {
      setActorSearchResults([])
      setShowActorResults(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setActorSearchLoading(true)
      try {
        const res = await fetch(
          `/api/actors?workspace_id=${encodeURIComponent(currentWorkspaceId)}&search=${encodeURIComponent(query)}&limit=10`,
          { credentials: 'include' }
        )
        if (!res.ok) throw new Error('Search failed')
        const data = await res.json()
        setActorSearchResults(data.actors || [])
        setShowActorResults(true)
      } catch {
        setActorSearchResults([])
      } finally {
        setActorSearchLoading(false)
      }
    }, 300)
  }, [currentWorkspaceId])

  // Fetch credibility when actor is selected
  const fetchCredibility = useCallback(async (actorId: string) => {
    setLoadingCredibility(true)
    setCredibilityError(null)
    try {
      const res = await fetch(
        `/api/actors/${encodeURIComponent(actorId)}/credibility?workspace_id=${encodeURIComponent(currentWorkspaceId)}`,
        { credentials: 'include' }
      )
      if (!res.ok) {
        if (res.status === 404) {
          setActorCredibility(null)
          return
        }
        throw new Error('Failed to load credibility')
      }
      const data: CredibilityData = await res.json()
      setActorCredibility(data)
    } catch (err) {
      setCredibilityError('Failed to load credibility data')
      setActorCredibility(null)
    } finally {
      setLoadingCredibility(false)
    }
  }, [currentWorkspaceId])

  const handleSelectActor = (actor: ActorSearchResult) => {
    setSelectedActor({ id: actor.id, name: actor.name })
    setActorSearchQuery('')
    setShowActorResults(false)
    fetchCredibility(actor.id)
  }

  const handleClearActor = () => {
    setSelectedActor(null)
    setActorCredibility(null)
    setCredibilityError(null)
  }

  const actorTypes = [
    { value: 'PERSON', label: 'Person', icon: <User className="h-3.5 w-3.5" /> },
    { value: 'ORGANIZATION', label: 'Org', icon: <Building2 className="h-3.5 w-3.5" /> },
    { value: 'GOVERNMENT', label: 'Gov', icon: <Building2 className="h-3.5 w-3.5" /> },
    { value: 'GROUP', label: 'Group', icon: <UsersIcon className="h-3.5 w-3.5" /> },
    { value: 'UNIT', label: 'Unit', icon: <UsersIcon className="h-3.5 w-3.5" /> },
  ] as const

  const handleQuickCreateActor = async (name: string, type: string = 'PERSON') => {
    try {
      const res = await fetch('/api/actors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          type,
          workspace_id: currentWorkspaceId,
        }),
      })
      if (!res.ok) throw new Error('Failed to create actor')
      const data = await res.json()
      const newActor = data.actor || data
      handleSelectActor({ id: newActor.id, name: newActor.name, type: newActor.type })
    } catch (err) {
      console.error('Quick create actor error:', err)
      setError('Failed to create actor')
    }
  }

  const handlePreFillScores = () => {
    if (!actorCredibility?.credibility) return
    // Prefer deception_profile (most recent full scores), fall back to previous_assessments[0]
    const profile = actorCredibility.credibility.deception_profile
    if (profile) {
      setScores(profile as Partial<DeceptionScores>)
    } else if (actorCredibility.previous_assessments?.[0]?.scores) {
      setScores(actorCredibility.previous_assessments[0].scores)
    }
  }

  const getActorIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'person': return <User className="h-4 w-4" />
      case 'organization': return <Building2 className="h-4 w-4" />
      case 'location': return <MapPin className="h-4 w-4" />
      case 'group': return <UsersIcon className="h-4 w-4" />
      default: return <User className="h-4 w-4" />
    }
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 4) return 'bg-red-500'
    if (score >= 3) return 'bg-orange-500'
    if (score >= 2) return 'bg-yellow-500'
    return 'bg-green-500'
  }

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
    if (extractedData.rage_check && Array.isArray(extractedData.rage_check)) {
      setRageCheck(extractedData.rage_check.join('\n'))
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
        additionalContext: assessment + '\n\nRageCheck Analysis:\n' + rageCheck,
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
        rageCheck,
        assessment,
        scores,
        aiAnalysis,
        calculatedAssessment,
        claimReferences,
        actorId: selectedActor?.id || null,
        actorName: selectedActor?.name || null,
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
    <div className="w-full py-8 px-4 max-w-7xl mx-auto">
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
                  rageCheck,
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

              {/* Actor Picker */}
              <div className="space-y-2">
                <Label>Subject Actor</Label>

                {/* Selected Actor Display */}
                {selectedActor && (
                  <div className="flex items-center gap-2 p-3 bg-accent rounded-lg">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 font-medium">{selectedActor.name}</span>
                    <Button variant="ghost" size="sm" onClick={handleClearActor} className="h-8 w-8 p-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Search Input */}
                {!selectedActor && (
                  <div className="relative" ref={actorSearchRef}>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search for an actor to assess..."
                      value={actorSearchQuery}
                      onChange={(e) => handleActorSearch(e.target.value)}
                      className="pl-10"
                    />

                    {/* Search Results Dropdown */}
                    {showActorResults && actorSearchResults.length > 0 && (
                      <Card className="absolute z-50 w-full mt-1 max-h-80 overflow-y-auto">
                        <CardContent className="p-2">
                          <div className="space-y-1">
                            {actorSearchResults.map((actor) => (
                              <button
                                key={actor.id}
                                onClick={() => handleSelectActor(actor)}
                                className="w-full text-left p-3 hover:bg-accent rounded-lg transition-colors min-h-[44px]"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-1">{getActorIcon(actor.type)}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{actor.name}</div>
                                    {actor.description && (
                                      <div className="text-sm text-muted-foreground truncate">
                                        {actor.description}
                                      </div>
                                    )}
                                    <Badge variant="outline" className="text-xs capitalize mt-1">
                                      {actor.type?.toLowerCase()}
                                    </Badge>
                                  </div>
                                </div>
                              </button>
                            ))}
                            {/* Create new option at bottom of results */}
                            <div className="border-t border-border mt-1 pt-2 px-3 pb-1">
                              <p className="text-xs text-muted-foreground mb-2">Not found? Create "{actorSearchQuery}" as:</p>
                              <div className="flex flex-wrap gap-1.5 mb-1">
                                {actorTypes.map((at) => (
                                  <Button
                                    key={at.value}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => handleQuickCreateActor(actorSearchQuery, at.value)}
                                  >
                                    {at.icon}
                                    <span className="ml-1">{at.label}</span>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* No Results */}
                    {showActorResults && actorSearchResults.length === 0 && !actorSearchLoading && actorSearchQuery.length >= 2 && (
                      <Card className="absolute z-50 w-full mt-1">
                        <CardContent className="p-4 space-y-3">
                          <p className="text-sm text-muted-foreground text-center">
                            No actors found matching "{actorSearchQuery}"
                          </p>
                          <p className="text-xs text-muted-foreground text-center">Create "{actorSearchQuery}" as:</p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {actorTypes.map((at) => (
                              <Button
                                key={at.value}
                                variant="outline"
                                size="sm"
                                className="min-h-[44px]"
                                onClick={() => handleQuickCreateActor(actorSearchQuery, at.value)}
                              >
                                {at.icon}
                                <span className="ml-1.5">{at.label}</span>
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Loading */}
                    {actorSearchLoading && (
                      <Card className="absolute z-50 w-full mt-1">
                        <CardContent className="p-4 text-center text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Searching...
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  Link an actor to load their previous credibility assessments
                </p>
              </div>

              {/* Credibility Display */}
              {selectedActor && loadingCredibility && (
                <div className="flex items-center gap-2 p-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading credibility data...
                </div>
              )}

              {selectedActor && credibilityError && (
                <div className="flex items-center justify-between p-4 text-sm text-muted-foreground">
                  <span>{credibilityError}</span>
                  <Button variant="ghost" size="sm" onClick={() => fetchCredibility(selectedActor.id)}>
                    Retry
                  </Button>
                </div>
              )}

              {selectedActor && !loadingCredibility && !credibilityError && actorCredibility && (
                <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Credibility Profile
                    </CardTitle>
                    <CardDescription>
                      {actorCredibility.credibility
                        ? `${actorCredibility.credibility.assessment_count} previous assessment${actorCredibility.credibility.assessment_count !== 1 ? 's' : ''}`
                        : 'No previous assessments'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!actorCredibility.credibility && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No previous assessments for this actor
                      </p>
                    )}

                    {actorCredibility.credibility && (
                      <>
                        {/* Most Recent Likelihood */}
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Most Recent Likelihood:</span>
                          <Badge variant={
                            actorCredibility.credibility.most_recent_likelihood >= 60 ? 'destructive' :
                            actorCredibility.credibility.most_recent_likelihood >= 40 ? 'default' : 'secondary'
                          }>
                            {actorCredibility.credibility.most_recent_likelihood}%
                          </Badge>
                        </div>

                        {/* Category Score Bars from server-side averages */}
                        <div className="space-y-2">
                          {[
                            { label: 'MOM', avg: actorCredibility.credibility.avg_mom, keys: ['motive', 'opportunity', 'means'] },
                            { label: 'POP', avg: actorCredibility.credibility.avg_pop, keys: ['historicalPattern', 'sophisticationLevel', 'successRate'] },
                            { label: 'MOSES', avg: actorCredibility.credibility.avg_moses, keys: ['sourceVulnerability', 'manipulationEvidence'] },
                            { label: 'EVE', avg: actorCredibility.credibility.avg_eve, keys: ['internalConsistency', 'externalCorroboration', 'anomalyDetection'] },
                          ].map(cat => {
                            const vals = cat.keys.map(k => (cat.avg as Record<string, number>)?.[k]).filter((v: unknown): v is number => typeof v === 'number')
                            if (vals.length === 0) return null
                            const categoryAvg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length
                            return (
                              <div key={cat.label} className="flex items-center gap-2">
                                <span className="text-xs font-medium w-14">{cat.label}</span>
                                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${getScoreBarColor(categoryAvg)}`}
                                    style={{ width: `${(categoryAvg / 5) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right">{categoryAvg.toFixed(1)}</span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Assessment History */}
                        {actorCredibility.previous_assessments.length > 1 && (
                          <div className="pt-2 border-t">
                            <div className="flex items-center gap-1 mb-2">
                              <History className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Recent Assessments</span>
                            </div>
                            <div className="space-y-1">
                              {actorCredibility.previous_assessments.slice(0, 3).map((pa) => (
                                <div key={pa.framework_id} className="flex items-center justify-between text-xs">
                                  <span className="truncate flex-1 mr-2">{pa.title}</span>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {pa.likelihood}%
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pre-fill Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePreFillScores}
                          className="w-full"
                        >
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Pre-fill from profile
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedActor && !loadingCredibility && !credibilityError && !actorCredibility && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No previous assessments for this actor
                </p>
              )}
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
                <TabsList className="grid grid-cols-7 w-full">
                  <TabsTrigger value="scenario">{t('sats.tabs.scenario')}</TabsTrigger>
                  <TabsTrigger value="mom">{t('sats.tabs.mom')}</TabsTrigger>
                  <TabsTrigger value="pop">{t('sats.tabs.pop')}</TabsTrigger>
                  <TabsTrigger value="moses">{t('sats.tabs.moses')}</TabsTrigger>
                  <TabsTrigger value="eve">{t('sats.tabs.eve')}</TabsTrigger>
                  <TabsTrigger value="ragecheck">RageCheck</TabsTrigger>
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

                <TabsContent value="ragecheck" className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="ragecheck">
                      RageCheck Analysis
                      <span className="text-xs text-muted-foreground ml-2">
                        Analysis of manipulative framing, emotional provocation, and tribalism signals
                      </span>
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        id="ragecheck"
                        value={rageCheck}
                        onChange={(e) => setRageCheck(e.target.value)}
                        placeholder="Analyze for: Emotional provocation, Tribalism/Us-vs-Them, Catastrophizing, Generalization..."
                        rows={10}
                      />
                      <AIFieldAssistant
                        fieldName="RageCheck Analysis"
                        currentValue={rageCheck}
                        onAccept={(value) => setRageCheck(value)}
                        context={{
                          framework: 'Deception Detection (RageCheck)',
                          relatedFields: { scenario, mom, pop, moses, eve }
                        }}
                        placeholder="Detect manipulative framing..."
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
