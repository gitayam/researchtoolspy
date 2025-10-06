import { useState } from 'react'
import { Sparkles, Loader2, Check, AlertCircle, X, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CriticalCapability, CriticalRequirement, CriticalVulnerability, OperationalContext } from '@/types/cog-analysis'

type AssistMode = 'cog' | 'capabilities' | 'requirements' | 'vulnerabilities'

interface AICOGAssistantProps {
  mode: AssistMode
  operationalContext: OperationalContext
  cogDescription?: string
  cogRationale?: string
  existingCapabilities?: CriticalCapability[]
  existingRequirements?: CriticalRequirement[]
  onAcceptCOGs?: (cogs: Array<{ description: string; rationale: string; validation: string }>) => void
  onAcceptCapabilities?: (capabilities: Array<{ description: string; how_it_works: string; support_to_objectives: string }>) => void
  onAcceptRequirements?: (requirements: Array<{ description: string; type: string; justification: string }>) => void
  onAcceptVulnerabilities?: (vulnerabilities: Array<{
    vulnerability: string
    type: string
    description: string
    exploitation_method: string
    expected_effect: string
    recommended_actions: string
  }>) => void
}

export function AICOGAssistant({
  mode,
  operationalContext,
  cogDescription,
  cogRationale,
  existingCapabilities,
  existingRequirements,
  onAcceptCOGs,
  onAcceptCapabilities,
  onAcceptRequirements,
  onAcceptVulnerabilities
}: AICOGAssistantProps) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<any>(null)

  // Check if required context is present
  const hasRequiredContext = () => {
    if (mode === 'cog') {
      return !!(operationalContext?.objective && operationalContext?.desired_impact)
    }
    if (mode === 'capabilities') {
      return !!(cogDescription && operationalContext?.objective)
    }
    if (mode === 'requirements') {
      return !!(existingCapabilities && existingCapabilities.length > 0)
    }
    if (mode === 'vulnerabilities') {
      return !!(existingRequirements && existingRequirements.length > 0)
    }
    return false
  }

  const getButtonLabel = () => {
    switch (mode) {
      case 'cog': return 'AI: Suggest COGs'
      case 'capabilities': return 'AI: Generate Capabilities'
      case 'requirements': return 'AI: Extract Requirements'
      case 'vulnerabilities': return 'AI: Identify Vulnerabilities'
    }
  }

  const getDialogTitle = () => {
    switch (mode) {
      case 'cog': return 'AI COG Identification Assistant'
      case 'capabilities': return 'AI Capability Generator'
      case 'requirements': return 'AI Requirements Extractor'
      case 'vulnerabilities': return 'AI Vulnerability Assessment'
    }
  }

  const getDialogDescription = () => {
    switch (mode) {
      case 'cog': return 'AI will analyze your operational context and suggest potential Centers of Gravity'
      case 'capabilities': return 'AI will generate critical capabilities based on your COG description'
      case 'requirements': return 'AI will identify critical requirements from your capabilities'
      case 'vulnerabilities': return 'AI will assess vulnerabilities in your requirements and suggest exploitation methods'
    }
  }

  const generateSuggestions = async () => {
    setGenerating(true)
    setError(null)
    setSuggestions(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      const requestPayload = {
        mode,
        operational_context: operationalContext,
        cog_description: cogDescription,
        cog_rationale: cogRationale,
        existing_capabilities: existingCapabilities,
        existing_requirements: existingRequirements
      }

      const response = await fetch('/api/ai/cog-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const data = await response.json()
      setSuggestions(data)

    } catch (err) {
      console.error('AI generation error:', err)

      let errorMessage = 'Failed to generate suggestions'
      if (err instanceof TypeError && err.message.includes('aborted')) {
        errorMessage = 'Request timed out. The AI took too long to respond. Please try again with less context or a simpler request.'
      } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to the AI service. Please check your connection and try again.'
      } else if (err instanceof Error) {
        errorMessage = err.message
      }

      setError(errorMessage)
    } finally {
      setGenerating(false)
    }
  }

  const handleAccept = () => {
    if (!suggestions) return

    switch (mode) {
      case 'cog':
        if (onAcceptCOGs && suggestions.cogs) {
          onAcceptCOGs(suggestions.cogs)
        }
        break
      case 'capabilities':
        if (onAcceptCapabilities && suggestions.capabilities) {
          onAcceptCapabilities(suggestions.capabilities)
        }
        break
      case 'requirements':
        if (onAcceptRequirements && suggestions.requirements) {
          onAcceptRequirements(suggestions.requirements)
        }
        break
      case 'vulnerabilities':
        if (onAcceptVulnerabilities && suggestions.vulnerabilities) {
          onAcceptVulnerabilities(suggestions.vulnerabilities)
        }
        break
    }

    setOpen(false)
    setSuggestions(null)
  }

  const renderCOGSuggestions = () => {
    if (!suggestions?.cogs) return null

    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          AI identified {suggestions.cogs.length} potential Centers of Gravity:
        </p>
        {suggestions.cogs.map((cog: any, idx: number) => (
          <div key={idx} className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-start gap-2 mb-2">
              <Badge variant="default">COG {idx + 1}</Badge>
              {cog.confidence && (
                <Badge variant="outline" className="text-xs">
                  Confidence: {cog.confidence}
                </Badge>
              )}
            </div>
            <h4 className="font-semibold mb-2">{cog.description}</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Rationale:</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{cog.rationale}</p>
              </div>
              <div>
                <span className="font-medium">JP 3-0 Validation:</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{cog.validation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderCapabilitySuggestions = () => {
    if (!suggestions?.capabilities) return null

    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          AI generated {suggestions.capabilities.length} critical capabilities:
        </p>
        {suggestions.capabilities.map((cap: any, idx: number) => (
          <div key={idx} className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start gap-2 mb-2">
              <Badge variant="default">Capability {idx + 1}</Badge>
            </div>
            <h4 className="font-semibold mb-2">⚡ {cap.description}</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">How it works:</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{cap.how_it_works}</p>
              </div>
              <div>
                <span className="font-medium">Support to objectives:</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{cap.support_to_objectives}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderRequirementSuggestions = () => {
    if (!suggestions?.requirements) return null

    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          AI identified {suggestions.requirements.length} critical requirements:
        </p>
        {suggestions.requirements.map((req: any, idx: number) => (
          <div key={idx} className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-start gap-2 mb-2">
              <Badge variant="default">Requirement {idx + 1}</Badge>
              <Badge variant="outline">{req.type}</Badge>
            </div>
            <h4 className="font-semibold mb-2">📋 {req.description}</h4>
            <div className="text-sm">
              <span className="font-medium">Justification:</span>
              <p className="text-gray-700 dark:text-gray-300 mt-1">{req.justification}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderVulnerabilitySuggestions = () => {
    if (!suggestions?.vulnerabilities) return null

    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          AI identified {suggestions.vulnerabilities.length} critical vulnerabilities:
        </p>
        {suggestions.vulnerabilities.map((vuln: any, idx: number) => (
          <div key={idx} className="border rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-start gap-2 mb-2">
              <Badge variant="default">Vulnerability {idx + 1}</Badge>
              <Badge variant="outline">{vuln.type}</Badge>
              {vuln.scoring && (
                <Badge variant="secondary">Score: {vuln.scoring.impact_on_cog + vuln.scoring.attainability + vuln.scoring.follow_up_potential}</Badge>
              )}
            </div>
            <h4 className="font-semibold mb-2">⚠️ {vuln.vulnerability}</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Description:</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{vuln.description}</p>
              </div>
              <div>
                <span className="font-medium">Exploitation method:</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{vuln.exploitation_method}</p>
              </div>
              <div>
                <span className="font-medium">Expected effect:</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{vuln.expected_effect}</p>
              </div>
              <div>
                <span className="font-medium">Recommended actions:</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{vuln.recommended_actions}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!hasRequiredContext()}
        className="gap-2"
        title={!hasRequiredContext() ? 'Fill in required context first' : 'Use AI to generate suggestions'}
      >
        <Sparkles className="h-4 w-4" />
        {getButtonLabel()}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {getDialogTitle()}
            </DialogTitle>
            <DialogDescription>
              {getDialogDescription()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!hasRequiredContext() && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {mode === 'cog' && 'Please fill in operational context (objective and desired impact) before using AI assistance.'}
                  {mode === 'capabilities' && 'Please fill in COG description and operational objectives before generating capabilities.'}
                  {mode === 'requirements' && 'Please add at least one capability before extracting requirements.'}
                  {mode === 'vulnerabilities' && 'Please add at least one requirement before identifying vulnerabilities.'}
                </AlertDescription>
              </Alert>
            )}

            {!generating && !suggestions && (
              <div className="space-y-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">How this works:</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1 ml-2">
                    {mode === 'cog' && (
                      <>
                        <li>AI analyzes your operational context and objectives</li>
                        <li>Identifies potential Centers of Gravity using JP 3-0 criteria</li>
                        <li>Provides rationale and validation for each suggestion</li>
                        <li>You can accept, reject, or edit any suggestion</li>
                      </>
                    )}
                    {mode === 'capabilities' && (
                      <>
                        <li>AI analyzes your COG description and context</li>
                        <li>Generates verb-focused critical capabilities</li>
                        <li>Explains how each capability works and supports objectives</li>
                        <li>You can accept, reject, or edit any capability</li>
                      </>
                    )}
                    {mode === 'requirements' && (
                      <>
                        <li>AI analyzes your critical capabilities</li>
                        <li>Identifies essential requirements (resources, infrastructure, etc.)</li>
                        <li>Classifies by type and provides justification</li>
                        <li>Highlights potential single points of failure</li>
                      </>
                    )}
                    {mode === 'vulnerabilities' && (
                      <>
                        <li>AI analyzes your critical requirements</li>
                        <li>Identifies exploitable vulnerabilities</li>
                        <li>Suggests exploitation methods and expected effects</li>
                        <li>Provides recommended actions and initial scoring</li>
                      </>
                    )}
                  </ul>
                </div>

                <Button
                  onClick={generateSuggestions}
                  disabled={!hasRequiredContext() || generating}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Suggestions
                </Button>
              </div>
            )}

            {generating && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI is analyzing your data and generating suggestions...
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  This may take up to 15 seconds
                </p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {suggestions && (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                {mode === 'cog' && renderCOGSuggestions()}
                {mode === 'capabilities' && renderCapabilitySuggestions()}
                {mode === 'requirements' && renderRequirementSuggestions()}
                {mode === 'vulnerabilities' && renderVulnerabilitySuggestions()}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {suggestions && (
                <span>
                  {mode === 'cog' && `${suggestions.cogs?.length || 0} COGs suggested`}
                  {mode === 'capabilities' && `${suggestions.capabilities?.length || 0} capabilities generated`}
                  {mode === 'requirements' && `${suggestions.requirements?.length || 0} requirements identified`}
                  {mode === 'vulnerabilities' && `${suggestions.vulnerabilities?.length || 0} vulnerabilities found`}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {suggestions && (
                <Button
                  variant="outline"
                  onClick={() => setSuggestions(null)}
                >
                  Regenerate
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              {suggestions && (
                <Button
                  onClick={handleAccept}
                  variant="default"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Accept All
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
