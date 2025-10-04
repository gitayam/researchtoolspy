import { useState, useCallback, memo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AIFieldAssistant } from '@/components/ai'

interface SwotItem {
  id: string
  text: string
}

interface SwotData {
  title: string
  description: string
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
}

interface SwotFormProps {
  initialData?: SwotData
  mode: 'create' | 'edit'
  onSave: (data: SwotData) => Promise<void>
}

const QuadrantCard = memo(({
  title: quadrantTitle,
  description: quadrantDesc,
  items,
  newItem,
  setNewItem,
  onAdd,
  onRemove,
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
  color: string
  icon: string
  allData?: SwotData
}) => (
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
              className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              <span className="flex-1 text-sm">{item.text}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item.id)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
      <Badge variant="secondary">{items.length} items</Badge>
    </CardContent>
  </Card>
))

export function SwotForm({ initialData, mode, onSave }: SwotFormProps) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [strengths, setStrengths] = useState<SwotItem[]>(initialData?.strengths || [])
  const [weaknesses, setWeaknesses] = useState<SwotItem[]>(initialData?.weaknesses || [])
  const [opportunities, setOpportunities] = useState<SwotItem[]>(initialData?.opportunities || [])
  const [threats, setThreats] = useState<SwotItem[]>(initialData?.threats || [])

  const [newStrength, setNewStrength] = useState('')
  const [newWeakness, setNewWeakness] = useState('')
  const [newOpportunity, setNewOpportunity] = useState('')
  const [newThreat, setNewThreat] = useState('')

  // Auto-save draft to localStorage every 30 seconds
  useEffect(() => {
    const draftKey = `draft_swot_${mode === 'create' ? 'new' : initialData?.title || 'edit'}`

    const interval = setInterval(() => {
      const draftData = {
        title,
        description,
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
            if (confirm(`Found unsaved SWOT draft from ${new Date(draft.timestamp).toLocaleString()}. Restore it?`)) {
              setTitle(draft.title || '')
              setDescription(draft.description || '')
              setStrengths(draft.strengths || [])
              setWeaknesses(draft.weaknesses || [])
              setOpportunities(draft.opportunities || [])
              setThreats(draft.threats || [])
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

  const handleSave = async () => {
    if (!title.trim()) {
      setSaveError('Please enter a title for your analysis')
      alert('Please enter a title for your SWOT analysis')
      return
    }

    // Validate that at least one quadrant has data
    const hasData = strengths.length > 0 || weaknesses.length > 0 || opportunities.length > 0 || threats.length > 0
    if (!hasData) {
      setSaveError('Please add at least one item to any quadrant')
      alert('Please add at least one strength, weakness, opportunity, or threat before saving')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
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
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Provide a title and description for your analysis</CardDescription>
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
