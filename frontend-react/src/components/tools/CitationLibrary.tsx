import { useState, useEffect } from 'react'
import {
  Download,
  Trash2,
  CheckSquare,
  Square,
  Search,
  SortAsc,
  Copy,
  Check,
  FileText,
  Archive
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SavedCitation, CitationSortBy, SortOrder, CitationStyle } from '@/types/citations'
import {
  getLibrary,
  deleteCitation,
  deleteCitations,
  clearLibrary,
  sortCitations,
  filterCitations,
  exportToText,
  exportToBibTeX,
  exportToRIS,
  exportToCSV
} from '@/utils/citation-library'
import { generateCitation } from '@/utils/citation-formatters'

interface CitationLibraryProps {
  onRefresh?: () => void
}

export function CitationLibrary({ onRefresh }: CitationLibraryProps) {
  const [citations, setCitations] = useState<SavedCitation[]>([])
  const [filteredCitations, setFilteredCitations] = useState<SavedCitation[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<CitationSortBy>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [displayStyle, setDisplayStyle] = useState<CitationStyle>('apa')
  const [copied, setCopied] = useState(false)

  // Load citations
  const loadCitations = () => {
    const library = getLibrary()
    setCitations(library.citations)
  }

  useEffect(() => {
    loadCitations()
  }, [])

  // Apply filters and sorting
  useEffect(() => {
    let result = filterCitations(citations, searchTerm)
    result = sortCitations(result, sortBy, sortOrder)

    // Regenerate citations in the selected display style
    result = result.map(c => {
      const { citation, inTextCitation } = generateCitation(c.fields, c.sourceType, displayStyle)
      return { ...c, citation, inTextCitation, citationStyle: displayStyle }
    })

    setFilteredCitations(result)
  }, [citations, searchTerm, sortBy, sortOrder, displayStyle])

  const handleDelete = (id: string) => {
    if (confirm('Delete this citation?')) {
      deleteCitation(id)
      loadCitations()
      onRefresh?.()
    }
  }

  const handleDeleteSelected = () => {
    if (selected.size === 0) return
    if (confirm(`Delete ${selected.size} selected citation(s)?`)) {
      deleteCitations(Array.from(selected))
      setSelected(new Set())
      loadCitations()
      onRefresh?.()
    }
  }

  const handleClearLibrary = () => {
    if (confirm('Clear entire library? This cannot be undone.')) {
      clearLibrary()
      loadCitations()
      onRefresh?.()
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const toggleSelectAll = () => {
    if (selected.size === filteredCitations.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredCitations.map(c => c.id)))
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const copyAll = () => {
    const text = exportToText(filteredCitations, displayStyle)
    copyToClipboard(text)
  }

  const exportFile = (format: 'txt' | 'bibtex' | 'ris' | 'csv' | 'json') => {
    let content = ''
    let filename = `bibliography-${Date.now()}`
    let mimeType = 'text/plain'

    switch (format) {
      case 'txt':
        content = exportToText(filteredCitations, displayStyle)
        filename += '.txt'
        break
      case 'bibtex':
        content = exportToBibTeX(filteredCitations)
        filename += '.bib'
        break
      case 'ris':
        content = exportToRIS(filteredCitations)
        filename += '.ris'
        break
      case 'csv':
        content = exportToCSV(filteredCitations)
        filename += '.csv'
        mimeType = 'text/csv'
        break
      case 'json':
        content = JSON.stringify(filteredCitations, null, 2)
        filename += '.json'
        mimeType = 'application/json'
        break
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (citations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No citations yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create citations above and they will be saved to your library automatically
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Citation Library</CardTitle>
            <CardDescription>
              {filteredCitations.length} citation(s) {searchTerm && `matching "${searchTerm}"`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search citations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Sort */}
          <div className="space-y-2">
            <Label htmlFor="sort">Sort By</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as CitationSortBy)}>
              <SelectTrigger id="sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date Added</SelectItem>
                <SelectItem value="author">Author</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="type">Source Type</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Display Style */}
          <div className="space-y-2">
            <Label htmlFor="style">Citation Style</Label>
            <Select value={displayStyle} onValueChange={(v) => setDisplayStyle(v as CitationStyle)}>
              <SelectTrigger id="style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apa">APA 7th</SelectItem>
                <SelectItem value="mla">MLA 9th</SelectItem>
                <SelectItem value="chicago">Chicago 17th</SelectItem>
                <SelectItem value="harvard">Harvard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selection Controls */}
        {filteredCitations.length > 0 && (
          <div className="flex items-center justify-between py-2 border-b dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
              >
                {selected.size === filteredCitations.length ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span className="ml-2">
                  {selected.size === filteredCitations.length ? 'Deselect All' : 'Select All'}
                </span>
              </Button>
              {selected.size > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selected.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <Button variant="outline" size="sm" onClick={handleDeleteSelected}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Citations List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredCitations.map((citation, index) => (
            <div
              key={citation.id}
              className="p-4 border rounded-lg dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleSelect(citation.id)}
                  className="mt-1 flex-shrink-0"
                >
                  {selected.has(citation.id) ? (
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Square className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {index + 1}.
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {citation.citation}
                  </p>
                  {citation.notes && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">
                      Notes: {citation.notes}
                    </p>
                  )}
                  {citation.tags && citation.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {citation.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(citation.citation)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(citation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4 border-t dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button variant="outline" size="sm" onClick={copyAll}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportFile('txt')}>
              <Download className="h-4 w-4 mr-2" />
              Export TXT
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportFile('bibtex')}>
              <Download className="h-4 w-4 mr-2" />
              BibTeX
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportFile('ris')}>
              <Download className="h-4 w-4 mr-2" />
              RIS
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => exportFile('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportFile('json')}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => alert('Save as dataset coming soon!')}
            >
              <Archive className="h-4 w-4 mr-2" />
              Save as Dataset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLibrary}
              disabled={citations.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Library
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
