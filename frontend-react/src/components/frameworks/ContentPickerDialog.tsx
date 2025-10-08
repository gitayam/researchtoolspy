/**
 * Content Picker Dialog
 *
 * Allows users to select analyzed content from their Content Library
 * for framework auto-population
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface ContentItem {
  id: string
  url: string
  title: string | null
  description: string | null
  created_at: string
  word_count: number
}

interface ContentPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (selectedIds: string[]) => void
  maxSelection?: number
}

export function ContentPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  maxSelection = 5
}: ContentPickerDialogProps) {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<ContentItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Fetch user's content library
  useEffect(() => {
    if (!open) return

    const fetchContent = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch from content library API
        const response = await fetch('/api/content-library', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status}`)
        }

        const data = await response.json()
        setContent(data.content || [])
      } catch (err) {
        console.error('[ContentPicker] Fetch error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load content')
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [open])

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= maxSelection) {
          alert(`Maximum ${maxSelection} content sources allowed`)
          return prev
        }
        next.add(id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one content source')
      return
    }
    onConfirm(Array.from(selectedIds))
    onOpenChange(false)
    setSelectedIds(new Set()) // Reset selection
  }

  const filteredContent = content.filter(item => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      item.title?.toLowerCase().includes(query) ||
      item.url.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Content for Auto-Population</DialogTitle>
          <DialogDescription>
            Choose up to {maxSelection} analyzed content sources to auto-generate SWOT items.
            The AI will extract insights from your selected content.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by title, URL, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Selection Counter */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedIds.size} / {maxSelection} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading your content...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {!loading && !error && filteredContent.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery ? 'No content matches your search' : 'No analyzed content found'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Visit Content Intelligence to analyze URLs first
              </p>
            </div>
          )}

          {!loading && !error && filteredContent.map((item) => (
            <Card
              key={item.id}
              className={`cursor-pointer transition-colors ${
                selectedIds.has(item.id)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'hover:border-gray-400'
              }`}
              onClick={() => handleToggle(item.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => handleToggle(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate">
                        {item.title || 'Untitled'}
                      </h3>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                      {item.url}
                    </p>
                    {item.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {item.word_count?.toLocaleString() || 0} words
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            Auto-Populate from {selectedIds.size} {selectedIds.size === 1 ? 'Source' : 'Sources'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
