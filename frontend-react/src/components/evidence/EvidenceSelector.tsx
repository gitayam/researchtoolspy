import { useState, useEffect } from 'react'
import { Search, CheckSquare, Check, Target, TrendingUp, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { EvidenceItem } from '@/types/evidence'
import { EvidenceLevel } from '@/types/evidence'

interface EvidenceSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (evidenceIds: string[]) => void
  selectedIds?: string[]
  frameworkId?: string
  sectionKey?: string
}

export function EvidenceSelector({
  open,
  onClose,
  onSelect,
  selectedIds = [],
  frameworkId,
  sectionKey
}: EvidenceSelectorProps) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadEvidence()
      setSelected(new Set(selectedIds))
    }
  }, [open, selectedIds])

  const loadEvidence = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/evidence-items')
      if (response.ok) {
        const data = await response.json()
        setEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Failed to load evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const handleSave = () => {
    onSelect(Array.from(selected))
    onClose()
  }

  const getLevelIcon = (level: EvidenceLevel) => {
    switch (level) {
      case 'tactical': return Target
      case 'operational': return TrendingUp
      case 'strategic': return Zap
      default: return Target
    }
  }

  const filteredEvidence = evidence.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.who?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.what?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Link Evidence Items
          </DialogTitle>
          <DialogDescription>
            Select evidence items to link to {sectionKey ? `the "${sectionKey}" section` : 'this framework'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search evidence..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading evidence...</div>
            ) : filteredEvidence.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No evidence found matching your search' : 'No evidence available'}
              </div>
            ) : (
              filteredEvidence.map((item) => {
                const isSelected = selected.has(item.id.toString())
                const LevelIcon = getLevelIcon(item.evidence_level)

                return (
                  <div
                    key={item.id}
                    className={
                      isSelected
                        ? 'p-4 border rounded-lg cursor-pointer transition-colors border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'p-4 border rounded-lg cursor-pointer transition-colors border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                    onClick={() => toggleSelection(item.id.toString())}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(item.id.toString())}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <LevelIcon className="h-4 w-4 text-gray-500" />
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {item.title}
                          </h4>
                          {isSelected && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {item.description}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                          {item.who && (
                            <div className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Who:</span> {item.who}
                            </div>
                          )}
                          {item.what && (
                            <div className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">What:</span> {item.what}
                            </div>
                          )}
                          {item.when_occurred && (
                            <div className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">When:</span> {item.when_occurred}
                            </div>
                          )}
                          {item.where_location && (
                            <div className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Where:</span> {item.where_location}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {item.evidence_level}
                          </Badge>
                          <Badge variant={item.priority === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                            {item.priority}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {item.evidence_type.replace('_', ' ')}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {item.confidence_level}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selected.size} evidence item{selected.size !== 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={selected.size === 0}>
                Link Evidence
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
