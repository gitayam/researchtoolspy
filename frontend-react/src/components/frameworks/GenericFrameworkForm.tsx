import { useState, memo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X, Link2, Sparkles, Loader2, Edit2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { AIFieldAssistant, AIUrlScraper } from '@/components/ai'
import { EvidenceLinker, EvidenceItemBadge, type LinkedEvidence } from '@/components/evidence'
import { ExportButton } from '@/components/reports/ExportButton'
import { BehaviorTimeline, type TimelineEvent } from '@/components/frameworks/BehaviorTimeline'
import { BCWRecommendations } from '@/components/frameworks/BCWRecommendations'
import { BehaviorSelector } from '@/components/frameworks/BehaviorSelector'
import { BehaviorBasicInfoForm } from '@/components/frameworks/BehaviorBasicInfoForm'
import { AITimelineGenerator } from '@/components/frameworks/AITimelineGenerator'
import { ConsequencesManager } from '@/components/frameworks/ConsequencesManager'
import { SymbolsManager } from '@/components/frameworks/SymbolsManager'
import type { LocationContext, BehaviorSettings, TemporalContext, EligibilityRequirements, BehaviorComplexity, ConsequenceItem, SymbolItem } from '@/types/behavior'
import type { FrameworkItem, QuestionAnswerItem, TextFrameworkItem } from '@/types/frameworks'
import { isQuestionAnswerItem, normalizeItem } from '@/types/frameworks'
import { frameworkConfigs } from '@/config/framework-configs'
import type { ComBComponent, ComBDeficits, DeficitLevel, InterventionFunction } from '@/types/behavior-change-wheel'

interface FrameworkSection {
  key: string
  label: string
  description: string
  color: string
  icon: string
  hasDeficitAssessment?: boolean
  comBComponent?: ComBComponent
  promptQuestions?: string[]
}

interface GenericFrameworkData {
  title: string
  description: string
  [key: string]: any
}

interface GenericFrameworkFormProps {
  initialData?: GenericFrameworkData
  mode: 'create' | 'edit'
  sections: FrameworkSection[]
  frameworkType: string
  frameworkTitle: string
  onSave: (data: GenericFrameworkData) => Promise<void>
  backPath: string
  frameworkId?: string
}

const SectionCard = memo(({
  section,
  items,
  newItem,
  newAnswer,
  setNewItem,
  setNewAnswer,
  onAdd,
  onRemove,
  onEdit,
  linkedEvidence,
  onLinkEvidence,
  onRemoveEvidence,
  frameworkType,
  allData,
  itemType,
  deficitLevel,
  onDeficitChange
}: {
  section: FrameworkSection
  items: FrameworkItem[]
  newItem: string
  newAnswer?: string
  setNewItem: (value: string) => void
  setNewAnswer?: (value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onEdit: (id: string, updates: Partial<FrameworkItem>) => void
  linkedEvidence: LinkedEvidence[]
  onLinkEvidence: () => void
  onRemoveEvidence: (evidence: LinkedEvidence) => void
  frameworkType: string
  allData?: GenericFrameworkData
  itemType?: 'text' | 'qa'
  deficitLevel?: DeficitLevel
  onDeficitChange?: (level: DeficitLevel) => void
}) => {
  const isQA = itemType === 'qa'
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editText, setEditText] = useState('')

  const startEditing = (item: FrameworkItem) => {
    setEditingId(item.id)
    if (isQuestionAnswerItem(item)) {
      setEditQuestion(item.question)
      setEditAnswer(item.answer || '')
    } else if ('text' in item) {
      setEditText(item.text)
    }
  }

  const saveEdit = () => {
    if (!editingId) return

    if (isQA) {
      onEdit(editingId, { question: editQuestion, answer: editAnswer })
    } else {
      onEdit(editingId, { text: editText })
    }

    setEditingId(null)
    setEditQuestion('')
    setEditAnswer('')
    setEditText('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQuestion('')
    setEditAnswer('')
    setEditText('')
  }

  return (
    <Card className={`border-l-4 ${section.color}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{section.icon}</span>
          {section.label}
        </CardTitle>
        <CardDescription>{section.description}</CardDescription>

        {/* Guided Questions */}
        {section.promptQuestions && section.promptQuestions.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Questions to consider:</p>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
              {section.promptQuestions.map((question, idx) => (
                <li key={idx}>{question}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Deficit Assessment for COM-B sections */}
        {section.hasDeficitAssessment && onDeficitChange && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <Label className="text-sm font-medium mb-2 block">Deficit Assessment</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={deficitLevel === 'adequate' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onDeficitChange('adequate')}
                className={deficitLevel === 'adequate' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                ✓ Adequate
              </Button>
              <Button
                type="button"
                variant={deficitLevel === 'deficit' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onDeficitChange('deficit')}
                className={deficitLevel === 'deficit' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                ⚠ Deficit
              </Button>
              <Button
                type="button"
                variant={deficitLevel === 'major_barrier' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onDeficitChange('major_barrier')}
                className={deficitLevel === 'major_barrier' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                ✖ Major Barrier
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder={isQA ? `Add question...` : `Add ${section.label.toLowerCase()}...`}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => !isQA && e.key === 'Enter' && onAdd()}
            />
            {!isQA && (
              <>
                <AIFieldAssistant
                  fieldName={section.label}
                  currentValue={newItem}
                  onAccept={(value) => setNewItem(value)}
                  context={{
                    framework: frameworkType,
                    relatedFields: allData
                  }}
                  placeholder={`Add ${section.label.toLowerCase()}...`}
                />
                <Button onClick={onAdd} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          {isQA && (
            <>
              <Textarea
                placeholder="Add answer (leave blank if unknown)..."
                value={newAnswer || ''}
                onChange={(e) => setNewAnswer?.(e.target.value)}
                rows={2}
              />
              <Button onClick={onAdd} size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Question & Answer
              </Button>
            </>
          )}
        </div>
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No items added yet
            </p>
          ) : (
            items.map((item) => {
              // Check if this item needs an answer (from URL scraper unanswered questions)
              const needsAnswer = isQA && isQuestionAnswerItem(item) && (item.needsAnswer || !item.answer?.trim())
              const isEditing = editingId === item.id

              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-2 p-3 rounded-lg ${
                    needsAnswer
                      ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  {isEditing ? (
                    // EDITING MODE
                    <div className="flex-1 space-y-2">
                      {isQA && isQuestionAnswerItem(item) ? (
                        <>
                          <Textarea
                            placeholder="Question..."
                            value={editQuestion}
                            onChange={(e) => setEditQuestion(e.target.value)}
                            rows={2}
                            className="text-sm resize-y"
                          />
                          <Textarea
                            placeholder="Answer..."
                            value={editAnswer}
                            onChange={(e) => setEditAnswer(e.target.value)}
                            rows={3}
                            className="text-sm resize-y"
                          />
                        </>
                      ) : (
                        <Textarea
                          placeholder="Text..."
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          className="text-sm resize-y"
                        />
                      )}
                    </div>
                  ) : (
                    // VIEW MODE
                    <>
                      {isQA && isQuestionAnswerItem(item) ? (
                        <div className="flex-1 space-y-1">
                          <div className="text-sm font-medium flex items-start gap-2">
                            {needsAnswer && <span className="text-red-600 dark:text-red-400 flex-shrink-0">❗</span>}
                            <span className="break-words">Q: {item.question}</span>
                          </div>
                          <div className={`text-sm break-words ${needsAnswer ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400'}`}>
                            A: {item.answer || <span className="italic font-semibold">Needs answer - please fill in</span>}
                          </div>
                        </div>
                      ) : (
                        <span className="flex-1 text-sm break-words">
                          {'text' in item ? item.text : (item as any).question || ''}
                        </span>
                      )}
                    </>
                  )}

                  {/* EDIT/SAVE/DELETE BUTTONS */}
                  <div className="flex gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={saveEdit}
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEdit}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(item)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemove(item.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

      {/* Evidence Section */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Linked Evidence ({linkedEvidence.length})</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={onLinkEvidence}
          >
            <Link2 className="h-3 w-3 mr-2" />
            Link Evidence
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {linkedEvidence.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              No evidence linked to this section
            </p>
          ) : (
            linkedEvidence.map((evidence) => (
              <EvidenceItemBadge
                key={`${evidence.entity_type}-${evidence.entity_id}`}
                evidence={evidence}
                onRemove={() => onRemoveEvidence(evidence)}
                showDetails={true}
              />
            ))
          )}
        </div>
      </div>

      <Badge variant="secondary">{items.length} items</Badge>
    </CardContent>
  </Card>
  )
})

export function GenericFrameworkForm({
  initialData,
  mode,
  sections,
  frameworkType,
  frameworkTitle,
  onSave,
  backPath,
  frameworkId
}: GenericFrameworkFormProps) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [sourceUrl, setSourceUrl] = useState<string>((initialData as any)?.source_url || '')

  // For COM-B Analysis: linked behavior
  const [linkedBehaviorId, setLinkedBehaviorId] = useState<string | undefined>((initialData as any)?.linked_behavior_id)
  const [linkedBehaviorTitle, setLinkedBehaviorTitle] = useState<string | undefined>((initialData as any)?.linked_behavior_title)

  // For Behavior Analysis: enhanced context fields
  const [locationContext, setLocationContext] = useState<LocationContext>((initialData as any)?.location_context || {
    geographic_scope: 'local',
    specific_locations: []
  })
  const [behaviorSettings, setBehaviorSettings] = useState<BehaviorSettings>((initialData as any)?.behavior_settings || {
    settings: []
  })
  const [temporalContext, setTemporalContext] = useState<TemporalContext>((initialData as any)?.temporal_context || {})
  const [eligibility, setEligibility] = useState<EligibilityRequirements>((initialData as any)?.eligibility || {
    has_requirements: false
  })
  const [complexity, setComplexity] = useState<BehaviorComplexity>((initialData as any)?.complexity || 'simple_sequence')

  // Initialize state for each section
  const [sectionData, setSectionData] = useState<{ [key: string]: FrameworkItem[] }>(
    sections.reduce((acc, section) => {
      acc[section.key] = initialData?.[section.key] || []
      return acc
    }, {} as { [key: string]: FrameworkItem[] })
  )

  const [newItems, setNewItems] = useState<{ [key: string]: string }>(
    sections.reduce((acc, section) => {
      acc[section.key] = ''
      return acc
    }, {} as { [key: string]: string })
  )

  // For Q&A frameworks, track answers separately
  const [newAnswers, setNewAnswers] = useState<{ [key: string]: string }>(
    sections.reduce((acc, section) => {
      acc[section.key] = ''
      return acc
    }, {} as { [key: string]: string })
  )

  // Evidence linking state
  const [sectionEvidence, setSectionEvidence] = useState<{ [key: string]: LinkedEvidence[] }>(
    sections.reduce((acc, section) => {
      acc[section.key] = []
      return acc
    }, {} as { [key: string]: LinkedEvidence[] })
  )
  const [evidenceLinkerOpen, setEvidenceLinkerOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // AI title generation state
  const [generatingTitle, setGeneratingTitle] = useState(false)

  // AI follow-up questions generation state
  const [generatingQuestions, setGeneratingQuestions] = useState(false)

  // BCW (Behaviour Change Wheel) state for behavior framework
  const [comBDeficits, setComBDeficits] = useState<ComBDeficits>({
    physical_capability: (initialData as any)?.com_b_deficits?.physical_capability || 'adequate',
    psychological_capability: (initialData as any)?.com_b_deficits?.psychological_capability || 'adequate',
    physical_opportunity: (initialData as any)?.com_b_deficits?.physical_opportunity || 'adequate',
    social_opportunity: (initialData as any)?.com_b_deficits?.social_opportunity || 'adequate',
    reflective_motivation: (initialData as any)?.com_b_deficits?.reflective_motivation || 'adequate',
    automatic_motivation: (initialData as any)?.com_b_deficits?.automatic_motivation || 'adequate',
  })

  const [selectedInterventions, setSelectedInterventions] = useState<InterventionFunction[]>(
    (initialData as any)?.selected_interventions || []
  )

  // Get item type from config
  const itemType = frameworkConfigs[frameworkType]?.itemType || 'text'

  // Load linked evidence if editing
  useEffect(() => {
    if (frameworkId && mode === 'edit') {
      loadLinkedEvidence()
    }
  }, [frameworkId, mode])

  // Auto-save draft to localStorage every 30 seconds
  // Only auto-save in create mode to avoid overwriting existing analyses
  useEffect(() => {
    if (mode !== 'create') return // Don't auto-save in edit mode

    const draftKey = `draft_${frameworkType}_new`

    const interval = setInterval(() => {
      // Only save if there's actual content
      const hasContent = title.trim() || description.trim() ||
        Object.values(sectionData).some(items => items.length > 0)

      if (!hasContent) return

      const draftData = {
        title,
        description,
        sectionData,
        timestamp: new Date().toISOString()
      }
      try {
        localStorage.setItem(draftKey, JSON.stringify(draftData))
        // Removed console.log to reduce noise
      } catch (error) {
        console.error('Failed to auto-save draft:', error)
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [title, description, sectionData, frameworkType, mode])

  // Restore draft on mount if available
  // Using a ref to ensure this only runs once
  const draftRestored = useRef(false)

  useEffect(() => {
    if (mode === 'create' && !initialData && !draftRestored.current) {
      const draftKey = `draft_${frameworkType}_new`
      const savedDraft = localStorage.getItem(draftKey)

      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft)
          const draftAge = Date.now() - new Date(draft.timestamp).getTime()

          // Only restore if draft is less than 24 hours old
          if (draftAge < 24 * 60 * 60 * 1000) {
            // Check if draft has actual content before prompting
            const hasContent = (draft.title?.trim() || '') ||
                              (draft.description?.trim() || '') ||
                              Object.values(draft.sectionData || {}).some((items: any) => items.length > 0)

            if (hasContent) {
              const draftDate = new Date(draft.timestamp).toLocaleString()
              const message = `You have an unsaved draft from ${draftDate}.\n\nWould you like to restore it and continue where you left off?\n\nClick OK to restore, or Cancel to start fresh.`
              if (confirm(message)) {
                setTitle(draft.title || '')
                setDescription(draft.description || '')
                setSectionData(draft.sectionData || {})
              } else {
                // User declined, clean up the draft
                localStorage.removeItem(draftKey)
              }
            } else {
              // Empty draft, just remove it
              localStorage.removeItem(draftKey)
            }
          } else {
            // Clean up old drafts
            localStorage.removeItem(draftKey)
          }
        } catch (error) {
          console.error('Failed to restore draft:', error)
          // Clean up corrupted draft
          localStorage.removeItem(draftKey)
        }
      }
      draftRestored.current = true
    }
  }, [mode, frameworkType, initialData])

  const loadLinkedEvidence = async () => {
    if (!frameworkId) return
    try {
      const response = await fetch(`/api/framework-evidence?framework_id=${frameworkId}&framework_type=${frameworkType}`)
      if (response.ok) {
        const data = await response.json()
        // Group evidence by section using framework_item_id
        const grouped: { [key: string]: LinkedEvidence[] } = {}
        sections.forEach(section => {
          grouped[section.key] = []
        })
        data.evidence.forEach((link: LinkedEvidence) => {
          if (link.framework_item_id && grouped[link.framework_item_id]) {
            grouped[link.framework_item_id].push(link)
          }
        })
        setSectionEvidence(grouped)
      }
    } catch (error) {
      console.error('Failed to load linked evidence:', error)
    }
  }

  const addItem = (sectionKey: string, text: string) => {
    if (!text.trim()) return

    let newItem: FrameworkItem

    if (itemType === 'qa') {
      // Q&A item - use question and answer
      newItem = {
        id: crypto.randomUUID(),
        question: text.trim(),
        answer: (newAnswers[sectionKey] || '').trim()
      } as QuestionAnswerItem
    } else {
      // Text item
      newItem = {
        id: crypto.randomUUID(),
        text: text.trim()
      } as TextFrameworkItem
    }

    setSectionData(prev => ({
      ...prev,
      [sectionKey]: [...prev[sectionKey], newItem]
    }))

    setNewItems(prev => ({
      ...prev,
      [sectionKey]: ''
    }))

    if (itemType === 'qa') {
      setNewAnswers(prev => ({
        ...prev,
        [sectionKey]: ''
      }))
    }
  }

  const removeItem = (sectionKey: string, id: string) => {
    setSectionData(prev => ({
      ...prev,
      [sectionKey]: prev[sectionKey].filter(item => item.id !== id)
    }))
  }

  const editItem = (sectionKey: string, id: string, updates: Partial<FrameworkItem>) => {
    setSectionData(prev => ({
      ...prev,
      [sectionKey]: prev[sectionKey].map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    }))
  }

  const openEvidenceLinker = (sectionKey: string) => {
    setActiveSection(sectionKey)
    setEvidenceLinkerOpen(true)
  }

  const handleEvidenceLink = async (selected: LinkedEvidence[]) => {
    if (!activeSection) return

    if (!frameworkId) {
      // For new frameworks, just store locally until save
      setSectionEvidence(prev => ({
        ...prev,
        [activeSection]: [...(prev[activeSection] || []), ...selected]
      }))
      return
    }

    // For existing frameworks, link via API
    try {
      // Link each evidence item
      for (const evidence of selected) {
        await fetch('/api/framework-evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            framework_type: frameworkType,
            framework_id: frameworkId,
            framework_item_id: activeSection, // Section key
            entity_type: evidence.entity_type,
            entity_id: evidence.entity_id,
            relation: evidence.relation,
            notes: evidence.notes
          })
        })
      }
      await loadLinkedEvidence()
    } catch (error) {
      console.error('Failed to link evidence:', error)
      alert('Failed to link evidence. Please try again.')
    }
  }

  const handleEvidenceRemove = async (sectionKey: string, evidence: LinkedEvidence) => {
    if (!frameworkId) {
      // Remove from local state only
      setSectionEvidence(prev => ({
        ...prev,
        [sectionKey]: prev[sectionKey].filter(
          e => !(e.entity_type === evidence.entity_type && e.entity_id === evidence.entity_id)
        )
      }))
      return
    }

    // Remove via API
    try {
      await fetch(
        `/api/framework-evidence?framework_type=${frameworkType}&framework_id=${frameworkId}&framework_item_id=${sectionKey}&entity_type=${evidence.entity_type}&entity_id=${evidence.entity_id}`,
        { method: 'DELETE' }
      )
      setSectionEvidence(prev => ({
        ...prev,
        [sectionKey]: prev[sectionKey].filter(
          e => !(e.entity_type === evidence.entity_type && e.entity_id === evidence.entity_id)
        )
      }))
    } catch (error) {
      console.error('Failed to unlink evidence:', error)
      alert('Failed to unlink evidence. Please try again.')
    }
  }

  const handleUrlExtract = (extractedData: Record<string, any>, metadata: { url: string; title: string; summary: string }) => {
    // Populate sections with extracted data
    const newSectionData = { ...sectionData }

    sections.forEach(section => {
      if (extractedData[section.key] && Array.isArray(extractedData[section.key])) {
        const items: FrameworkItem[] = extractedData[section.key].map((item: any) => {
          if (itemType === 'qa') {
            // Handle Q&A items
            if (typeof item === 'object' && 'question' in item) {
              return {
                id: crypto.randomUUID(),
                question: item.question?.trim() || '',
                answer: item.answer?.trim() || '',
                needsAnswer: item.needsAnswer || false // Preserve needsAnswer flag from URL scraper
              } as QuestionAnswerItem
            }
            // Fallback: treat as question with no answer
            return {
              id: crypto.randomUUID(),
              question: typeof item === 'string' ? item.trim() : '',
              answer: '',
              needsAnswer: true // String questions without answers need answers
            } as QuestionAnswerItem
          } else {
            // Handle text items
            return {
              id: crypto.randomUUID(),
              text: typeof item === 'string' ? item.trim() : (item.text || item.question || '')
            } as TextFrameworkItem
          }
        })
        newSectionData[section.key] = [...newSectionData[section.key], ...items]
      }
    })

    setSectionData(newSectionData)

    // Store source URL
    setSourceUrl(metadata.url)

    // Auto-populate title if empty
    if (!title.trim() && metadata.title) {
      setTitle(metadata.title)
    }

    // Optionally populate description with summary if empty
    if (!description.trim() && metadata.summary) {
      setDescription(metadata.summary)
    }
  }

  const generateTitle = async () => {
    setGeneratingTitle(true)
    try {
      const response = await fetch('/api/ai/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameworkType,
          data: sectionData,
          description
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate title')
      }

      const { title: generatedTitle } = await response.json()
      setTitle(generatedTitle)
    } catch (error) {
      console.error('Failed to generate title:', error)
      alert('Failed to generate title. Please try again.')
    } finally {
      setGeneratingTitle(false)
    }
  }

  const generateFollowUpQuestions = async () => {
    if (!['starbursting', 'dime'].includes(frameworkType)) return

    setGeneratingQuestions(true)
    try {
      const response = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framework: frameworkType,
          existingData: sectionData,
          context: description
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to generate questions')
      }

      const { questions } = await response.json()

      // Merge questions into sectionData with needsAnswer flag
      setSectionData(prev => {
        const updated = { ...prev }
        Object.entries(questions).forEach(([category, newQuestions]) => {
          if (Array.isArray(newQuestions)) {
            const questionItems: QuestionAnswerItem[] = newQuestions.map((q: string) => ({
              id: crypto.randomUUID(),
              question: q,
              answer: '',
              needsAnswer: true
            }))
            // Add new questions at the beginning (so they're visible)
            updated[category] = [...questionItems, ...(prev[category] || [])]
          }
        })
        return updated
      })
    } catch (error) {
      console.error('Failed to generate questions:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate follow-up questions. Please try again.')
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setSaveError('Please enter a title for your analysis')
      alert(`Please enter a title for your ${frameworkTitle} analysis`)
      return
    }

    // Validate that framework has meaningful content
    let hasData = false

    if (frameworkType === 'behavior') {
      // For behavior framework - allow save with basic info OR section items
      const hasBasicInfo = !!description.trim() ||
        (locationContext?.specific_locations?.length ?? 0) > 0 ||
        (behaviorSettings?.settings?.length ?? 0) > 0 ||
        !!temporalContext?.frequency_pattern ||
        !!complexity

      hasData = hasBasicInfo || sections.some(section => sectionData[section.key]?.length > 0)

      if (!hasData) {
        setSaveError('Please add a description or fill in basic behavior information')
        alert('Please add a description or fill in at least one field (location, settings, frequency, etc.)')
        return
      }
    } else {
      // For other frameworks - description OR section items
      hasData = !!description.trim() || sections.some(section => sectionData[section.key]?.length > 0)

      if (!hasData) {
        setSaveError('Please add a description or at least one item to any section')
        alert('Please add a description or at least one item before saving')
        return
      }
    }

    setSaving(true)
    setSaveError(null)

    try {
      const data: GenericFrameworkData = {
        title: title.trim(),
        description: description.trim(),
        source_url: sourceUrl || undefined,
        ...sectionData,
        // Add enhanced context fields for behavior framework
        ...(frameworkType === 'behavior' && {
          location_context: locationContext,
          behavior_settings: behaviorSettings,
          temporal_context: temporalContext,
          eligibility,
          complexity,
          com_b_deficits: comBDeficits,
          selected_interventions: selectedInterventions,
        }),
        // Add linked behavior for COM-B Analysis
        ...(frameworkType === 'comb-analysis' && {
          linked_behavior_id: linkedBehaviorId,
          linked_behavior_title: linkedBehaviorTitle,
          com_b_deficits: comBDeficits,
          selected_interventions: selectedInterventions,
        }),
      }

      console.log(`Saving ${frameworkType} analysis:`, data)

      await onSave(data)

      // Clear draft from localStorage after successful save
      const draftKey = `draft_${frameworkType}_${frameworkId || 'new'}`
      localStorage.removeItem(draftKey)

      setLastSaved(new Date())
      console.log(`Successfully saved ${frameworkType} analysis`)

      // Navigate back after short delay to show success
      setTimeout(() => {
        navigate(backPath)
      }, 500)

    } catch (error) {
      console.error(`Failed to save ${frameworkTitle} analysis:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setSaveError(`Failed to save: ${errorMessage}`)
      alert(`Failed to save ${frameworkTitle} analysis. ${errorMessage}\n\nYour data has been auto-saved locally. Please try again or contact support if the issue persists.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {mode === 'create' ? 'Create' : 'Edit'} {frameworkTitle}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {frameworkType} framework analysis
            </p>
            {lastSaved && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ Saved at {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <AIUrlScraper
            framework={frameworkType}
            onExtract={handleUrlExtract}
          />
          {frameworkConfigs[frameworkType]?.itemType === 'qa' && (
            <Button
              variant="outline"
              onClick={generateFollowUpQuestions}
              disabled={generatingQuestions || !description.trim()}
              title={description.trim()
                ? "Generate questions from your description using AI"
                : "Add a description to generate AI questions"}
            >
              {generatingQuestions ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Questions
                </>
              )}
            </Button>
          )}
          <ExportButton
            frameworkType={frameworkType}
            frameworkTitle={frameworkTitle}
            data={{
              title,
              description,
              ...sectionData
            }}
            variant="outline"
          />
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Analysis'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {saveError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-red-600 dark:text-red-400 mt-0.5">⚠️</div>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">Save Failed</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{saveError}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Your data has been auto-saved locally and will be restored if you refresh the page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Basic Info */}
      {frameworkType === 'behavior' ? (
        <BehaviorBasicInfoForm
          title={title}
          description={description}
          locationContext={locationContext}
          behaviorSettings={behaviorSettings}
          temporalContext={temporalContext}
          eligibility={eligibility}
          complexity={complexity}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onLocationContextChange={setLocationContext}
          onBehaviorSettingsChange={setBehaviorSettings}
          onTemporalContextChange={setTemporalContext}
          onEligibilityChange={setEligibility}
          onComplexityChange={setComplexity}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Provide a title and description for your analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title *</label>
              <div className="flex gap-2">
                <Input
                  placeholder={`e.g., Q4 2025 ${frameworkTitle} Analysis`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateTitle}
                  disabled={generatingTitle || (Object.values(sectionData).every(items => items.length === 0) && !description)}
                  title="Generate title using AI"
                >
                  {generatingTitle ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea
                placeholder="Provide context for this analysis..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Framework Sections */}
      <div className={`grid grid-cols-1 ${sections.length === 4 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6`}>
        {sections.map(section => {
          // Special handling for COM-B Analysis setup (behavior linking)
          if (frameworkType === 'comb-analysis' && section.key === 'setup') {
            return (
              <BehaviorSelector
                key={section.key}
                selectedBehaviorId={linkedBehaviorId}
                selectedBehaviorTitle={linkedBehaviorTitle}
                onSelect={(id, title) => {
                  setLinkedBehaviorId(id)
                  setLinkedBehaviorTitle(title)
                }}
                onClear={() => {
                  setLinkedBehaviorId(undefined)
                  setLinkedBehaviorTitle(undefined)
                }}
              />
            )
          }

          // Special handling for behavior timeline
          if (frameworkType === 'behavior' && section.key === 'timeline') {
            const timelineEvents: TimelineEvent[] = (sectionData[section.key] || []) as any[]
            return (
              <Card key={section.key}>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Behavior Timeline</h3>
                    <AITimelineGenerator
                      formData={{
                        title,
                        description,
                        location_context: locationContext,
                        behavior_settings: behaviorSettings,
                        temporal_context: temporalContext,
                        eligibility,
                        complexity,
                        timeline: timelineEvents
                      }}
                      existingTimeline={timelineEvents}
                      onTimelineGenerated={(timeline) => {
                        setSectionData(prev => ({ ...prev, [section.key]: timeline as any[] }))
                      }}
                    />
                  </div>
                  <BehaviorTimeline
                    events={timelineEvents}
                    onChange={(events) => {
                      setSectionData(prev => ({ ...prev, [section.key]: events as any[] }))
                    }}
                  />
                </CardContent>
              </Card>
            )
          }

          // Special handling for consequences (temporal + valence categorization)
          if (frameworkType === 'behavior' && section.key === 'consequences') {
            const consequences: ConsequenceItem[] = (sectionData[section.key] || []) as unknown as ConsequenceItem[]
            return (
              <div key={section.key}>
                <ConsequencesManager
                  consequences={consequences}
                  onChange={(updated) => {
                    setSectionData(prev => ({ ...prev, [section.key]: updated as any[] }))
                  }}
                />
              </div>
            )
          }

          // Special handling for symbols (with image upload)
          if (frameworkType === 'behavior' && section.key === 'symbols') {
            const symbolsData: SymbolItem[] = (sectionData[section.key] || []) as unknown as SymbolItem[]
            return (
              <div key={section.key}>
                <SymbolsManager
                  symbols={symbolsData}
                  onChange={(updated) => {
                    setSectionData(prev => ({ ...prev, [section.key]: updated as any[] }))
                  }}
                />
              </div>
            )
          }

          // Default section rendering
          return (
            <SectionCard
              key={section.key}
              section={section}
              items={sectionData[section.key]}
              newItem={newItems[section.key]}
              newAnswer={itemType === 'qa' ? newAnswers[section.key] : undefined}
              setNewItem={(value) => setNewItems(prev => ({ ...prev, [section.key]: value }))}
              setNewAnswer={itemType === 'qa' ? (value) => setNewAnswers(prev => ({ ...prev, [section.key]: value })) : undefined}
              onAdd={() => addItem(section.key, newItems[section.key])}
              onRemove={(id) => removeItem(section.key, id)}
              onEdit={(id, updates) => editItem(section.key, id, updates)}
              linkedEvidence={sectionEvidence[section.key] || []}
              onLinkEvidence={() => openEvidenceLinker(section.key)}
              onRemoveEvidence={(evidence) => handleEvidenceRemove(section.key, evidence)}
              frameworkType={frameworkType}
              allData={{ title, description, ...sectionData }}
              itemType={itemType}
              deficitLevel={section.comBComponent ? comBDeficits[section.comBComponent] : undefined}
              onDeficitChange={
                section.comBComponent
                  ? (level: DeficitLevel) =>
                      setComBDeficits((prev) => ({
                        ...prev,
                        [section.comBComponent!]: level,
                      }))
                  : undefined
              }
            />
          )
        })}
      </div>

      {/* BCW Recommendations (Behaviour Change Wheel) - Only for behavior framework */}
      {frameworkType === 'behavior' && (
        <BCWRecommendations
          deficits={comBDeficits}
          selectedInterventions={selectedInterventions}
          onInterventionSelect={setSelectedInterventions}
        />
      )}

      {/* Evidence Linker Modal */}
      <EvidenceLinker
        open={evidenceLinkerOpen}
        onClose={() => {
          setEvidenceLinkerOpen(false)
          setActiveSection(null)
        }}
        onLink={handleEvidenceLink}
        alreadyLinked={activeSection ? sectionEvidence[activeSection] || [] : []}
      />

      {/* Behavior Analysis Usage Guide */}
      {frameworkType === 'behavior' && (
        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Using Your Behavior Analysis
            </CardTitle>
            <CardDescription>
              Understand what happens next with your completed analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">📚 Standalone Reference Database</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Your behavior analysis serves as a <strong>reference database</strong> documenting when, where, and how a behavior occurs.
                Use it to:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1 ml-4">
                <li>Build a library of documented behaviors for your organization</li>
                <li>Share contextual understanding across teams</li>
                <li>Reference environmental factors and social context</li>
                <li>Track behavioral patterns and sequences</li>
              </ul>
            </div>

            <div className="border-t border-purple-200 dark:border-purple-700 pt-4">
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">🎯 Target-Audience Analysis with COM-B</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                For <strong>behavior change interventions</strong>, create a <strong>COM-B Analysis</strong> linked to this behavior:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1 ml-4">
                <li>Assess a specific target audience's Capability, Opportunity, and Motivation</li>
                <li>Identify barriers preventing the behavior</li>
                <li>Get AI-powered intervention recommendations</li>
                <li>Design evidence-based behavior change strategies</li>
              </ul>
              <p className="text-sm text-purple-800 dark:text-purple-200 mt-3 bg-purple-100 dark:bg-purple-900/50 p-3 rounded">
                <strong>💡 Pro Tip:</strong> After saving this analysis, click "Create COM-B Analysis" from the view page to design interventions for specific target audiences.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Analysis Button */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {mode === 'create' ? '✅ Save Your Analysis' : '💾 Save Changes'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {mode === 'create'
                  ? 'Create your analysis to access it later and create target-audience assessments'
                  : 'Your changes are auto-saved locally. Click to sync with the server.'}
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  {mode === 'create' ? 'Save Analysis' : 'Save Changes'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-${sections.length} gap-4 text-center`}>
            {sections.map(section => (
              <div key={section.key}>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {sectionData[section.key].length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{section.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
