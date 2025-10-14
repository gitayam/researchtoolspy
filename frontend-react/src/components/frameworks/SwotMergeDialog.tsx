import { useState } from 'react'
import { Copy, Merge, Split } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface SwotItem {
  id: string
  text: string
  evidence_ids?: string[]
  confidence?: number
  tags?: string[]
}

interface SwotData {
  id: string
  title: string
  description: string
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
  tags?: string[]
}

interface SwotMergeDialogProps {
  open: boolean
  onClose: () => void
  analyses: SwotData[]
  onMerge: (mergedData: Omit<SwotData, 'id'>) => void
  onExtract: (extractedData: Omit<SwotData, 'id'>, selectedTags: string[]) => void
}

export function SwotMergeDialog({
  open,
  onClose,
  analyses,
  onMerge,
  onExtract
}: SwotMergeDialogProps) {
  const [mode, setMode] = useState<'merge' | 'extract'>('merge')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedAnalyses, setSelectedAnalyses] = useState<Set<string>>(new Set())
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  // Extract all unique tags from all analyses
  const allTags = Array.from(new Set(
    analyses.flatMap(a => [
      ...(a.tags || []),
      ...a.strengths.flatMap(s => s.tags || []),
      ...a.weaknesses.flatMap(w => w.tags || []),
      ...a.opportunities.flatMap(o => o.tags || []),
      ...a.threats.flatMap(t => t.tags || [])
    ])
  )).sort()

  const handleMerge = () => {
    const selectedAnalysesArray = analyses.filter(a => selectedAnalyses.has(a.id))

    const mergedData: Omit<SwotData, 'id'> = {
      title: title || `Merged Analysis: ${selectedAnalysesArray.map(a => a.title).join(' + ')}`,
      description: description || `Merged from: ${selectedAnalysesArray.map(a => a.title).join(', ')}`,
      strengths: selectedAnalysesArray.flatMap(a => a.strengths),
      weaknesses: selectedAnalysesArray.flatMap(a => a.weaknesses),
      opportunities: selectedAnalysesArray.flatMap(a => a.opportunities),
      threats: selectedAnalysesArray.flatMap(a => a.threats),
      tags: Array.from(new Set(selectedAnalysesArray.flatMap(a => a.tags || [])))
    }

    onMerge(mergedData)
    handleClose()
  }

  const handleExtract = () => {
    const selectedTagsArray = Array.from(selectedTags)

    // Filter items from all analyses that have at least one of the selected tags
    const filterItemsByTags = (items: SwotItem[]) =>
      items.filter(item =>
        item.tags && item.tags.some(tag => selectedTagsArray.includes(tag))
      )

    const extractedData: Omit<SwotData, 'id'> = {
      title: title || `Extracted: ${selectedTagsArray.join(', ')}`,
      description: description || `Extracted items with tags: ${selectedTagsArray.join(', ')}`,
      strengths: analyses.flatMap(a => filterItemsByTags(a.strengths)),
      weaknesses: analyses.flatMap(a => filterItemsByTags(a.weaknesses)),
      opportunities: analyses.flatMap(a => filterItemsByTags(a.opportunities)),
      threats: analyses.flatMap(a => filterItemsByTags(a.threats)),
      tags: selectedTagsArray
    }

    onExtract(extractedData, selectedTagsArray)
    handleClose()
  }

  const handleClose = () => {
    setTitle('')
    setDescription('')
    setSelectedAnalyses(new Set())
    setSelectedTags(new Set())
    setMode('merge')
    onClose()
  }

  const toggleAnalysis = (analysisId: string) => {
    const newSet = new Set(selectedAnalyses)
    if (newSet.has(analysisId)) {
      newSet.delete(analysisId)
    } else {
      newSet.add(analysisId)
    }
    setSelectedAnalyses(newSet)
  }

  const toggleTag = (tag: string) => {
    const newSet = new Set(selectedTags)
    if (newSet.has(tag)) {
      newSet.delete(tag)
    } else {
      newSet.add(tag)
    }
    setSelectedTags(newSet)
  }

  const selectedCount = mode === 'merge' ? selectedAnalyses.size : selectedTags.size
  const canSubmit = selectedCount > 0 && (mode === 'merge' ? selectedCount >= 2 : true)

  // Count items that would be included
  const getPreviewCounts = () => {
    if (mode === 'merge') {
      const selectedAnalysesArray = analyses.filter(a => selectedAnalyses.has(a.id))
      return {
        strengths: selectedAnalysesArray.reduce((sum, a) => sum + a.strengths.length, 0),
        weaknesses: selectedAnalysesArray.reduce((sum, a) => sum + a.weaknesses.length, 0),
        opportunities: selectedAnalysesArray.reduce((sum, a) => sum + a.opportunities.length, 0),
        threats: selectedAnalysesArray.reduce((sum, a) => sum + a.threats.length, 0)
      }
    } else {
      const selectedTagsArray = Array.from(selectedTags)
      const filterItemsByTags = (items: SwotItem[]) =>
        items.filter(item =>
          item.tags && item.tags.some(tag => selectedTagsArray.includes(tag))
        )

      return {
        strengths: analyses.reduce((sum, a) => sum + filterItemsByTags(a.strengths).length, 0),
        weaknesses: analyses.reduce((sum, a) => sum + filterItemsByTags(a.weaknesses).length, 0),
        opportunities: analyses.reduce((sum, a) => sum + filterItemsByTags(a.opportunities).length, 0),
        threats: analyses.reduce((sum, a) => sum + filterItemsByTags(a.threats).length, 0)
      }
    }
  }

  const previewCounts = getPreviewCounts()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'merge' ? <Merge className="h-5 w-5" /> : <Split className="h-5 w-5" />}
            {mode === 'merge' ? 'Merge SWOT Analyses' : 'Extract SWOT Items by Tags'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'merge'
              ? 'Combine multiple SWOT analyses into a single comprehensive analysis'
              : 'Create a new SWOT analysis from items with specific tags'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Selector */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'merge' ? 'default' : 'outline'}
              onClick={() => setMode('merge')}
              className="flex-1"
            >
              <Merge className="h-4 w-4 mr-2" />
              Merge
            </Button>
            <Button
              variant={mode === 'extract' ? 'default' : 'outline'}
              onClick={() => setMode('extract')}
              className="flex-1"
            >
              <Split className="h-4 w-4 mr-2" />
              Extract
            </Button>
          </div>

          <Separator />

          {/* Title and Description */}
          <div className="space-y-2">
            <Label htmlFor="merge-title">Title (optional)</Label>
            <Input
              id="merge-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'merge' ? 'e.g., Merged Office Location Analysis' : 'e.g., High Priority Items'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="merge-description">Description (optional)</Label>
            <Input
              id="merge-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this analysis..."
            />
          </div>

          <Separator />

          {/* Selection Area */}
          {mode === 'merge' ? (
            <div className="space-y-2">
              <Label>Select Analyses to Merge (minimum 2)</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                {analyses.map(analysis => (
                  <div
                    key={analysis.id}
                    className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                  >
                    <Checkbox
                      checked={selectedAnalyses.has(analysis.id)}
                      onCheckedChange={() => toggleAnalysis(analysis.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{analysis.title}</div>
                      <div className="text-xs text-gray-500">
                        {analysis.strengths.length}S / {analysis.weaknesses.length}W / {analysis.opportunities.length}O / {analysis.threats.length}T
                      </div>
                      {analysis.tags && analysis.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {analysis.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select Tags to Extract</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg">
                {allTags.map(tag => {
                  const isSelected = selectedTags.has(tag)
                  return (
                    <Badge
                      key={tag}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer transition-all"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                      {isSelected && <Copy className="h-3 w-3 ml-1" />}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          {canSubmit && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-sm font-medium mb-2">Preview:</div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                  <div className="font-bold text-green-600 dark:text-green-400">
                    {previewCounts.strengths}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">Strengths</div>
                </div>
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
                  <div className="font-bold text-red-600 dark:text-red-400">
                    {previewCounts.weaknesses}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">Weaknesses</div>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                  <div className="font-bold text-blue-600 dark:text-blue-400">
                    {previewCounts.opportunities}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">Opportunities</div>
                </div>
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded">
                  <div className="font-bold text-orange-600 dark:text-orange-400">
                    {previewCounts.threats}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">Threats</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={mode === 'merge' ? handleMerge : handleExtract}
            disabled={!canSubmit}
          >
            {mode === 'merge' ? 'Merge Selected' : 'Extract Items'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
