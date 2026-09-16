/**
 * Content Picker Dialog
 *
 * Allows users to select analyzed content from their Content Library
 * for framework auto-population
 */

import { useCallback, useEffect, useState } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { analyzableUrlFrom } from '@/lib/content-url'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, ExternalLink, Plus } from 'lucide-react'
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
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const { currentWorkspaceId } = useWorkspace()
  const pendingUrl = analyzableUrlFrom(searchQuery)

  // Hoisted so a freshly analysed URL can refresh the list in place, rather than the
  // reader having to close the dialog and come back.
  const loadContent = useCallback(async (): Promise<ContentItem[]> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/content-library', {
        method: 'GET',
        headers: {
          ...getCopHeaders(),
          ...(currentWorkspaceId ? { 'X-Workspace-ID': currentWorkspaceId } : {}),
        },
      })
      if (!response.ok) throw new Error(`Failed to fetch content: ${response.status}`)
      const data = await response.json()
      const items: ContentItem[] = data.content || []
      setContent(items)
      return items
    } catch (err) {
      console.error('[ContentPicker] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load content')
      return []
    } finally {
      setLoading(false)
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    if (!open) return
    // loadContent sets its loading flag before awaiting: the intended single render that
    // shows the spinner when the dialog opens. The previous inline fetch did exactly the
    // same, and hoisting it so analysis can reuse it is what made the analyzer see it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadContent()
  }, [open, loadContent])

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

  /**
   * Analyses a pasted URL without leaving the dialog, then selects the result.
   *
   * Uses the same endpoint and `save_link` path as Content Research, so a source added
   * here is indistinguishable from one added there — this is a second doorway to the
   * same room, not a second implementation.
   */
  const analyzeAndSelect = async () => {
    if (!pendingUrl || analyzing) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const response = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: {
          ...getCopHeaders(),
          ...(currentWorkspaceId ? { 'X-Workspace-ID': currentWorkspaceId } : {}),
        },
        body: JSON.stringify({ url: pendingUrl, mode: 'quick', save_link: true }),
      })
      if (!response.ok) {
        // 422 is the ordinary "this page did not expose enough text" outcome, not a fault.
        const detail = response.status === 422
          ? 'That page did not expose enough article text to analyse.'
          : `Analysis failed (${response.status}).`
        throw new Error(detail)
      }
      const items = await loadContent()
      const added = items.find(item => item.url === pendingUrl)
        || items.find(item => analyzableUrlFrom(item.url) === pendingUrl)
      if (added) {
        setSelectedIds(prev => {
          // Respect the cap rather than silently exceeding it.
          if (prev.has(added.id) || prev.size >= maxSelection) return prev
          return new Set(prev).add(added.id)
        })
        setSearchQuery('')
      } else {
        setAnalyzeError('Analysed, but it has not appeared in your library yet. Try searching for it.')
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed.')
    } finally {
      setAnalyzing(false)
    }
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

        {pendingUrl && (
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-medium">Not in your library yet</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{pendingUrl}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-2 min-h-11"
              disabled={analyzing}
              onClick={() => void analyzeAndSelect()}
            >
              {analyzing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analysing…</>
                : <><Plus className="mr-2 h-4 w-4" /> Analyse and add it</>}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Analysing adds it to your Content Library and selects it here. You do not need to leave this dialog.
            </p>
            {analyzeError && (
              <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">{analyzeError}</p>
            )}
          </div>
        )}

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
                {pendingUrl
                  ? 'Use “Analyse and add it” above to bring this link in without leaving.'
                  : 'Paste a URL here to analyse it, or visit Content Research.'}
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
