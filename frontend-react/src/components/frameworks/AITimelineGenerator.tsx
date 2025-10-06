import { useState } from 'react'
import { Sparkles, Loader2, Plus, AlertCircle, RotateCcw, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { TimelineEvent, BehaviorAnalysis } from '@/types/behavior'

interface AITimelineGeneratorProps {
  formData: Partial<BehaviorAnalysis>
  existingTimeline?: TimelineEvent[]
  onTimelineGenerated: (timeline: TimelineEvent[]) => void
}

export function AITimelineGenerator({
  formData,
  existingTimeline = [],
  onTimelineGenerated
}: AITimelineGeneratorProps) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedTimeline, setGeneratedTimeline] = useState<TimelineEvent[] | null>(null)

  // Only require title - AI can work with partial location context
  const missingContext = !formData.title

  const generateTimeline = async () => {
    setGenerating(true)
    setError(null)
    setGeneratedTimeline(null)

    try {
      // Prepare request payload
      const requestPayload = {
        behavior_title: formData.title || '',
        behavior_description: formData.description || '',
        location_context: formData.location_context,
        behavior_settings: formData.behavior_settings,
        temporal_context: formData.temporal_context,
        complexity: formData.complexity,
        existing_timeline: existingTimeline.length > 0 ? existingTimeline : undefined
      }

      // Call backend API endpoint
      const response = await fetch('/api/ai/generate-timeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'AI request failed')
      }

      const data = await response.json()
      const timeline: TimelineEvent[] = data.events || []

      setGeneratedTimeline(timeline)

    } catch (err) {
      console.error('Timeline generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate timeline')
    } finally {
      setGenerating(false)
    }
  }

  const acceptTimeline = () => {
    if (generatedTimeline) {
      onTimelineGenerated(generatedTimeline)
      setOpen(false)
      setGeneratedTimeline(null)
    }
  }

  const mergeWithExisting = () => {
    if (generatedTimeline) {
      // Merge: keep existing events, append new ones
      const merged = [...existingTimeline, ...generatedTimeline]
      onTimelineGenerated(merged)
      setOpen(false)
      setGeneratedTimeline(null)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={missingContext}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        AI Generate Timeline
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Timeline Generator
            </DialogTitle>
            <DialogDescription>
              Generate a detailed, step-by-step timeline with sub-steps and decision forks
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {missingContext && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please fill in the behavior title before generating a timeline.
                </AlertDescription>
              </Alert>
            )}

            {existingTimeline.length > 0 && (
              <Alert>
                <AlertDescription>
                  You have {existingTimeline.length} existing timeline events. The AI will enhance your existing timeline or create a new one.
                </AlertDescription>
              </Alert>
            )}

            {!generating && !generatedTimeline && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The AI will analyze your behavior description, location context, settings, and other details to create:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1 ml-2">
                  <li>Chronological sequence of steps</li>
                  <li>Time estimates for each step</li>
                  <li>Sub-steps for complex actions</li>
                  <li>Decision points and alternative paths (forks)</li>
                  <li>Location changes during the behavior</li>
                </ul>

                <Button
                  onClick={generateTimeline}
                  disabled={missingContext || generating}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Timeline
                </Button>
              </div>
            )}

            {generating && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Analyzing behavior and generating detailed timeline...
                </p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {generatedTimeline && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                  <h4 className="font-medium mb-3">Generated Timeline ({generatedTimeline.length} events)</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {generatedTimeline.map((event, index) => (
                      <div key={event.id} className="border-l-4 border-blue-500 pl-3 py-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{index + 1}. {event.label}</span>
                              {event.time && (
                                <Badge variant="outline" className="text-xs">{event.time}</Badge>
                              )}
                              {event.is_decision_point && (
                                <Badge variant="secondary" className="text-xs">Decision Point</Badge>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.description}</p>
                            )}
                            {event.location && (
                              <p className="text-xs text-gray-500 mt-1">📍 {event.location}</p>
                            )}
                            {event.sub_steps && event.sub_steps.length > 0 && (
                              <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-4 space-y-1">
                                {event.sub_steps.map((sub, subIdx) => (
                                  <li key={subIdx} className="list-disc">
                                    <strong>{sub.label}</strong>
                                    {sub.description && `: ${sub.description}`}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {event.forks && event.forks.length > 0 && (
                              <div className="mt-2 ml-4 text-sm">
                                {event.forks.map((fork, forkIdx) => (
                                  <div key={forkIdx} className="text-orange-600 dark:text-orange-400">
                                    ↳ <strong>{fork.condition}:</strong> {fork.label}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-between">
                  <Button
                    onClick={() => setGeneratedTimeline(null)}
                    variant="outline"
                    size="default"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>

                  <div className="flex gap-2">
                    {existingTimeline.length > 0 && (
                      <Button onClick={mergeWithExisting} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Merge with Existing
                      </Button>
                    )}
                    <Button
                      onClick={acceptTimeline}
                      variant="default"
                      size="default"
                      className="min-w-[180px]"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Use This Timeline
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
