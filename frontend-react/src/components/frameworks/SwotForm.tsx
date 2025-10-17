import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X, Sparkles, Info, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AIFieldAssistant } from '@/components/ai'
import { ContentPickerDialog } from './ContentPickerDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TagInput } from '@/components/ui/tag-input'
import { useWorkspace } from '@/contexts/WorkspaceContext'

// Helper function to get authentication headers
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  // Try to get bearer token first (authenticated users)
  const token = localStorage.getItem('omnicore_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Try to get user hash (guest mode)
  const userHash = localStorage.getItem('user_hash')
  if (userHash) {
    headers['X-User-Hash'] = userHash
  }

  return headers
}

interface SwotItem {
  id: string
  text: string
  details?: string
  confidence?: 'low' | 'medium' | 'high'
  evidence_ids?: string[]
  tags?: string[]
  appliesTo?: string[]  // Which option(s) this item applies to
}

interface SwotData {
  title: string
  description: string
  goal?: string  // Overall goal or decision being made
  options?: string[]  // Options being considered (e.g., ["NYC Office", "London Office"])
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
  tags?: string[]
}

// Suggested tags for autocomplete - Decision-focused
const SUGGESTED_ANALYSIS_TAGS = [
  // Decision Types
  'Location Decision', 'Vendor Selection', 'Product Choice', 'Contract Evaluation',
  'Manufacturer Comparison', 'Investment Decision', 'Technology Stack',
  // Specific Comparisons
  'Office Location', 'Warehouse Site', 'Store Location', 'Data Center',
  'Vehicle Fleet', 'Equipment Purchase', 'Software Platform', 'Service Provider',
  // Candidates/Options (use as prefix: "Option A", "NYC", "Tesla Model 3", etc.)
  'Option A', 'Option B', 'Option C', 'Option D', 'Option E',
  'Candidate 1', 'Candidate 2', 'Candidate 3',
  // Decision Context
  'Final Decision', 'Preliminary Analysis', 'Due Diligence',
  'Cost Analysis', 'Risk Assessment', 'Competitive Analysis',
  // Time-based
  'Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025',
  'Short-term', 'Long-term', 'Urgent Decision',
  // Geographic (for location decisions)
  'North America', 'Europe', 'Asia-Pacific', 'Latin America', 'Middle East',
  'NYC', 'London', 'Singapore', 'Tokyo', 'Dubai', 'Berlin',
  // Business Context
  'Strategic', 'Operational', 'Tactical', 'Emergency Response',
]

const SUGGESTED_ITEM_TAGS = [
  // Departments
  'Finance', 'HR', 'IT', 'Operations', 'Marketing', 'Sales',
  'R&D', 'Legal', 'Compliance', 'Customer Support',
  // Categories
  'Technology', 'Process', 'People', 'Strategy', 'Innovation',
  'Culture', 'Infrastructure', 'Data', 'Security', 'Quality',
  // Priority
  'Critical', 'High Priority', 'Medium Priority', 'Low Priority',
  'Quick Win', 'Long-term Investment',
  // Status
  'Active', 'Planned', 'In Progress', 'Completed', 'On Hold',
]

interface SwotFormProps {
  initialData?: SwotData
  mode: 'create' | 'edit'
  onSave: (data: SwotData) => Promise<void>
}

function QuadrantCard({
  title: quadrantTitle,
  description: quadrantDesc,
  items,
  newItem,
  setNewItem,
  newItemAppliesTo,
  setNewItemAppliesTo,
  newItemTags,
  setNewItemTags,
  newItemConfidence,
  setNewItemConfidence,
  onAdd,
  onRemove,
  onEditItem,
  onMoveItem,
  color,
  icon,
  allData,
  options
}: {
  title: string
  description: string
  items: SwotItem[]
  newItem: string
  setNewItem: (value: string) => void
  newItemAppliesTo: string[]
  setNewItemAppliesTo: (value: string[]) => void
  newItemTags: string[]
  setNewItemTags: (value: string[]) => void
  newItemConfidence: 'low' | 'medium' | 'high' | ''
  setNewItemConfidence: (value: 'low' | 'medium' | 'high' | '') => void
  onAdd: () => void
  onRemove: (id: string) => void
  onEditItem: (id: string, updates: Partial<SwotItem>) => void
  onMoveItem: (id: string, toSection: 'strengths' | 'weaknesses' | 'opportunities' | 'threats') => void
  color: string
  icon: string
  allData?: SwotData
  options?: string[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDetails, setEditDetails] = useState('')
  const [editConfidence, setEditConfidence] = useState<'low' | 'medium' | 'high' | ''>('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editAppliesTo, setEditAppliesTo] = useState<string[]>([])

  const handleStartEdit = (item: SwotItem) => {
    setEditingId(item.id)
    setEditText(item.text)
    setEditDetails(item.details || '')
    setEditConfidence(item.confidence || '')
    setEditTags(item.tags || [])
    setEditAppliesTo(item.appliesTo || [])
  }

  const handleSaveEdit = () => {
    if (editingId && editText.trim()) {
      onEditItem(editingId, {
        text: editText.trim(),
        details: editDetails.trim() || undefined,
        confidence: editConfidence || undefined,
        tags: editTags,
        appliesTo: editAppliesTo.length > 0 ? editAppliesTo : undefined
      })
      setEditingId(null)
      setEditText('')
      setEditDetails('')
      setEditConfidence('')
      setEditTags([])
      setEditAppliesTo([])
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditText('')
    setEditDetails('')
    setEditConfidence('')
    setEditTags([])
    setEditAppliesTo([])
  }

  return (
  <Card className={`border-l-4 ${color}`}>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        {quadrantTitle}
      </CardTitle>
      <CardDescription>{quadrantDesc}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Enhanced inline add form */}
      <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg">
        {/* Main text input */}
        <div className="flex gap-2">
          <Input
            placeholder={`Add a ${quadrantTitle.toLowerCase()}...`}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && (newItemTags.length === 0 && !newItemConfidence)) {
                // Only auto-add on Enter if no metadata is being set
                e.preventDefault()
                onAdd()
              }
            }}
            className="flex-1"
          />
          <AIFieldAssistant
            fieldName={quadrantTitle}
            currentValue={newItem}
            onAccept={(value) => setNewItem(value)}
            context={{
              framework: 'SWOT Analysis',
              relatedFields: allData ? {
                title: allData.title,
                description: allData.description,
                strengths: allData.strengths,
                weaknesses: allData.weaknesses,
                opportunities: allData.opportunities,
                threats: allData.threats
              } : undefined
            }}
            placeholder={`Add a ${quadrantTitle.toLowerCase()}...`}
          />
        </div>

        {/* Metadata fields - show when item text exists or options are defined */}
        {(newItem.trim() || (options && options.length > 0)) && (
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            {/* Quick Option Selector - Only show if options are defined */}
            {options && options.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📋 Applies To (Options)
                </label>
                <div className="flex flex-wrap gap-2">
                  {options.map((option, idx) => (
                    <label
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all ${
                        newItemAppliesTo.includes(option)
                          ? 'bg-purple-600 text-white border-2 border-purple-700 shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newItemAppliesTo.includes(option)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewItemAppliesTo([...newItemAppliesTo, option])
                          } else {
                            setNewItemAppliesTo(newItemAppliesTo.filter(o => o !== option))
                          }
                        }}
                        className="sr-only"
                      />
                      {newItemAppliesTo.includes(option) && <span>✓</span>}
                      {option}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  {newItemAppliesTo.length === 0
                    ? '💡 None selected = applies to all options'
                    : `Selected: ${newItemAppliesTo.join(', ')}`}
                </p>
              </div>
            )}

            {/* Tags Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                🏷️ Tags (Optional)
              </label>
              <TagInput
                tags={newItemTags}
                onChange={setNewItemTags}
                suggestions={SUGGESTED_ITEM_TAGS}
                placeholder="Add tags (e.g., Finance, High Priority)..."
                maxTags={5}
                className="text-xs"
              />
            </div>

            {/* Confidence Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                🎯 Confidence Level (Optional)
              </label>
              <div className="flex gap-2">
                {[
                  { value: '', label: 'Not Set', emoji: '⚪' },
                  { value: 'low', label: 'Low', emoji: '🔴' },
                  { value: 'medium', label: 'Medium', emoji: '🟡' },
                  { value: 'high', label: 'High', emoji: '🟢' },
                ].map((conf) => (
                  <button
                    key={conf.value}
                    type="button"
                    onClick={() => setNewItemConfidence(conf.value as any)}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border-2 transition-all ${
                      newItemConfidence === conf.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-base">{conf.emoji}</span>
                      <span>{conf.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Add Item Button - Clearly at the bottom */}
            <div className="pt-2 border-t border-gray-300 dark:border-gray-600">
              <Button
                onClick={onAdd}
                disabled={!newItem.trim()}
                className="w-full"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {quadrantTitle.slice(0, -1)}
                {(newItemAppliesTo.length > 0 || newItemTags.length > 0 || newItemConfidence) && (
                  <span className="ml-2 text-xs opacity-80">
                    ({[
                      newItemAppliesTo.length > 0 && `${newItemAppliesTo.length} option${newItemAppliesTo.length > 1 ? 's' : ''}`,
                      newItemTags.length > 0 && `${newItemTags.length} tag${newItemTags.length > 1 ? 's' : ''}`,
                      newItemConfidence && newItemConfidence
                    ].filter(Boolean).join(', ')})
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Quick Add Button - Show only when no metadata is visible */}
        {!newItem.trim() && !(options && options.length > 0) && (
          <div className="flex justify-end">
            <Button
              onClick={onAdd}
              disabled={!newItem.trim()}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-1" />
              Quick Add
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No items added yet
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2"
            >
              {editingId === item.id ? (
                <div className="space-y-3 bg-white dark:bg-gray-900 p-3 rounded border-2 border-blue-300 dark:border-blue-700">
                  {/* Text Input */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Item Text *
                    </label>
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) handleSaveEdit()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="text-sm"
                      autoFocus
                    />
                  </div>

                  {/* Details Textarea */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Additional Details
                    </label>
                    <Textarea
                      value={editDetails}
                      onChange={(e) => setEditDetails(e.target.value)}
                      placeholder="Add notes, context, or supporting information..."
                      className="text-sm"
                      rows={2}
                    />
                  </div>

                  {/* Confidence Selector */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Confidence / Certainty Level
                    </label>
                    <select
                      value={editConfidence}
                      onChange={(e) => setEditConfidence(e.target.value as 'low' | 'medium' | 'high' | '')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">No confidence level set</option>
                      <option value="low">🔴 Low - Uncertain or speculative</option>
                      <option value="medium">🟡 Medium - Reasonably confident</option>
                      <option value="high">🟢 High - Very confident / proven</option>
                    </select>
                  </div>

                  {/* Tags Input */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Tags
                    </label>
                    <TagInput
                      tags={editTags}
                      onChange={setEditTags}
                      suggestions={SUGGESTED_ITEM_TAGS}
                      placeholder="Add tags (e.g., Finance, High Priority, In Progress)..."
                      maxTags={5}
                      className="text-xs"
                    />
                  </div>

                  {/* Applies To Options - Only show if options are defined */}
                  {options && options.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Applies To (Options)
                      </label>
                      <div className="space-y-1.5">
                        {options.map((option, idx) => (
                          <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editAppliesTo.includes(option)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditAppliesTo([...editAppliesTo, option])
                                } else {
                                  setEditAppliesTo(editAppliesTo.filter(o => o !== option))
                                }
                              }}
                              className="rounded border-gray-300 dark:border-gray-600"
                            />
                            <span className="text-gray-900 dark:text-gray-100">{option}</span>
                          </label>
                        ))}
                        {editAppliesTo.length === 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                            Not selected = applies to all options
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Move to Section Dropdown */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Move to Section
                    </label>
                    <select
                      onChange={(e) => {
                        const newSection = e.target.value as 'strengths' | 'weaknesses' | 'opportunities' | 'threats'
                        if (newSection && editingId) {
                          onMoveItem(editingId, newSection)
                          handleCancelEdit()
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      defaultValue=""
                    >
                      <option value="">Keep in {quadrantTitle}</option>
                      <option value="strengths">💪 Move to Strengths</option>
                      <option value="weaknesses">⚠️ Move to Weaknesses</option>
                      <option value="opportunities">🎯 Move to Opportunities</option>
                      <option value="threats">⚡ Move to Threats</option>
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveEdit}
                      className="flex-1"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      {/* Main text with confidence indicator */}
                      <div className="flex items-start gap-2">
                        {item.confidence && (
                          <span className="text-lg" title={`Confidence: ${item.confidence}`}>
                            {item.confidence === 'high' && '🟢'}
                            {item.confidence === 'medium' && '🟡'}
                            {item.confidence === 'low' && '🔴'}
                          </span>
                        )}
                        <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">{item.text}</span>
                      </div>

                      {/* Details if present */}
                      {item.details && (
                        <div className="pl-6 text-xs text-gray-600 dark:text-gray-400 border-l-2 border-gray-300 dark:border-gray-600">
                          {item.details}
                        </div>
                      )}

                      {/* Tags if present */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-6">
                          {item.tags.map((tag, idx) => (
                            <Badge
                              key={idx}
                              className="text-xs px-2.5 py-0.5 font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
                            >
                              🏷️ {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Applies To if present */}
                      {item.appliesTo && item.appliesTo.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-6">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Applies to:</span>
                          {item.appliesTo.map((option, idx) => (
                            <Badge
                              key={idx}
                              className="text-xs px-2.5 py-0.5 font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700"
                            >
                              ✓ {option}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-1" style={{ flexShrink: 0 }}>
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onRemove(item.id)}
                        className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <Badge variant="secondary">{items.length} items</Badge>
    </CardContent>
  </Card>
  )
}

export function SwotForm({ initialData, mode, onSave }: SwotFormProps) {
  const navigate = useNavigate()
  const { currentWorkspaceId } = useWorkspace()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [goal, setGoal] = useState(initialData?.goal || '')
  const [options, setOptions] = useState<string[]>(initialData?.options || [])
  const [tags, setTags] = useState<string[]>(initialData?.tags || [])
  const [strengths, setStrengths] = useState<SwotItem[]>(initialData?.strengths || [])
  const [weaknesses, setWeaknesses] = useState<SwotItem[]>(initialData?.weaknesses || [])
  const [opportunities, setOpportunities] = useState<SwotItem[]>(initialData?.opportunities || [])
  const [threats, setThreats] = useState<SwotItem[]>(initialData?.threats || [])

  const [newStrength, setNewStrength] = useState('')
  const [newWeakness, setNewWeakness] = useState('')
  const [newOpportunity, setNewOpportunity] = useState('')
  const [newThreat, setNewThreat] = useState('')

  // Track which options each new item applies to
  const [newStrengthAppliesTo, setNewStrengthAppliesTo] = useState<string[]>([])
  const [newWeaknessAppliesTo, setNewWeaknessAppliesTo] = useState<string[]>([])
  const [newOpportunityAppliesTo, setNewOpportunityAppliesTo] = useState<string[]>([])
  const [newThreatAppliesTo, setNewThreatAppliesTo] = useState<string[]>([])

  // Track tags for each new item
  const [newStrengthTags, setNewStrengthTags] = useState<string[]>([])
  const [newWeaknessTags, setNewWeaknessTags] = useState<string[]>([])
  const [newOpportunityTags, setNewOpportunityTags] = useState<string[]>([])
  const [newThreatTags, setNewThreatTags] = useState<string[]>([])

  // Track confidence for each new item
  const [newStrengthConfidence, setNewStrengthConfidence] = useState<'low' | 'medium' | 'high' | ''>('')
  const [newWeaknessConfidence, setNewWeaknessConfidence] = useState<'low' | 'medium' | 'high' | ''>('')
  const [newOpportunityConfidence, setNewOpportunityConfidence] = useState<'low' | 'medium' | 'high' | ''>('')
  const [newThreatConfidence, setNewThreatConfidence] = useState<'low' | 'medium' | 'high' | ''>('')

  // Auto-populate state
  const [contentPickerOpen, setContentPickerOpen] = useState(false)
  const [autoPopulating, setAutoPopulating] = useState(false)
  const [autoPopulateSuccess, setAutoPopulateSuccess] = useState(false)

  // Auto-save draft to localStorage every 30 seconds
  useEffect(() => {
    const draftKey = `draft_swot_${mode === 'create' ? 'new' : initialData?.title || 'edit'}`

    const interval = setInterval(() => {
      const draftData = {
        title,
        description,
        goal,
        options,
        tags,
        strengths,
        weaknesses,
        opportunities,
        threats,
        timestamp: new Date().toISOString()
      }
      try {
        localStorage.setItem(draftKey, JSON.stringify(draftData))
        console.log('Auto-saved SWOT draft')
      } catch (error) {
        console.error('Failed to auto-save SWOT draft:', error)
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [title, description, goal, options, tags, strengths, weaknesses, opportunities, threats, mode, initialData])

  // Restore draft on mount if available
  useEffect(() => {
    if (mode === 'create' && !initialData) {
      const draftKey = 'draft_swot_new'
      const savedDraft = localStorage.getItem(draftKey)

      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft)
          const draftAge = Date.now() - new Date(draft.timestamp).getTime()

          // Only restore if draft is less than 24 hours old
          if (draftAge < 24 * 60 * 60 * 1000) {
            const draftDate = new Date(draft.timestamp).toLocaleString()
            const message = `You have an unsaved SWOT draft from ${draftDate}.\n\nWould you like to restore it and continue where you left off?\n\nClick OK to restore, or Cancel to start fresh.`
            if (confirm(message)) {
              setTitle(draft.title || '')
              setDescription(draft.description || '')
              setGoal(draft.goal || '')
              setOptions(draft.options || [])
              setTags(draft.tags || [])
              setStrengths(draft.strengths || [])
              setWeaknesses(draft.weaknesses || [])
              setOpportunities(draft.opportunities || [])
              setThreats(draft.threats || [])
            } else {
              // User declined, clean up the draft
              localStorage.removeItem(draftKey)
            }
          } else {
            // Clean up old drafts
            localStorage.removeItem(draftKey)
          }
        } catch (error) {
          console.error('Failed to restore SWOT draft:', error)
        }
      }
    }
  }, [mode, initialData])

  const addItem = (
    category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats',
    text: string,
    appliesTo: string[],
    tags: string[],
    confidence: 'low' | 'medium' | 'high' | '',
    setter: React.Dispatch<React.SetStateAction<SwotItem[]>>,
    clearInput: () => void,
    clearAppliesTo: () => void,
    clearTags: () => void,
    clearConfidence: () => void
  ) => {
    if (!text.trim()) return

    const newItem: SwotItem = {
      id: crypto.randomUUID(),
      text: text.trim(),
      appliesTo: appliesTo.length > 0 ? appliesTo : undefined,
      tags: tags.length > 0 ? tags : undefined,
      confidence: confidence || undefined
    }

    setter(prev => [...prev, newItem])
    clearInput()
    clearAppliesTo()
    clearTags()
    clearConfidence()
  }

  const removeItem = (
    category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats',
    id: string,
    setter: React.Dispatch<React.SetStateAction<SwotItem[]>>
  ) => {
    setter(prev => prev.filter(item => item.id !== id))
  }

  const editItem = (
    category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats',
    id: string,
    updates: Partial<SwotItem>,
    setter: React.Dispatch<React.SetStateAction<SwotItem[]>>
  ) => {
    setter(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))
  }

  const moveItem = (
    fromCategory: 'strengths' | 'weaknesses' | 'opportunities' | 'threats',
    id: string,
    toCategory: 'strengths' | 'weaknesses' | 'opportunities' | 'threats'
  ) => {
    if (fromCategory === toCategory) return

    // Get the item from source category
    const sourceGetter = {
      strengths,
      weaknesses,
      opportunities,
      threats
    }[fromCategory]

    const item = sourceGetter.find(i => i.id === id)
    if (!item) return

    // Remove from source
    const sourceSetter = {
      strengths: setStrengths,
      weaknesses: setWeaknesses,
      opportunities: setOpportunities,
      threats: setThreats
    }[fromCategory]

    sourceSetter(prev => prev.filter(i => i.id !== id))

    // Add to destination
    const destSetter = {
      strengths: setStrengths,
      weaknesses: setWeaknesses,
      opportunities: setOpportunities,
      threats: setThreats
    }[toCategory]

    destSetter(prev => [...prev, item])
  }

  const handleAutoPopulate = async (contentIds: string[]) => {
    setAutoPopulating(true)
    setAutoPopulateSuccess(false)
    setContentPickerOpen(false)

    try {
      console.log('[SWOT Auto-Populate] Requesting auto-population for', contentIds.length, 'content sources')

      const response = await fetch(`/api/frameworks/swot-auto-populate?workspace_id=${currentWorkspaceId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          contentIds,
          title: title || undefined,
          workspace_id: currentWorkspaceId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to auto-populate: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Auto-population failed')
      }

      console.log('[SWOT Auto-Populate] Received', data.metadata.totalItems, 'items')

      // Add auto-populated items to existing items
      const newStrengths = data.strengths.map((item: any) => ({
        id: crypto.randomUUID(),
        text: `${item.text}${item.source ? ` (Source: ${new URL(item.source).hostname})` : ''}`
      }))

      const newWeaknesses = data.weaknesses.map((item: any) => ({
        id: crypto.randomUUID(),
        text: `${item.text}${item.source ? ` (Source: ${new URL(item.source).hostname})` : ''}`
      }))

      const newOpportunities = data.opportunities.map((item: any) => ({
        id: crypto.randomUUID(),
        text: `${item.text}${item.source ? ` (Source: ${new URL(item.source).hostname})` : ''}`
      }))

      const newThreats = data.threats.map((item: any) => ({
        id: crypto.randomUUID(),
        text: `${item.text}${item.source ? ` (Source: ${new URL(item.source).hostname})` : ''}`
      }))

      // Merge with existing items (append AI-generated items)
      setStrengths(prev => [...prev, ...newStrengths])
      setWeaknesses(prev => [...prev, ...newWeaknesses])
      setOpportunities(prev => [...prev, ...newOpportunities])
      setThreats(prev => [...prev, ...newThreats])

      setAutoPopulateSuccess(true)
      console.log('[SWOT Auto-Populate] Successfully populated form')

      // Hide success message after 5 seconds
      setTimeout(() => setAutoPopulateSuccess(false), 5000)

    } catch (error) {
      console.error('[SWOT Auto-Populate] Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Auto-population failed: ${errorMessage}\n\nPlease try again or add items manually.`)
    } finally {
      setAutoPopulating(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setSaveError('Please enter a title for your analysis')
      alert('Please enter a title for your SWOT analysis')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        goal: goal.trim() || undefined,
        options: options.length > 0 ? options : undefined,
        tags,
        strengths,
        weaknesses,
        opportunities,
        threats
      }

      console.log('Saving SWOT analysis:', data)

      await onSave(data)

      // Clear draft from localStorage after successful save
      const draftKey = `draft_swot_${mode === 'create' ? 'new' : initialData?.title || 'edit'}`
      localStorage.removeItem(draftKey)

      setLastSaved(new Date())
      console.log('Successfully saved SWOT analysis')

      // Navigate back after short delay to show success
      setTimeout(() => {
        navigate('/dashboard/analysis-frameworks/swot-dashboard')
      }, 500)

    } catch (error) {
      console.error('Failed to save SWOT analysis:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setSaveError(`Failed to save: ${errorMessage}`)
      alert(`Failed to save SWOT analysis. ${errorMessage}\n\nYour data has been auto-saved locally. Please try again or contact support if the issue persists.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard/analysis-frameworks/swot-dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {mode === 'create' ? 'Create' : 'Edit'} SWOT Analysis
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Analyze Strengths, Weaknesses, Opportunities, and Threats
            </p>
            {lastSaved && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ Saved at {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Success Alert */}
      {autoPopulateSuccess && (
        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <Info className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            ✓ Auto-population successful! AI-generated items have been added to your SWOT analysis.
            Review and edit them as needed before saving.
          </AlertDescription>
        </Alert>
      )}

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

      {/* Auto-Populate Card */}
      <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            AI-Powered Auto-Population
          </CardTitle>
          <CardDescription>
            Let AI analyze your content and automatically generate SWOT items with source citations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setContentPickerOpen(true)}
              disabled={autoPopulating}
              className="border-purple-300 hover:bg-purple-100 dark:border-purple-700 dark:hover:bg-purple-900/30"
            >
              {autoPopulating ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Analyzing Content...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-Populate from Content
                </>
              )}
            </Button>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select analyzed content from your library to auto-generate SWOT items
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Content Picker Dialog */}
      <ContentPickerDialog
        open={contentPickerOpen}
        onOpenChange={setContentPickerOpen}
        onConfirm={handleAutoPopulate}
        maxSelection={5}
      />

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Provide a title, description, and tags for your analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <Input
              placeholder="e.g., Q4 2025 Market Analysis"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              placeholder="Provide context for this SWOT analysis..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Goal / Decision
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-2">
                (What are you trying to decide or accomplish?)
              </span>
            </label>
            <Input
              placeholder="e.g., Select office location, Choose vendor, Pick technology stack..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              💡 Tip: A clear goal helps focus your analysis and makes comparisons more meaningful
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Options Being Considered
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-2">
                (List the choices you're evaluating)
              </span>
            </label>
            <TagInput
              tags={options}
              onChange={setOptions}
              suggestions={[
                'Option A', 'Option B', 'Option C',
                'NYC Office', 'London Office', 'Remote Only',
                'Vendor 1', 'Vendor 2', 'In-House',
                'Product A', 'Product B', 'Build Custom'
              ]}
              placeholder="Add options (e.g., NYC Office, London Office, Remote Only)..."
              maxTags={10}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              <p className="font-medium">💡 Decision-Making Workflow:</p>
              <ul className="list-disc list-inside pl-2 space-y-0.5 mt-1">
                <li><strong>Single SWOT:</strong> List all options here, then tag each item with which option(s) it applies to</li>
                <li><strong>Multiple SWOTs:</strong> Create separate SWOT for each option, add shared tags for comparison</li>
                <li><strong>Example:</strong> Goal: "Choose office location" | Options: "NYC", "London", "Singapore"</li>
              </ul>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Tags
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-2">
                (Organize for comparison & decision-making)
              </span>
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={SUGGESTED_ANALYSIS_TAGS}
              placeholder="Add tags (e.g., Location Decision, NYC, Office Location)..."
              maxTags={10}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
              <p className="font-medium">💡 Decision-Making Tips:</p>
              <ul className="list-disc list-inside pl-2 space-y-0.5">
                <li><strong>Comparison sets:</strong> Tag with decision type (e.g., "Office Location") + specific option (e.g., "NYC")</li>
                <li><strong>Multiple options:</strong> Create separate SWOT for each (NYC, London, Singapore) with shared tag</li>
                <li><strong>Merge later:</strong> Use dashboard filter to compare all analyses with same tag</li>
                <li><strong>Examples:</strong> "Vehicle Fleet" + "Tesla Model 3" | "Vendor Selection" + "Acme Corp" | "Contract Evaluation" + "Option A"</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SWOT Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuadrantCard
          title="Strengths"
          description="Internal positive attributes and resources"
          items={strengths}
          newItem={newStrength}
          setNewItem={setNewStrength}
          newItemAppliesTo={newStrengthAppliesTo}
          setNewItemAppliesTo={setNewStrengthAppliesTo}
          newItemTags={newStrengthTags}
          setNewItemTags={setNewStrengthTags}
          newItemConfidence={newStrengthConfidence}
          setNewItemConfidence={setNewStrengthConfidence}
          onAdd={() => addItem('strengths', newStrength, newStrengthAppliesTo, newStrengthTags, newStrengthConfidence, setStrengths, () => setNewStrength(''), () => setNewStrengthAppliesTo([]), () => setNewStrengthTags([]), () => setNewStrengthConfidence(''))}
          onRemove={(id) => removeItem('strengths', id, setStrengths)}
          onEditItem={(id, updates) => editItem('strengths', id, updates, setStrengths)}
          onMoveItem={(id, toSection) => moveItem('strengths', id, toSection)}
          color="border-green-500"
          icon="💪"
          allData={{ title, description, strengths, weaknesses, opportunities, threats }}
          options={options}
        />
        <QuadrantCard
          title="Weaknesses"
          description="Internal negative attributes and limitations"
          items={weaknesses}
          newItem={newWeakness}
          setNewItem={setNewWeakness}
          newItemAppliesTo={newWeaknessAppliesTo}
          setNewItemAppliesTo={setNewWeaknessAppliesTo}
          newItemTags={newWeaknessTags}
          setNewItemTags={setNewWeaknessTags}
          newItemConfidence={newWeaknessConfidence}
          setNewItemConfidence={setNewWeaknessConfidence}
          onAdd={() => addItem('weaknesses', newWeakness, newWeaknessAppliesTo, newWeaknessTags, newWeaknessConfidence, setWeaknesses, () => setNewWeakness(''), () => setNewWeaknessAppliesTo([]), () => setNewWeaknessTags([]), () => setNewWeaknessConfidence(''))}
          onRemove={(id) => removeItem('weaknesses', id, setWeaknesses)}
          onEditItem={(id, updates) => editItem('weaknesses', id, updates, setWeaknesses)}
          onMoveItem={(id, toSection) => moveItem('weaknesses', id, toSection)}
          color="border-red-500"
          icon="⚠️"
          allData={{ title, description, strengths, weaknesses, opportunities, threats }}
          options={options}
        />
        <QuadrantCard
          title="Opportunities"
          description="External positive factors to leverage"
          items={opportunities}
          newItem={newOpportunity}
          setNewItem={setNewOpportunity}
          newItemAppliesTo={newOpportunityAppliesTo}
          setNewItemAppliesTo={setNewOpportunityAppliesTo}
          newItemTags={newOpportunityTags}
          setNewItemTags={setNewOpportunityTags}
          newItemConfidence={newOpportunityConfidence}
          setNewItemConfidence={setNewOpportunityConfidence}
          onAdd={() => addItem('opportunities', newOpportunity, newOpportunityAppliesTo, newOpportunityTags, newOpportunityConfidence, setOpportunities, () => setNewOpportunity(''), () => setNewOpportunityAppliesTo([]), () => setNewOpportunityTags([]), () => setNewOpportunityConfidence(''))}
          onRemove={(id) => removeItem('opportunities', id, setOpportunities)}
          onEditItem={(id, updates) => editItem('opportunities', id, updates, setOpportunities)}
          onMoveItem={(id, toSection) => moveItem('opportunities', id, toSection)}
          color="border-blue-500"
          icon="🎯"
          allData={{ title, description, strengths, weaknesses, opportunities, threats }}
          options={options}
        />
        <QuadrantCard
          title="Threats"
          description="External negative factors to mitigate"
          items={threats}
          newItem={newThreat}
          setNewItem={setNewThreat}
          newItemAppliesTo={newThreatAppliesTo}
          setNewItemAppliesTo={setNewThreatAppliesTo}
          newItemTags={newThreatTags}
          setNewItemTags={setNewThreatTags}
          newItemConfidence={newThreatConfidence}
          setNewItemConfidence={setNewThreatConfidence}
          onAdd={() => addItem('threats', newThreat, newThreatAppliesTo, newThreatTags, newThreatConfidence, setThreats, () => setNewThreat(''), () => setNewThreatAppliesTo([]), () => setNewThreatTags([]), () => setNewThreatConfidence(''))}
          onRemove={(id) => removeItem('threats', id, setThreats)}
          onEditItem={(id, updates) => editItem('threats', id, updates, setThreats)}
          onMoveItem={(id, toSection) => moveItem('threats', id, toSection)}
          color="border-orange-500"
          icon="⚡"
          allData={{ title, description, strengths, weaknesses, opportunities, threats }}
          options={options}
        />
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {strengths.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Strengths</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {weaknesses.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Weaknesses</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {opportunities.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Opportunities</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {threats.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Threats</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
