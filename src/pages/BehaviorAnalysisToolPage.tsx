/**
 * Behavior Analysis Tool Page
 *
 * Single-screen AI-powered COM-B behavior analysis.
 * Two contexts: Intelligence (adversary) and Product (user/stakeholder).
 * Progressive disclosure: describe behavior → get COM-B diagnosis → view interventions.
 */

import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Sparkles, Loader2, RefreshCw, ChevronDown, Shield, Target, Brain, Users, Zap, Eye, AlertTriangle, CheckCircle2, Clock, Lightbulb, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useBehaviorAI, type BehaviorAnalysisContext, type BehaviorInput, type FullAnalysisResult, type CombDiagnosis, type InterventionItem } from '@/hooks/useBehaviorAI'

// --- Constants ---

const CONTEXT_OPTIONS: { value: BehaviorAnalysisContext; label: string; icon: string; description: string; examples: string[] }[] = [
  {
    value: 'intelligence',
    label: 'Intelligence',
    icon: '🕵️',
    description: 'Analyze why an actor/adversary exhibits a behavior',
    examples: [
      'A state-sponsored group is recruiting via encrypted messaging apps',
      'The adversary has shifted from kinetic operations to cyber attacks',
      'A protest group consistently avoids certain neighborhoods during rallies',
    ]
  },
  {
    value: 'product',
    label: 'Product / Research',
    icon: '🔬',
    description: 'Analyze why a user/stakeholder behaves a certain way',
    examples: [
      'Users abandon the onboarding flow after step 3',
      'Developers resist adopting the new CI/CD pipeline',
      'Customers prefer calling support over using self-service',
    ]
  }
]

const COMB_LABELS: Record<string, { label: string; icon: typeof Shield; color: string; intel: string; product: string }> = {
  physical_capability: {
    label: 'Physical Capability',
    icon: Shield,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    intel: 'Tools, weapons, infrastructure',
    product: 'Device access, connectivity, motor skills',
  },
  psychological_capability: {
    label: 'Psychological Capability',
    icon: Brain,
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
    intel: 'Training, expertise, knowledge',
    product: 'Digital literacy, mental models',
  },
  physical_opportunity: {
    label: 'Physical Opportunity',
    icon: Target,
    color: 'text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    intel: 'Environment, access, timing',
    product: 'UI discoverability, time availability',
  },
  social_opportunity: {
    label: 'Social Opportunity',
    icon: Users,
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    intel: 'Networks, organizational support',
    product: 'Peer adoption, team norms',
  },
  reflective_motivation: {
    label: 'Reflective Motivation',
    icon: Eye,
    color: 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    intel: 'Strategic intent, ideology',
    product: 'Perceived value, goals',
  },
  automatic_motivation: {
    label: 'Automatic Motivation',
    icon: Zap,
    color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
    intel: 'Habits, emotional drivers',
    product: 'Habits, emotional responses',
  },
}

const DEFICIT_STYLES: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  adequate: { label: 'Adequate', color: 'text-green-600 bg-green-100 dark:bg-green-900/40', icon: CheckCircle2 },
  deficit: { label: 'Deficit', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40', icon: Clock },
  major_barrier: { label: 'Major Barrier', color: 'text-red-600 bg-red-100 dark:bg-red-900/40', icon: AlertTriangle },
}

// --- COM-B Wheel Visualization ---

function CombWheel({ diagnosis, context }: { diagnosis: CombDiagnosis; context: BehaviorAnalysisContext }) {
  const dimensions = Object.entries(COMB_LABELS)

  const deficitCount = dimensions.filter(([key]) => {
    const d = (diagnosis as any)[key]
    return d?.deficit_level !== 'adequate'
  }).length

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium">{deficitCount}</span>
          <span className="text-muted-foreground"> of 6 dimensions have deficits</span>
        </div>
        {diagnosis.summary && (
          <Badge variant="outline" className="text-xs">{deficitCount === 0 ? 'No barriers' : deficitCount <= 2 ? 'Minor barriers' : 'Significant barriers'}</Badge>
        )}
      </div>

      {/* Dimension cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {dimensions.map(([key, meta]) => {
          const dim = (diagnosis as any)[key]
          if (!dim) return null
          const deficit = DEFICIT_STYLES[dim.deficit_level] || DEFICIT_STYLES.deficit
          const Icon = meta.icon
          const DeficitIcon = deficit.icon

          return (
            <div key={key} className={cn('p-3 rounded-lg border', meta.color)}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">{meta.label}</span>
                </div>
                <div className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium', deficit.color)}>
                  <DeficitIcon className="h-3 w-3" />
                  {deficit.label}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{dim.evidence_notes}</p>
              {dim.indicators?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {dim.indicators.slice(0, 3).map((ind: string, i: number) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 bg-white/60 dark:bg-black/20 rounded">
                      {ind}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Key findings */}
      {diagnosis.key_findings?.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium mb-1">Key Findings</p>
          <ul className="space-y-1">
            {diagnosis.key_findings.map((f, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// --- Intervention Cards ---

function InterventionCards({ interventions, context }: { interventions: InterventionItem[]; context: BehaviorAnalysisContext }) {
  if (!interventions?.length) return null

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const sorted = [...interventions].sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1))

  return (
    <div className="space-y-2">
      {sorted.map((item, i) => {
        const dimMeta = COMB_LABELS[item.target_component]
        return (
          <Card key={i} className="border">
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{item.intervention}</span>
                  {dimMeta && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{dimMeta.label}</Badge>
                  )}
                </div>
                <Badge
                  variant={item.priority === 'high' ? 'destructive' : 'secondary'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {item.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
              {item.implementation_steps?.length > 0 && (
                <div className="space-y-1">
                  {item.implementation_steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-[11px]">
                      <span className="text-muted-foreground font-mono w-4">{j + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
              {item.expected_impact && (
                <p className="text-[11px] text-green-600 dark:text-green-400 mt-1.5 italic">{item.expected_impact}</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// --- Main Page ---

export default function BehaviorAnalysisToolPage() {
  const navigate = useNavigate()
  const resultsRef = useRef<HTMLDivElement>(null)
  const { analyzing, error, fullAnalysis } = useBehaviorAI()

  // State
  const [context, setContext] = useState<BehaviorAnalysisContext>('intelligence')
  const [behavior, setBehavior] = useState<BehaviorInput>({ description: '' })
  const [result, setResult] = useState<FullAnalysisResult | null>(null)

  // Scroll to results
  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const handleAnalyze = async () => {
    if (!behavior.description.trim()) return
    const data = await fullAnalysis(context, behavior)
    if (data) setResult(data)
  }

  const handleReset = () => {
    setBehavior({ description: '' })
    setResult(null)
  }

  const contextConfig = CONTEXT_OPTIONS.find(c => c.value === context)!

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} size="sm" className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-600" />
          Behavior Analysis
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Diagnose why someone behaves a certain way using the COM-B model
        </p>
      </div>

      {/* === MAIN INPUT === */}
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          {/* Context selector */}
          <div className="flex gap-2">
            {CONTEXT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setContext(opt.value); setResult(null) }}
                className={cn(
                  'flex-1 p-3 rounded-lg border-2 text-left transition-all',
                  context === opt.value
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                    : 'border-border hover:border-purple-300'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{opt.icon}</span>
                  <span className="font-medium text-sm">{opt.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{opt.description}</p>
              </button>
            ))}
          </div>

          {/* Behavior description */}
          <div>
            <Textarea
              value={behavior.description}
              onChange={(e) => setBehavior({ ...behavior, description: e.target.value })}
              placeholder={`Describe the behavior you want to analyze...\n\ne.g., "${contextConfig.examples[0]}"`}
              rows={3}
              className="text-base resize-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey && behavior.description.trim()) {
                  e.preventDefault()
                  handleAnalyze()
                }
              }}
            />
          </div>

          {/* Example prompts (when empty) */}
          {!behavior.description && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Try an example:</p>
              <div className="flex flex-wrap gap-1.5">
                {contextConfig.examples.map(ex => (
                  <button
                    key={ex}
                    onClick={() => setBehavior({ ...behavior, description: ex })}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional detail fields */}
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="details" className="border rounded-lg px-4">
              <AccordionTrigger className="py-2.5 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span>Add Context</span>
                  {(behavior.actor || behavior.setting || behavior.frequency || behavior.consequences) && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                      {[behavior.actor, behavior.setting, behavior.frequency, behavior.consequences].filter(Boolean).length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {context === 'intelligence' ? 'Actor / Adversary' : 'User / Stakeholder'}
                    </Label>
                    <Input
                      value={behavior.actor || ''}
                      onChange={(e) => setBehavior({ ...behavior, actor: e.target.value })}
                      placeholder={context === 'intelligence' ? 'e.g., APT29, Protest group' : 'e.g., New users, Enterprise admins'}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Setting / Environment</Label>
                    <Input
                      value={behavior.setting || ''}
                      onChange={(e) => setBehavior({ ...behavior, setting: e.target.value })}
                      placeholder={context === 'intelligence' ? 'e.g., Eastern Europe, dark web' : 'e.g., Mobile app, onboarding flow'}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Frequency</Label>
                    <Input
                      value={behavior.frequency || ''}
                      onChange={(e) => setBehavior({ ...behavior, frequency: e.target.value })}
                      placeholder="e.g., Daily, weekly, during incidents"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Known Consequences</Label>
                    <Input
                      value={behavior.consequences || ''}
                      onChange={(e) => setBehavior({ ...behavior, consequences: e.target.value })}
                      placeholder="e.g., Data exfiltration, user churn"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Action bar */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">Cmd+Enter to analyze</p>
            <div className="flex gap-2">
              {result && (
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Start Over
                </Button>
              )}
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || !behavior.description.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze Behavior
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* === RESULTS === */}
      {result && (
        <div ref={resultsRef} className="space-y-6">
          {/* Overall assessment */}
          {result.overall_assessment && (
            <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/10">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  {result.overall_assessment}
                </p>
              </CardContent>
            </Card>
          )}

          {/* COM-B Diagnosis */}
          <div>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              COM-B Diagnosis
            </h2>
            <CombWheel diagnosis={result.diagnosis} context={context} />
          </div>

          {/* Motivation insights */}
          {result.motivation_insights && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Motivation Insight
                </h3>
                <p className="text-sm text-muted-foreground">{result.motivation_insights.primary_driver}</p>
                {result.motivation_insights.leverage_points?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium mb-1">Leverage Points</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.motivation_insights.leverage_points.map((lp, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{lp}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Interventions */}
          {result.interventions?.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                {context === 'intelligence' ? 'Recommended Actions' : 'Recommended Interventions'}
                <Badge variant="secondary" className="text-xs">{result.interventions.length}</Badge>
              </h2>
              <InterventionCards interventions={result.interventions} context={context} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
