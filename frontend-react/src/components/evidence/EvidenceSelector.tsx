import { useState, useEffect } from 'react'
import { Search, Link2, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { Evidence } from '@/types/evidence'

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
  const [evidence, setEvidence] = useState<Evidence[]>([])
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
      const response = await fetch('/api/evidence')
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

  const filteredEvidence = evidence.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Evidence
          </DialogTitle>
          <DialogDescription>
            Select evidence to link to {sectionKey ? `the "${sectionKey}" section` : 'this framework'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search evidence..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Evidence List */}
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
                return (
                  <div
                    key={item.id}
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-colors
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
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
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge variant="secondary" className="text-xs">
                            {item.type.replace('_', ' ')}
                          </Badge>
                          <span>•</span>
                          <span>{item.source.name}</span>
                          {item.source.credibility && (
                            <>
                              <span>•</span>
                              <span>Credibility: {item.source.credibility}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
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
