import { useState, useEffect } from 'react'
import { Search, BookOpen, Calendar, User, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SavedCitation } from '@/types/citations'
import { getLibrary, filterCitations } from '@/utils/citation-library'
import { generateCitation } from '@/utils/citation-formatters'

interface CitationPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (citation: SavedCitation) => void
  onCreateNew?: () => void
}

export function CitationPicker({
  open,
  onClose,
  onSelect,
  onCreateNew
}: CitationPickerProps) {
  const [citations, setCitations] = useState<SavedCitation[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCitations, setFilteredCitations] = useState<SavedCitation[]>([])

  // Load citations from library
  useEffect(() => {
    if (open) {
      const library = getLibrary()
      setCitations(library.citations)
    }
  }, [open])

  // Filter citations based on search
  useEffect(() => {
    const filtered = filterCitations(citations, searchTerm)
    setFilteredCitations(filtered)
  }, [citations, searchTerm])

  const handleSelect = (citation: SavedCitation) => {
    onSelect(citation)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Select Citation
          </DialogTitle>
          <DialogDescription>
            Choose an existing citation from your library or create a new one
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="existing" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Citations ({citations.length})</TabsTrigger>
            <TabsTrigger value="new" onClick={onCreateNew} disabled={!onCreateNew}>
              Create New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4 mt-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search Citations</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by title, author, or URL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Citation List */}
            <ScrollArea className="h-[400px] pr-4">
              {filteredCitations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {searchTerm ? (
                    <>
                      <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No citations found matching "{searchTerm}"</p>
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Your citation library is empty</p>
                      <p className="text-sm mt-2">Create citations using the Citations Tool</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCitations.map((citation) => {
                    // Regenerate citation in APA format for display
                    const { citation: apaText } = generateCitation(
                      citation.fields,
                      citation.sourceType,
                      'apa'
                    )

                    return (
                      <button
                        key={citation.id}
                        onClick={() => handleSelect(citation)}
                        className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <div className="space-y-2">
                          {/* Title */}
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {citation.fields.title}
                          </div>

                          {/* Metadata */}
                          <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                            {citation.fields.authors && citation.fields.authors.length > 0 && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>
                                  {citation.fields.authors[0].lastName}
                                  {citation.fields.authors.length > 1 && ` et al.`}
                                </span>
                              </div>
                            )}
                            {citation.fields.year && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{citation.fields.year}</span>
                              </div>
                            )}
                            {citation.fields.url && (
                              <div className="flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />
                                <span className="truncate max-w-[200px]">{citation.fields.url}</span>
                              </div>
                            )}
                          </div>

                          {/* Full citation preview */}
                          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                            {apaText}
                          </div>

                          {/* Source type badge */}
                          <div className="flex gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {citation.sourceType}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                              {citation.citationStyle.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="new">
            {/* This will trigger the onCreateNew callback */}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
