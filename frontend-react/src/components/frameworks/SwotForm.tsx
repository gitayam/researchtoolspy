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

interface SwotItem {
  id: string
  text: string
  evidence_ids?: string[]
  confidence?: number
  tags?: string[]
}

interface SwotData {
  title: string
  description: string
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
  onAdd,
  onRemove,
  onEdit,
  onEditTags,
  color,
  icon,
  allData
}: {
  title: string
  description: string
  items: SwotItem[]
  newItem: string
  setNewItem: (value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onEditTags: (id: string, tags: string[]) => void
  color: string
  icon: string
  allData?: SwotData
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])

  const handleStartEdit = (item: SwotItem) => {
    setEditingId(item.id)
    setEditText(item.text)
    setEditTags(item.tags || [])
  }

  const handleSaveEdit = () => {
    if (editingId && editText.trim()) {
      onEdit(editingId, editText.trim())
      onEditTags(editingId, editTags)
      setEditingId(null)
      setEditText('')
      setEditTags([])
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditText('')
    setEditTags([])
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
      <div className="flex gap-2">
        <Input
          placeholder={`Add a ${quadrantTitle.toLowerCase()}...`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onAdd()}
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
        <Button onClick={onAdd} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
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
                <>
                  <div className="flex items-start gap-2">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) handleSaveEdit()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="flex-1 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveEdit}
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                      title="Save"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <TagInput
                      tags={editTags}
                      onChange={setEditTags}
                      suggestions={SUGGESTED_ITEM_TAGS}
                      placeholder="Add tags (e.g., Finance, High Priority, In Progress)..."
                      maxTags={5}
                      className="text-xs"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{item.text}</span>
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-300"
                      style={{ flexShrink: 0 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-red-300"
                      style={{ flexShrink: 0 }}
                    >
                      Delete
                    </button>
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [tags, setTags] = useState<string[]>(initialData?.tags || [])
  const [strengths, setStrengths] = useState<SwotItem[]>(initialData?.strengths || [])
  const [weaknesses, setWeaknesses] = useState<SwotItem[]>(initialData?.weaknesses || [])
  const [opportunities, setOpportunities] = useState<SwotItem[]>(initialData?.opportunities || [])
  const [threats, setThreats] = useState<SwotItem[]>(initialData?.threats || [])

  const [newStrength, setNewStrength] = useState('')
  const [newWeakness, setNewWeakness] = useState('')
  const [newOpportunity, setNewOpportunity] = useState('')
  const [newThreat, setNewThreat] = useState('')

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
  }, [title, description, strengths, weaknesses, opportunities, threats, mode, initialData])

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
    setter: React.Dispatch<React.SetStateAction<SwotItem[]>>,
    clearInput: () => void
  ) => {
    if (!text.trim()) return

    const newItem: SwotItem = {
      id: crypto.randomUUID(),
      text: text.trim()
    }

    setter(prev => [...prev, newItem])
    clearInput()
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
    newText: string,
    setter: React.Dispatch<React.SetStateAction<SwotItem[]>>
  ) => {
    setter(prev => prev.map(item =>
      item.id === id ? { ...item, text: newText } : item
    ))
  }

  const editItemTags = (
    category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats',
    id: string,
    tags: string[],
    setter: React.Dispatch<React.SetStateAction<SwotItem[]>>
  ) => {
    setter(prev => prev.map(item =>
      item.id === id ? { ...item, tags } : item
    ))
  }

  const handleAutoPopulate = async (contentIds: string[]) => {
    setAutoPopulating(true)
    setAutoPopulateSuccess(false)
    setContentPickerOpen(false)

    try {
      console.log('[SWOT Auto-Populate] Requesting auto-population for', contentIds.length, 'content sources')

      const response = await fetch('/api/frameworks/swot-auto-populate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentIds,
          title: title || undefined
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
          onAdd={() => addItem('strengths', newStrength, setStrengths, () => setNewStrength(''))}
          onRemove={(id) => removeItem('strengths', id, setStrengths)}
          onEdit={(id, newText) => editItem('strengths', id, newText, setStrengths)}
          onEditTags={(id, tags) => editItemTags('strengths', id, tags, setStrengths)}
          color="border-green-500"
          icon="💪"
          allData={{ title, description, strengths, weaknesses, opportunities, threats }}
        />
        <QuadrantCard
          title="Weaknesses"
          description="Internal negative attributes and limitations"
          items={weaknesses}
          newItem={newWeakness}
          setNewItem={setNewWeakness}
          onAdd={() => addItem('weaknesses', newWeakness, setWeaknesses, () => setNewWeakness(''))}
          onRemove={(id) => removeItem('weaknesses', id, setWeaknesses)}
          onEdit={(id, newText) => editItem('weaknesses', id, newText, setWeaknesses)}
          onEditTags={(id, tags) => editItemTags('weaknesses', id, tags, setWeaknesses)}
          color="border-red-500"
          icon="⚠️"
          allData={{ title, description, strengths, weaknesses, opportunities, threats }}
        />
        <QuadrantCard
          title="Opportunities"
          description="External positive factors to leverage"
          items={opportunities}
          newItem={newOpportunity}
          setNewItem={setNewOpportunity}
          onAdd={() => addItem('opportunities', newOpportunity, setOpportunities, () => setNewOpportunity(''))}
          onRemove={(id) => removeItem('opportunities', id, setOpportunities)}
          onEdit={(id, newText) => editItem('opportunities', id, newText, setOpportunities)}
          onEditTags={(id, tags) => editItemTags('opportunities', id, tags, setOpportunities)}
          color="border-blue-500"
          icon="🎯"
          allData={{ title, description, strengths, weaknesses, opportunities, threats }}
        />
        <QuadrantCard
          title="Threats"
          description="External negative factors to mitigate"
          items={threats}
          newItem={newThreat}
          setNewItem={setNewThreat}
          onAdd={() => addItem('threats', newThreat, setThreats, () => setNewThreat(''))}
          onRemove={(id) => removeItem('threats', id, setThreats)}
          onEdit={(id, newText) => editItem('threats', id, newText, setThreats)}
          onEditTags={(id, tags) => editItemTags('threats', id, tags, setThreats)}
          color="border-orange-500"
          icon="⚡"
          allData={{ title, description, strengths, weaknesses, opportunities, threats }}
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
