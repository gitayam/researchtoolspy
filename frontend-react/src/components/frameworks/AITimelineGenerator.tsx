import { useState } from 'react'
import { Sparkles, Loader2, Plus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { TimelineEvent, BehaviorAnalysis } from '@/types/behavior'
import { getBehaviorFormContext } from '@/utils/ai-context'

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

  const missingContext = !formData.title || !formData.location_context?.specific_locations?.length

  const generateTimeline = async () => {
    setGenerating(true)
    setError(null)
    setGeneratedTimeline(null)

    try {
      const context = getBehaviorFormContext(formData)

      const prompt = `You are a behavior analysis expert creating a detailed timeline of how a behavior unfolds.

${context}

TASK: Create a comprehensive, step-by-step timeline for this behavior.

REQUIREMENTS:
1. Main sequence: List all major steps in chronological order
2. Time estimates: Provide realistic time for each step (HH:MM or relative)
3. Locations: Note where each step occurs if it changes
4. Sub-steps: Break down complex steps into sub-steps
5. Decision points: Mark steps where choices are made
6. Forks: For decision points, provide alternative paths people might take
7. Be specific to the location(s) and context provided

${existingTimeline.length > 0 ? `EXISTING TIMELINE TO ENHANCE:\n${JSON.stringify(existingTimeline, null, 2)}\n\nEnhance this timeline with more detail, sub-steps, and forks.` : 'Create a new detailed timeline from scratch.'}

OUTPUT FORMAT (strict JSON):
{
  "events": [
    {
      "id": "unique-id",
      "label": "Step name (concise)",
      "time": "HH:MM or T+Xmin or relative",
      "description": "What happens in this step",
      "location": "Where this occurs (if changes)",
      "is_decision_point": false,
      "sub_steps": [
        {
          "label": "Sub-step name",
          "description": "Sub-step detail",
          "duration": "optional time"
        }
      ],
      "forks": [
        {
          "condition": "If X happens / Alternative path",
          "label": "Fork name",
          "path": [
            {
              "id": "fork-step-id",
              "label": "Alternative step",
              "time": "timing",
              "description": "what happens"
            }
          ]
        }
      ]
    }
  ]
}

Generate the timeline now:`

      const apiKey = localStorage.getItem('openai_api_key') || localStorage.getItem('anthropic_api_key')
      const provider = localStorage.getItem('ai_provider') || 'openai'

      if (!apiKey) {
        throw new Error('No API key configured. Please configure AI settings.')
      }

      let response
      if (provider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: localStorage.getItem('openai_model') || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a behavior analysis expert. Always respond with valid JSON only.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
          })
        })
      } else {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: localStorage.getItem('anthropic_model') || 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            messages: [
              { role: 'user', content: prompt }
            ]
          })
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'AI request failed')
      }

      const data = await response.json()

      let content
      if (provider === 'openai') {
        content = data.choices[0].message.content
      } else {
        content = data.content[0].text
      }

      // Parse JSON response
      const parsed = JSON.parse(content)
      const timeline: TimelineEvent[] = parsed.events || []

      // Generate IDs if missing
      timeline.forEach((event, index) => {
        if (!event.id) {
          event.id = `event-${Date.now()}-${index}`
        }
      })

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
                  Please fill in the behavior title and add at least one specific location before generating a timeline.
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

                <div className="flex gap-2">
                  <Button onClick={acceptTimeline} className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Use This Timeline
                  </Button>
                  {existingTimeline.length > 0 && (
                    <Button onClick={mergeWithExisting} variant="outline" className="flex-1">
                      Merge with Existing
                    </Button>
                  )}
                  <Button onClick={() => setGeneratedTimeline(null)} variant="outline">
                    Regenerate
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
