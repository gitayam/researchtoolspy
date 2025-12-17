/**
 * AI COG Assistant Component
 *
 * Provides AI-powered suggestions for COG analysis
 * Can be used for COG identification, capabilities, requirements, vulnerabilities, and impact
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, Check, X, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useCOGAI, type COGContext, type COGData, type CapabilityData, type RequirementData } from '@/hooks/useCOGAI'
import { useToast } from '@/components/ui/use-toast'

export type AICOGAssistantMode =
  | 'suggest-cog'
  | 'validate-cog'
  | 'generate-capabilities'
  | 'generate-requirements'
  | 'generate-vulnerabilities'
  | 'generate-impact'

interface AICOGAssistantProps {
  mode: AICOGAssistantMode
  context?: COGContext
  cog?: COGData
  capability?: CapabilityData
  requirement?: RequirementData
  capabilities?: CapabilityData[]
  requirements?: RequirementData[]
  onAccept: (result: any) => void
  buttonText?: string
  buttonVariant?: 'default' | 'outline' | 'ghost'
  buttonSize?: 'default' | 'sm' | 'lg'
}

export function AICOGAssistant({
  mode,
  context,
  cog,
  capability,
  requirement,
  capabilities,
  requirements,
  onAccept,
  buttonText,
  buttonVariant = 'outline',
  buttonSize = 'sm'
}: AICOGAssistantProps) {
  const { t } = useTranslation('cog')
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [expandedItem, setExpandedItem] = useState<number | null>(null)

  const {
    enabled,
    analyzing,
    error,
    suggestCOGs,
    validateCOG,
    generateCapabilities,
    generateRequirements,
    generateVulnerabilities,
    generateImpact
  } = useCOGAI()

  const { toast } = useToast()

  const handleGenerate = async () => {
    setResult(null)
    setExpandedItem(null)
    let data: any = null

    try {
      switch (mode) {
        case 'suggest-cog':
          data = await suggestCOGs(context || {})
          break

        case 'validate-cog':
          if (!cog) {
            toast({ title: t('common.error'), description: t('aiAssistant.errors.cogRequired'), variant: 'destructive' })
            return
          }
          data = await validateCOG(cog, context)
          break

        case 'generate-capabilities':
          if (!cog) {
            toast({ title: t('common.error'), description: t('aiAssistant.errors.cogRequiredForCapabilities'), variant: 'destructive' })
            return
          }
          data = await generateCapabilities(cog, context)
          break

        case 'generate-requirements':
          if (!capability) {
            toast({ title: t('common.error'), description: t('aiAssistant.errors.capabilityRequired'), variant: 'destructive' })
            return
          }
          data = await generateRequirements(capability, cog, context)
          break

        case 'generate-vulnerabilities':
          if (!requirement) {
            toast({ title: t('common.error'), description: t('aiAssistant.errors.requirementRequired'), variant: 'destructive' })
            return
          }
          data = await generateVulnerabilities(requirement, capability, cog, context)
          break

        case 'generate-impact':
          if (!requirement || !capabilities || capabilities.length === 0) {
            toast({ title: t('common.error'), description: t('aiAssistant.errors.vulnerabilityAndCapabilitiesRequired'), variant: 'destructive' })
            return
          }
          data = await generateImpact(requirement, capabilities, requirements, cog, context)
          break
      }

      setResult(data)

      if (!data) {
        toast({
          title: t('aiAssistant.noResults.title'),
          description: t('aiAssistant.noResults.description'),
          variant: 'destructive'
        })
      }
    } catch (err) {
      console.error('AI generation error:', err)
    }
  }

  const handleOpen = () => {
    setOpen(true)
    if (!result) {
      handleGenerate()
    }
  }

  const handleAccept = (item?: any) => {
    const dataToAccept = item || result
    onAccept(dataToAccept)
    setOpen(false)
    toast({
      title: t('aiAssistant.acceptToast.title'),
      description: t('aiAssistant.acceptToast.description'),
    })
  }

  if (!enabled) {
    return null
  }

  const getModeTitle = (): string => {
    switch (mode) {
      case 'suggest-cog': return t('aiAssistant.modes.suggestCog.title')
      case 'validate-cog': return t('aiAssistant.modes.validateCog.title')
      case 'generate-capabilities': return t('aiAssistant.modes.generateCapabilities.title')
      case 'generate-requirements': return t('aiAssistant.modes.generateRequirements.title')
      case 'generate-vulnerabilities': return t('aiAssistant.modes.generateVulnerabilities.title')
      case 'generate-impact': return t('aiAssistant.modes.generateImpact.title')
      default: return t('aiAssistant.modes.default.title')
    }
  }

  const getModeDescription = (): string => {
    switch (mode) {
      case 'suggest-cog': return t('aiAssistant.modes.suggestCog.description')
      case 'validate-cog': return t('aiAssistant.modes.validateCog.description')
      case 'generate-capabilities': return t('aiAssistant.modes.generateCapabilities.description')
      case 'generate-requirements': return t('aiAssistant.modes.generateRequirements.description')
      case 'generate-vulnerabilities': return t('aiAssistant.modes.generateVulnerabilities.description')
      case 'generate-impact': return t('aiAssistant.modes.generateImpact.description')
      default: return t('aiAssistant.modes.default.description')
    }
  }

  const getDefaultButtonText = (): string => {
    switch (mode) {
      case 'suggest-cog': return t('aiAssistant.modes.suggestCog.button')
      case 'validate-cog': return t('aiAssistant.modes.validateCog.button')
      case 'generate-capabilities': return t('aiAssistant.modes.generateCapabilities.button')
      case 'generate-requirements': return t('aiAssistant.modes.generateRequirements.button')
      case 'generate-vulnerabilities': return t('aiAssistant.modes.generateVulnerabilities.button')
      case 'generate-impact': return t('aiAssistant.modes.generateImpact.button')
      default: return t('aiAssistant.modes.default.button')
    }
  }

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={handleOpen}
        disabled={!enabled}
      >
        <Sparkles className="h-4 w-4 mr-1" />
        {buttonText || getDefaultButtonText()}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {getModeTitle()}
            </DialogTitle>
            <DialogDescription>
              {getModeDescription()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Loading State */}
            {analyzing && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-sm text-muted-foreground">{t('aiAssistant.analyzing')}</p>
              </div>
            )}

            {/* Error State */}
            {error && !analyzing && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-900 dark:text-red-100">{t('aiAssistant.analysisFailed')}</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                      className="mt-3"
                    >
                      {t('aiAssistant.tryAgain')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            {result && !analyzing && (
              <div className="space-y-4">
                {/* COG Suggestions */}
                {mode === 'suggest-cog' && Array.isArray(result) && (
                  <div className="space-y-3">
                    {result.map((cog: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{cog.actor}</Badge>
                              <Badge variant="outline">{cog.domain}</Badge>
                            </div>
                            <h4 className="font-semibold text-lg">{cog.description}</h4>
                            <p className="text-sm text-muted-foreground">{cog.rationale}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAccept(cog)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {t('aiAssistant.useThis')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* COG Validation */}
                {mode === 'validate-cog' && result.criteria && (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg border-2 ${result.isValid ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700' : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {result.isValid ? (
                          <Check className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                        )}
                        <h4 className="font-semibold">
                          {result.isValid ? t('aiAssistant.validation.validCog') : t('aiAssistant.validation.needsRefinement')}
                        </h4>
                      </div>
                      <p className="text-sm">{result.overallAssessment}</p>
                    </div>

                    {/* Criteria */}
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">{t('aiAssistant.validation.criteria')}</h5>
                      {Object.entries(result.criteria).map(([key, criterion]: [string, any]) => (
                        <div key={key} className="flex items-start gap-2 text-sm">
                          {criterion.passes ? (
                            <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}: </span>
                            <span className="text-muted-foreground">{criterion.explanation}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Recommendations */}
                    {result.recommendations && result.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-semibold text-sm">{t('aiAssistant.validation.recommendations')}</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {result.recommendations.map((rec: string, idx: number) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={() => handleAccept()} disabled={!result.isValid}>
                        <Check className="h-4 w-4 mr-1" />
                        {t('aiAssistant.validation.acceptValidation')}
                      </Button>
                      <Button variant="outline" onClick={handleGenerate}>
                        {t('aiAssistant.validation.revalidate')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Capabilities/Requirements/Vulnerabilities Lists */}
                {(mode === 'generate-capabilities' || mode === 'generate-requirements' || mode === 'generate-vulnerabilities') && Array.isArray(result) && (
                  <div className="space-y-3">
                    {result.map((item: any, index: number) => {
                      const isExpanded = expandedItem === index
                      const mainField = item.capability || item.requirement || item.vulnerability

                      return (
                        <div key={index} className="border rounded-lg overflow-hidden">
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {item.type && <Badge variant="secondary" className="text-xs">{item.type}</Badge>}
                                  {item.confidence && <Badge variant="outline" className="text-xs">{item.confidence}</Badge>}
                                </div>
                                <h4 className="font-semibold">{mainField}</h4>
                                {item.description && !isExpanded && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                                )}
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setExpandedItem(isExpanded ? null : index)}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAccept(item)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-4 space-y-3 text-sm">
                                {item.description && (
                                  <div>
                                    <span className="font-medium">{t('aiAssistant.details.description')}: </span>
                                    <span className="text-muted-foreground">{item.description}</span>
                                  </div>
                                )}
                                {item.expectedEffect && (
                                  <div>
                                    <span className="font-medium">{t('aiAssistant.details.expectedEffect')}: </span>
                                    <span className="text-muted-foreground">{item.expectedEffect}</span>
                                  </div>
                                )}
                                {item.recommendedActions && (
                                  <div>
                                    <span className="font-medium">{t('aiAssistant.details.recommendedActions')}:</span>
                                    <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                      {item.recommendedActions.map((action: string, idx: number) => (
                                        <li key={idx}>{action}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {item.scoring && (
                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                                      <div className="text-xs text-muted-foreground">{t('scoring.impact')}</div>
                                      <div className="font-semibold">{item.scoring.impact_on_cog}/5</div>
                                    </div>
                                    <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
                                      <div className="text-xs text-muted-foreground">{t('scoring.attainability')}</div>
                                      <div className="font-semibold">{item.scoring.attainability}/5</div>
                                    </div>
                                    <div className="text-center p-2 bg-purple-50 dark:bg-purple-950 rounded">
                                      <div className="text-xs text-muted-foreground">{t('scoring.followUp')}</div>
                                      <div className="font-semibold">{item.scoring.follow_up_potential}/5</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    <div className="flex gap-2">
                      <Button onClick={() => handleAccept(result)}>
                        <Check className="h-4 w-4 mr-1" />
                        {t('aiAssistant.acceptAll', { count: result.length })}
                      </Button>
                      <Button variant="outline" onClick={handleGenerate}>
                        {t('aiAssistant.regenerate')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Impact Analysis */}
                {mode === 'generate-impact' && result.expectedEffect && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <h5 className="font-semibold text-sm mb-2">{t('aiAssistant.impact.expectedEffect')}:</h5>
                        <p className="text-sm">{result.expectedEffect}</p>
                      </div>

                      {result.cascadingEffects && (
                        <div>
                          <h5 className="font-semibold text-sm mb-2">{t('aiAssistant.impact.cascadingEffects')}:</h5>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {result.cascadingEffects.map((effect: string, idx: number) => (
                              <li key={idx}>{effect}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {result.recommendedActions && (
                        <div>
                          <h5 className="font-semibold text-sm mb-2">{t('aiAssistant.impact.recommendedActions')}:</h5>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {result.recommendedActions.map((action: string, idx: number) => (
                              <li key={idx}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                          <div className="text-xs text-muted-foreground">{t('aiAssistant.impact.confidence')}</div>
                          <div className="font-semibold capitalize">{result.confidence}</div>
                          {result.confidenceRationale && (
                            <div className="text-xs text-muted-foreground mt-1">{result.confidenceRationale}</div>
                          )}
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                          <div className="text-xs text-muted-foreground">{t('aiAssistant.impact.timeToEffect')}</div>
                          <div className="font-semibold capitalize">{result.timeToEffect}</div>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                          <div className="text-xs text-muted-foreground">{t('aiAssistant.impact.reversibility')}</div>
                          <div className="font-semibold capitalize">{result.reversibility}</div>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                          <div className="text-xs text-muted-foreground">{t('aiAssistant.impact.riskToFriendlyForces')}</div>
                          <div className="font-semibold capitalize">{result.riskToFriendlyForces}</div>
                        </div>
                      </div>

                      {result.considerations && (
                        <div>
                          <h5 className="font-semibold text-sm mb-2">{t('aiAssistant.impact.considerations')}:</h5>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {result.considerations.map((consideration: string, idx: number) => (
                              <li key={idx}>{consideration}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => handleAccept()}>
                        <Check className="h-4 w-4 mr-1" />
                        {t('aiAssistant.impact.acceptAnalysis')}
                      </Button>
                      <Button variant="outline" onClick={handleGenerate}>
                        {t('aiAssistant.regenerate')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
