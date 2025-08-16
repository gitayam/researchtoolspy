'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  BookOpen, 
  Plus, 
  Search, 
  Download, 
  Edit, 
  Trash2, 
  Copy,
  Star,
  Filter,
  SortAsc
} from 'lucide-react'

interface Citation {
  id: string
  title: string
  authors: string[]
  publicationDate?: string
  sourceType: string
  sourceName?: string
  url?: string
  doi?: string
  isbn?: string
  apa: string
  mla: string
  chicago: string
  bibtex: string
  tags: string[]
  notes?: string
  reliabilityRating: number
  relevanceRating: number
  addedAt: string
  favorite: boolean
}

interface Bibliography {
  id: string
  name: string
  citationIds: string[]
  format: 'apa' | 'mla' | 'chicago' | 'bibtex'
  createdAt: string
}

export default function CitationManager() {
  const [activeTab, setActiveTab] = useState('library')
  const [citations, setCitations] = useState<Citation[]>([
    {
      id: '1',
      title: 'Intelligence Analysis: A Target-Centric Approach',
      authors: ['Robert M. Clark'],
      publicationDate: '2016',
      sourceType: 'book',
      sourceName: 'CQ Press',
      isbn: '9781506329895',
      apa: 'Clark, R. M. (2016). Intelligence Analysis: A Target-Centric Approach. CQ Press.',
      mla: 'Clark, Robert M. Intelligence Analysis: A Target-Centric Approach. CQ Press, 2016.',
      chicago: 'Clark, Robert M. Intelligence Analysis: A Target-Centric Approach. CQ Press, 2016.',
      bibtex: '@book{clark2016intelligence,\n  title={Intelligence Analysis: A Target-Centric Approach},\n  author={Clark, Robert M.},\n  year={2016},\n  publisher={CQ Press}\n}',
      tags: ['intelligence', 'analysis', 'methodology'],
      reliabilityRating: 5,
      relevanceRating: 5,
      addedAt: new Date().toISOString(),
      favorite: true
    }
  ])
  const [bibliographies, setBibliographies] = useState<Bibliography[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [selectedCitations, setSelectedCitations] = useState<string[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCitation, setNewCitation] = useState<Partial<Citation>>({
    title: '',
    authors: [],
    sourceType: 'article',
    tags: [],
    reliabilityRating: 3,
    relevanceRating: 3
  })

  const sourceTypes = [
    { value: 'article', label: 'Journal Article' },
    { value: 'book', label: 'Book' },
    { value: 'website', label: 'Website' },
    { value: 'report', label: 'Report' },
    { value: 'thesis', label: 'Thesis' },
    { value: 'conference', label: 'Conference Paper' },
    { value: 'news', label: 'News Article' },
  ]

  const citationFormats = [
    { value: 'apa', label: 'APA Style' },
    { value: 'mla', label: 'MLA Style' },
    { value: 'chicago', label: 'Chicago Style' },
    { value: 'bibtex', label: 'BibTeX' },
  ]

  const filteredCitations = citations.filter(citation => {
    const matchesSearch = searchTerm === '' || 
      citation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      citation.authors.some(author => author.toLowerCase().includes(searchTerm.toLowerCase())) ||
      citation.sourceName?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTag = filterTag === '' || citation.tags.includes(filterTag)
    
    return matchesSearch && matchesTag
  })

  const allTags = Array.from(new Set(citations.flatMap(c => c.tags)))

  const handleAddCitation = () => {
    if (!newCitation.title || newCitation.authors?.length === 0) return

    const citation: Citation = {
      id: Date.now().toString(),
      title: newCitation.title,
      authors: newCitation.authors || [],
      publicationDate: newCitation.publicationDate,
      sourceType: newCitation.sourceType || 'article',
      sourceName: newCitation.sourceName,
      url: newCitation.url,
      doi: newCitation.doi,
      isbn: newCitation.isbn,
      tags: newCitation.tags || [],
      notes: newCitation.notes,
      reliabilityRating: newCitation.reliabilityRating || 3,
      relevanceRating: newCitation.relevanceRating || 3,
      addedAt: new Date().toISOString(),
      favorite: false,
      // Generate citation formats (simplified)
      apa: generateAPA(newCitation),
      mla: generateMLA(newCitation),
      chicago: generateChicago(newCitation),
      bibtex: generateBibTeX(newCitation)
    }

    setCitations(prev => [citation, ...prev])
    setNewCitation({
      title: '',
      authors: [],
      sourceType: 'article',
      tags: [],
      reliabilityRating: 3,
      relevanceRating: 3
    })
    setShowAddForm(false)
  }

  const generateAPA = (citation: Partial<Citation>) => {
    const authors = citation.authors?.join(', ') || 'Unknown Author'
    const year = citation.publicationDate ? `(${citation.publicationDate})` : '(n.d.)'
    const title = citation.title || 'Untitled'
    const source = citation.sourceName ? ` ${citation.sourceName}.` : ''
    return `${authors} ${year}. ${title}.${source}`
  }

  const generateMLA = (citation: Partial<Citation>) => {
    const authors = citation.authors?.[0] || 'Unknown Author'
    const title = citation.title || 'Untitled'
    const source = citation.sourceName || ''
    const year = citation.publicationDate || ''
    return `${authors}. "${title}." ${source}, ${year}.`
  }

  const generateChicago = (citation: Partial<Citation>) => {
    const authors = citation.authors?.[0] || 'Unknown Author'
    const title = citation.title || 'Untitled'
    const source = citation.sourceName || ''
    const year = citation.publicationDate || ''
    return `${authors}. "${title}." ${source} (${year}).`
  }

  const generateBibTeX = (citation: Partial<Citation>) => {
    const key = citation.title?.toLowerCase().replace(/\s+/g, '') || 'citation'
    const authors = citation.authors?.join(' and ') || 'Unknown Author'
    const title = citation.title || 'Untitled'
    const year = citation.publicationDate || ''
    return `@${citation.sourceType || 'article'}{${key},\n  title={${title}},\n  author={${authors}},\n  year={${year}}\n}`
  }

  const toggleFavorite = (id: string) => {
    setCitations(prev => prev.map(c => 
      c.id === id ? { ...c, favorite: !c.favorite } : c
    ))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const deleteCitation = (id: string) => {
    setCitations(prev => prev.filter(c => c.id !== id))
    setSelectedCitations(prev => prev.filter(cid => cid !== id))
  }

  const toggleCitationSelection = (id: string) => {
    setSelectedCitations(prev => 
      prev.includes(id) 
        ? prev.filter(cid => cid !== id)
        : [...prev, id]
    )
  }

  const createBibliography = (format: 'apa' | 'mla' | 'chicago' | 'bibtex') => {
    if (selectedCitations.length === 0) return

    const bibliography: Bibliography = {
      id: Date.now().toString(),
      name: `Bibliography ${bibliographies.length + 1}`,
      citationIds: selectedCitations,
      format,
      createdAt: new Date().toISOString()
    }

    setBibliographies(prev => [bibliography, ...prev])
    setSelectedCitations([])
    setActiveTab('bibliographies')
  }

  const exportBibliography = (bibliography: Bibliography) => {
    const selectedCites = citations.filter(c => bibliography.citationIds.includes(c.id))
    const content = selectedCites.map(c => c[bibliography.format]).join('\n\n')
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${bibliography.name}-${bibliography.format}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Citation Manager</h1>
        <p className="mt-2 text-gray-600">
          Organize, format, and manage your research citations and bibliographies
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="library">Library ({citations.length})</TabsTrigger>
          <TabsTrigger value="add">Add Citation</TabsTrigger>
          <TabsTrigger value="bibliographies">Bibliographies ({bibliographies.length})</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Citation Library
                  </CardTitle>
                  <CardDescription>
                    Manage your research citations and sources
                  </CardDescription>
                </div>
                <Button onClick={() => setActiveTab('add')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Citation
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search citations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCitations.length > 0 && (
                <div className="flex gap-2 p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-blue-700">
                    {selectedCitations.length} citation(s) selected
                  </span>
                  <div className="flex gap-2 ml-auto">
                    {citationFormats.map(format => (
                      <Button
                        key={format.value}
                        variant="outline"
                        size="sm"
                        onClick={() => createBibliography(format.value as any)}
                      >
                        Export {format.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {filteredCitations.map((citation) => (
                  <Card key={citation.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedCitations.includes(citation.id)}
                          onCheckedChange={() => toggleCitationSelection(citation.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{citation.title}</CardTitle>
                              <CardDescription>
                                {citation.authors.join(', ')} • {citation.sourceType} • {citation.publicationDate}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFavorite(citation.id)}
                              >
                                <Star className={`h-4 w-4 ${citation.favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteCitation(citation.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        {citation.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        <Badge variant="outline" className="text-xs">
                          Reliability: {citation.reliabilityRating}/5
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Relevance: {citation.relevanceRating}/5
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium">APA:</Label>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(citation.apa)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          {citation.apa}
                        </p>
                      </div>

                      {citation.notes && (
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Notes:</Label>
                          <p className="text-sm text-gray-600">{citation.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {filteredCitations.length === 0 && (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No citations found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {searchTerm || filterTag ? 'Try adjusting your search or filters' : 'Add your first citation to get started'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Citation</CardTitle>
              <CardDescription>
                Enter citation details manually or import from DOI/URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newCitation.title || ''}
                    onChange={(e) => setNewCitation(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter citation title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sourceType">Source Type</Label>
                  <Select
                    value={newCitation.sourceType}
                    onValueChange={(value) => setNewCitation(prev => ({ ...prev, sourceType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="authors">Authors (one per line) *</Label>
                <Textarea
                  id="authors"
                  value={newCitation.authors?.join('\n') || ''}
                  onChange={(e) => setNewCitation(prev => ({ 
                    ...prev, 
                    authors: e.target.value.split('\n').filter(a => a.trim()) 
                  }))}
                  placeholder="Enter author names, one per line"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="publicationDate">Publication Date</Label>
                  <Input
                    id="publicationDate"
                    value={newCitation.publicationDate || ''}
                    onChange={(e) => setNewCitation(prev => ({ ...prev, publicationDate: e.target.value }))}
                    placeholder="2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sourceName">Source/Publisher</Label>
                  <Input
                    id="sourceName"
                    value={newCitation.sourceName || ''}
                    onChange={(e) => setNewCitation(prev => ({ ...prev, sourceName: e.target.value }))}
                    placeholder="Journal or publisher name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doi">DOI or ISBN</Label>
                  <Input
                    id="doi"
                    value={newCitation.doi || ''}
                    onChange={(e) => setNewCitation(prev => ({ ...prev, doi: e.target.value }))}
                    placeholder="10.1000/xyz or ISBN"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={newCitation.url || ''}
                  onChange={(e) => setNewCitation(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={newCitation.tags?.join(', ') || ''}
                  onChange={(e) => setNewCitation(prev => ({ 
                    ...prev, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
                  }))}
                  placeholder="intelligence, analysis, research"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newCitation.notes || ''}
                  onChange={(e) => setNewCitation(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this source"
                  rows={3}
                />
              </div>

              <div className="flex gap-4">
                <Button onClick={handleAddCitation} disabled={!newCitation.title || !newCitation.authors?.length}>
                  Add Citation
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('library')}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bibliographies" className="space-y-4">
          {bibliographies.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Download className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No bibliographies created yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Select citations in your library and export them as bibliographies
                </p>
              </CardContent>
            </Card>
          ) : (
            bibliographies.map((bibliography) => (
              <Card key={bibliography.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{bibliography.name}</CardTitle>
                      <CardDescription>
                        {bibliography.format.toUpperCase()} • {bibliography.citationIds.length} citations • 
                        Created {new Date(bibliography.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Button onClick={() => exportBibliography(bibliography)}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Citations</CardTitle>
              <CardDescription>
                Import citations from DOI, URLs, or bibliography files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <BookOpen className="h-4 w-4" />
                <AlertDescription>
                  Citation import features are coming soon. For now, you can add citations manually in the Add Citation tab.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}