import { useState, type ReactElement } from 'react'
import { Plus, X, Clock, TrendingUp, Users2, Edit2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ConsequenceItem, ConsequenceTimeframe, ConsequenceValence } from '@/types/behavior'

interface ConsequencesManagerProps {
  consequences: ConsequenceItem[]
  onChange: (consequences: ConsequenceItem[]) => void
}

const timeframeLabels: Record<ConsequenceTimeframe, string> = {
  immediate: 'Immediate',
  long_term: 'Long-term',
  generational: 'Generational'
}

const timeframeIcons: Record<ConsequenceTimeframe, ReactElement> = {
  immediate: <Clock className="h-4 w-4" />,
  long_term: <TrendingUp className="h-4 w-4" />,
  generational: <Users2 className="h-4 w-4" />
}

const timeframeDescriptions: Record<ConsequenceTimeframe, string> = {
  immediate: 'Happens right away (minutes to days)',
  long_term: 'Takes time to manifest (months to years)',
  generational: 'Affects future generations (decades+)'
}

const valenceColors: Record<ConsequenceValence, string> = {
  positive: 'bg-green-50 dark:bg-green-900/20 border-green-300 text-green-800 dark:text-green-200',
  negative: 'bg-red-50 dark:bg-red-900/20 border-red-300 text-red-800 dark:text-red-200',
  neutral: 'bg-gray-50 dark:bg-gray-800 border-gray-300 text-gray-800 dark:text-gray-200',
  mixed: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 text-yellow-800 dark:text-yellow-200'
}

const valenceLabels: Record<ConsequenceValence, string> = {
  positive: '✓ Positive',
  negative: '✗ Negative',
  neutral: '○ Neutral',
  mixed: '± Mixed'
}

export function ConsequencesManager({ consequences, onChange }: ConsequencesManagerProps) {
  const [newConsequence, setNewConsequence] = useState('')
  const [newTimeframe, setNewTimeframe] = useState<ConsequenceTimeframe>('immediate')
  const [newValence, setNewValence] = useState<ConsequenceValence>('neutral')
  const [newDescription, setNewDescription] = useState('')
  const [newWhoAffected, setNewWhoAffected] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editConsequence, setEditConsequence] = useState('')
  const [editTimeframe, setEditTimeframe] = useState<ConsequenceTimeframe>('immediate')
  const [editValence, setEditValence] = useState<ConsequenceValence>('neutral')
  const [editDescription, setEditDescription] = useState('')
  const [editWhoAffected, setEditWhoAffected] = useState('')

  const handleAdd = () => {
    if (!newConsequence.trim()) return

    const consequenceItem: ConsequenceItem = {
      id: crypto.randomUUID(),
      consequence: newConsequence.trim(),
      timeframe: newTimeframe,
      valence: newValence,
      description: newDescription.trim() || undefined,
      who_affected: newWhoAffected.trim() || undefined
    }

    onChange([...consequences, consequenceItem])

    // Reset form
    setNewConsequence('')
    setNewTimeframe('immediate')
    setNewValence('neutral')
    setNewDescription('')
    setNewWhoAffected('')
  }

  const handleRemove = (id: string) => {
    onChange(consequences.filter(c => c.id !== id))
  }

  const startEdit = (item: ConsequenceItem) => {
    setEditingId(item.id)
    setEditConsequence(item.consequence)
    setEditTimeframe(item.timeframe)
    setEditValence(item.valence)
    setEditDescription(item.description || '')
    setEditWhoAffected(item.who_affected || '')
  }

  const saveEdit = () => {
    if (!editingId) return

    onChange(
      consequences.map(c =>
        c.id === editingId
          ? {
              ...c,
              consequence: editConsequence.trim(),
              timeframe: editTimeframe,
              valence: editValence,
              description: editDescription.trim() || undefined,
              who_affected: editWhoAffected.trim() || undefined
            }
          : c
      )
    )

    cancelEdit()
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditConsequence('')
    setEditTimeframe('immediate')
    setEditValence('neutral')
    setEditDescription('')
    setEditWhoAffected('')
  }

  // Group consequences by timeframe
  const grouped = consequences.reduce((acc, item) => {
    if (!acc[item.timeframe]) acc[item.timeframe] = []
    acc[item.timeframe].push(item)
    return acc
  }, {} as Record<ConsequenceTimeframe, ConsequenceItem[]>)

  // Calculate stats
  const stats = {
    total: consequences.length,
    byTimeframe: {
      immediate: consequences.filter(c => c.timeframe === 'immediate').length,
      long_term: consequences.filter(c => c.timeframe === 'long_term').length,
      generational: consequences.filter(c => c.timeframe === 'generational').length
    },
    byValence: {
      positive: consequences.filter(c => c.valence === 'positive').length,
      negative: consequences.filter(c => c.valence === 'negative').length,
      neutral: consequences.filter(c => c.valence === 'neutral').length,
      mixed: consequences.filter(c => c.valence === 'mixed').length
    }
  }

  return (
    <div className="space-y-6">
      {/* Add New Consequence Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Consequence or Outcome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timeframe *</Label>
              <Select value={newTimeframe} onValueChange={(v) => setNewTimeframe(v as ConsequenceTimeframe)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(timeframeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        {timeframeIcons[value as ConsequenceTimeframe]}
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground">
                            {timeframeDescriptions[value as ConsequenceTimeframe]}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Impact Type *</Label>
              <Select value={newValence} onValueChange={(v) => setNewValence(v as ConsequenceValence)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(valenceLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Consequence/Outcome *</Label>
            <Input
              placeholder="What happens? (e.g., Increased community engagement, Financial burden, Environmental impact)"
              value={newConsequence}
              onChange={(e) => setNewConsequence(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Who is Affected?</Label>
            <Input
              placeholder="Individual, family, community, society, future generations..."
              value={newWhoAffected}
              onChange={(e) => setNewWhoAffected(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Additional Details</Label>
            <Textarea
              placeholder="Describe the consequence in more detail..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
            />
          </div>

          <Button onClick={handleAdd} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Consequence
          </Button>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      {consequences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.byTimeframe.immediate}</div>
                <div className="text-sm text-muted-foreground">Immediate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.byTimeframe.long_term}</div>
                <div className="text-sm text-muted-foreground">Long-term</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{stats.byTimeframe.generational}</div>
                <div className="text-sm text-muted-foreground">Generational</div>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-4 flex-wrap">
              <Badge variant="outline" className="bg-green-50">
                {stats.byValence.positive} Positive
              </Badge>
              <Badge variant="outline" className="bg-red-50">
                {stats.byValence.negative} Negative
              </Badge>
              <Badge variant="outline" className="bg-gray-50">
                {stats.byValence.neutral} Neutral
              </Badge>
              <Badge variant="outline" className="bg-yellow-50">
                {stats.byValence.mixed} Mixed
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consequences by Timeframe */}
      {(['immediate', 'long_term', 'generational'] as ConsequenceTimeframe[]).map(timeframe => {
        const items = grouped[timeframe] || []
        if (items.length === 0) return null

        return (
          <Card key={timeframe}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {timeframeIcons[timeframe]}
                {timeframeLabels[timeframe]} Consequences
                <Badge variant="secondary">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map(item => {
                const isEditing = editingId === item.id

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border-2 ${valenceColors[item.valence]}`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Select value={editTimeframe} onValueChange={(v) => setEditTimeframe(v as ConsequenceTimeframe)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(timeframeLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select value={editValence} onValueChange={(v) => setEditValence(v as ConsequenceValence)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(valenceLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Input
                          placeholder="Consequence..."
                          value={editConsequence}
                          onChange={(e) => setEditConsequence(e.target.value)}
                        />

                        <Input
                          placeholder="Who is affected?"
                          value={editWhoAffected}
                          onChange={(e) => setEditWhoAffected(e.target.value)}
                        />

                        <Textarea
                          placeholder="Additional details..."
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                        />

                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>
                            <Check className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {valenceLabels[item.valence]}
                              </Badge>
                              {item.who_affected && (
                                <span className="text-xs text-muted-foreground">
                                  → {item.who_affected}
                                </span>
                              )}
                            </div>
                            <p className="font-medium">{item.consequence}</p>
                            {item.description && (
                              <p className="text-sm mt-2 opacity-90">{item.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(item)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemove(item.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}

      {consequences.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No consequences added yet. Add consequences to see them organized by timeframe.</p>
        </div>
      )}
    </div>
  )
}
