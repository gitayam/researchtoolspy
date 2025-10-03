import { useState, useEffect } from 'react'
import { Plus, Trash2, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SavedCitation, Author, CitationStyle, SourceType, CitationFields } from '@/types/citations'
import { generateCitation } from '@/utils/citation-formatters'

interface CitationEditFormProps {
  citation: SavedCitation
  onSave: (updated: SavedCitation) => void
  onCancel: () => void
}

export function CitationEditForm({ citation, onSave, onCancel }: CitationEditFormProps) {
  const [citationStyle, setCitationStyle] = useState<CitationStyle>(citation.citationStyle)
  const [sourceType, setSourceType] = useState<SourceType>(citation.sourceType)
  const [authors, setAuthors] = useState<Author[]>(citation.fields.authors || [{ firstName: '', lastName: '', middleName: '' }])

  // Form fields
  const [title, setTitle] = useState(citation.fields.title || '')
  const [year, setYear] = useState(citation.fields.year || '')
  const [month, setMonth] = useState(citation.fields.month || '')
  const [day, setDay] = useState(citation.fields.day || '')

  // Website fields
  const [url, setUrl] = useState(citation.fields.url || '')
  const [siteName, setSiteName] = useState(citation.fields.siteName || '')
  const [accessDate, setAccessDate] = useState(citation.fields.accessDate || '')

  // Book fields
  const [publisher, setPublisher] = useState(citation.fields.publisher || '')
  const [edition, setEdition] = useState(citation.fields.edition || '')
  const [place, setPlace] = useState(citation.fields.place || '')
  const [isbn, setIsbn] = useState(citation.fields.isbn || '')

  // Journal fields
  const [journalTitle, setJournalTitle] = useState(citation.fields.journalTitle || '')
  const [volume, setVolume] = useState(citation.fields.volume || '')
  const [issue, setIssue] = useState(citation.fields.issue || '')
  const [pages, setPages] = useState(citation.fields.pages || '')
  const [doi, setDoi] = useState(citation.fields.doi || '')

  // Report fields
  const [institution, setInstitution] = useState(citation.fields.institution || '')
  const [reportNumber, setReportNumber] = useState(citation.fields.reportNumber || '')

  // News fields
  const [publication, setPublication] = useState(citation.fields.publication || '')

  const addAuthor = () => {
    setAuthors([...authors, { firstName: '', lastName: '', middleName: '' }])
  }

  const removeAuthor = (index: number) => {
    if (authors.length > 1) {
      setAuthors(authors.filter((_, i) => i !== index))
    }
  }

  const updateAuthor = (index: number, field: keyof Author, value: string) => {
    const updated = [...authors]
    updated[index] = { ...updated[index], [field]: value }
    setAuthors(updated)
  }

  const getFields = (): CitationFields => {
    return {
      authors,
      title,
      year,
      month,
      day,
      url,
      siteName,
      accessDate,
      publisher,
      edition,
      place,
      isbn,
      journalTitle,
      volume,
      issue,
      pages,
      doi,
      institution,
      reportNumber,
      publication
    }
  }

  const { citation: preview, inTextCitation } = generateCitation(getFields(), sourceType, citationStyle)

  const handleSave = () => {
    if (!title.trim()) {
      alert('Please enter a title')
      return
    }

    if (authors.length === 0 || !authors[0].lastName.trim()) {
      alert('Please enter at least one author')
      return
    }

    const updated: SavedCitation = {
      ...citation,
      citationStyle,
      sourceType,
      fields: getFields(),
      citation: preview,
      inTextCitation
    }

    onSave(updated)
  }

  return (
    <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100">Editing Citation</h4>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Check className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Style and Type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="edit-style" className="text-xs">Citation Style</Label>
          <Select value={citationStyle} onValueChange={(v) => setCitationStyle(v as CitationStyle)}>
            <SelectTrigger id="edit-style" className="h-8">
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

        <div className="space-y-1">
          <Label htmlFor="edit-type" className="text-xs">Source Type</Label>
          <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
            <SelectTrigger id="edit-type" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="book">Book</SelectItem>
              <SelectItem value="journal">Journal Article</SelectItem>
              <SelectItem value="report">Report</SelectItem>
              <SelectItem value="news">News Article</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <Label htmlFor="edit-title" className="text-xs">Title *</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8"
          required
        />
      </div>

      {/* Authors */}
      <div className="space-y-2">
        <Label className="text-xs">Authors *</Label>
        {authors.map((author, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder="First"
              value={author.firstName}
              onChange={(e) => updateAuthor(index, 'firstName', e.target.value)}
              className="h-8"
            />
            <Input
              placeholder="Last"
              value={author.lastName}
              onChange={(e) => updateAuthor(index, 'lastName', e.target.value)}
              className="h-8"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeAuthor(index)}
              disabled={authors.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addAuthor}>
          <Plus className="h-4 w-4 mr-1" />
          Add Author
        </Button>
      </div>

      {/* Date */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="edit-year" className="text-xs">Year</Label>
          <Input
            id="edit-year"
            placeholder="2024"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-month" className="text-xs">Month</Label>
          <Input
            id="edit-month"
            placeholder="January"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-day" className="text-xs">Day</Label>
          <Input
            id="edit-day"
            placeholder="15"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-8"
          />
        </div>
      </div>

      {/* Website-specific fields */}
      {sourceType === 'website' && (
        <>
          <div className="space-y-1">
            <Label htmlFor="edit-url" className="text-xs">URL</Label>
            <Input
              id="edit-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="edit-siteName" className="text-xs">Website Name</Label>
              <Input
                id="edit-siteName"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-accessDate" className="text-xs">Access Date</Label>
              <Input
                id="edit-accessDate"
                type="date"
                value={accessDate}
                onChange={(e) => setAccessDate(e.target.value)}
                className="h-8"
              />
            </div>
          </div>
        </>
      )}

      {/* Book-specific fields */}
      {sourceType === 'book' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="edit-publisher" className="text-xs">Publisher</Label>
            <Input
              id="edit-publisher"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-place" className="text-xs">Place</Label>
            <Input
              id="edit-place"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="h-8"
            />
          </div>
        </div>
      )}

      {/* Journal-specific fields */}
      {sourceType === 'journal' && (
        <>
          <div className="space-y-1">
            <Label htmlFor="edit-journal" className="text-xs">Journal Title</Label>
            <Input
              id="edit-journal"
              value={journalTitle}
              onChange={(e) => setJournalTitle(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="edit-volume" className="text-xs">Volume</Label>
              <Input
                id="edit-volume"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-issue" className="text-xs">Issue</Label>
              <Input
                id="edit-issue"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-pages" className="text-xs">Pages</Label>
              <Input
                id="edit-pages"
                placeholder="1-10"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                className="h-8"
              />
            </div>
          </div>
        </>
      )}

      {/* Preview */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Preview</Label>
        <div className="p-3 bg-white dark:bg-gray-800 border rounded-md text-sm">
          {preview}
        </div>
      </div>
    </div>
  )
}
