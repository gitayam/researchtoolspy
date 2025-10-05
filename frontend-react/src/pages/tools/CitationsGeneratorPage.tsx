import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Copy, Check, Trash2, BookOpen, Globe, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Author, CitationStyle, SourceType, CitationFields, SavedCitation } from '@/types/citations'
import { generateCitation } from '@/utils/citation-formatters'
import { addCitation, generateCitationId } from '@/utils/citation-library'
import { CitationLibrary } from '@/components/tools/CitationLibrary'

export function CitationsGeneratorPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('apa')
  const [sourceType, setSourceType] = useState<SourceType>('website')
  const [authors, setAuthors] = useState<Author[]>([{ firstName: '', lastName: '', middleName: '' }])
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Form fields
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')

  // Website fields
  const [url, setUrl] = useState('')
  const [siteName, setSiteName] = useState('')
  const [accessDate, setAccessDate] = useState('')

  // Book fields
  const [publisher, setPublisher] = useState('')
  const [edition, setEdition] = useState('')
  const [place, setPlace] = useState('')
  const [isbn, setIsbn] = useState('')

  // Journal fields
  const [journalTitle, setJournalTitle] = useState('')
  const [volume, setVolume] = useState('')
  const [issue, setIssue] = useState('')
  const [pages, setPages] = useState('')
  const [doi, setDoi] = useState('')

  // Report fields
  const [institution, setInstitution] = useState('')
  const [reportNumber, setReportNumber] = useState('')

  // News fields
  const [publication, setPublication] = useState('')

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

  const { citation, inTextCitation } = generateCitation(getFields(), sourceType, citationStyle)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const saveToLibrary = () => {
    if (!title.trim()) {
      alert(t('citationsGeneratorTool.titleRequired'))
      return
    }

    if (authors.length === 0 || !authors[0].lastName.trim()) {
      alert(t('citationsGeneratorTool.authorRequired'))
      return
    }

    const savedCitation: SavedCitation = {
      id: generateCitationId(),
      citationStyle,
      sourceType,
      fields: getFields(),
      citation,
      inTextCitation,
      addedAt: new Date().toISOString()
    }

    addCitation(savedCitation)
    setSaved(true)
    setRefreshKey(prev => prev + 1)
    setTimeout(() => setSaved(false), 2000)
  }

  const scrapeFromUrl = async () => {
    if (!url.trim()) {
      alert(t('citationsGeneratorTool.urlRequired'))
      return
    }

    setScraping(true)
    try {
      const response = await fetch('/api/tools/scrape-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        throw new Error('Failed to scrape URL')
      }

      const data = await response.json()

      // Auto-populate fields
      if (data.title) setTitle(data.title)
      if (data.siteName) setSiteName(data.siteName)
      if (data.date) setYear(data.date)
      if (data.accessDate) setAccessDate(data.accessDate)

      // Parse author name if available and looks like a person name
      if (data.author) {
        const nameParts = data.author.trim().split(/\s+/)
        if (nameParts.length >= 2) {
          const firstName = nameParts[0]
          const lastName = nameParts[nameParts.length - 1]
          const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
          setAuthors([{ firstName, lastName, middleName }])
        } else {
          setAuthors([{ firstName: '', lastName: data.author, middleName: '' }])
        }
      }

      // For news articles, prefer publication field over siteName
      if (sourceType === 'news') {
        if (data.publication) {
          setPublication(data.publication)
        } else if (data.siteName) {
          setPublication(data.siteName)
        }
      }

    } catch (error) {
      console.error('Scraping error:', error)
      alert('Failed to scrape URL. Please check the URL and try again.')
    } finally {
      setScraping(false)
    }
  }

  const clearForm = () => {
    setAuthors([{ firstName: '', lastName: '', middleName: '' }])
    setTitle('')
    setYear('')
    setMonth('')
    setDay('')
    setUrl('')
    setSiteName('')
    setAccessDate('')
    setPublisher('')
    setEdition('')
    setPlace('')
    setIsbn('')
    setJournalTitle('')
    setVolume('')
    setIssue('')
    setPages('')
    setDoi('')
    setInstitution('')
    setReportNumber('')
    setPublication('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/dashboard/tools')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('citationsGeneratorTool.backToTools')}
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('citationsGeneratorTool.title')}</h1>
              <p className="text-gray-600 dark:text-gray-400">{t('citationsGeneratorTool.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Input Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Citation Style Selection */}
          <Card>
            <CardHeader>
              <CardTitle>{t('citationsGeneratorTool.citationStyle')}</CardTitle>
              <CardDescription>{t('citationsGeneratorTool.citationStyleDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={citationStyle} onValueChange={(v) => setCitationStyle(v as CitationStyle)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="apa">{t('citationsGeneratorTool.apa')}</TabsTrigger>
                  <TabsTrigger value="mla">{t('citationsGeneratorTool.mla')}</TabsTrigger>
                  <TabsTrigger value="chicago">{t('citationsGeneratorTool.chicago')}</TabsTrigger>
                  <TabsTrigger value="harvard">{t('citationsGeneratorTool.harvard')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* Source Type & Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('citationsGeneratorTool.sourceInformation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('citationsGeneratorTool.sourceType')}</Label>
                <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">{t('citationsGeneratorTool.website')}</SelectItem>
                    <SelectItem value="book">{t('citationsGeneratorTool.book')}</SelectItem>
                    <SelectItem value="journal">{t('citationsGeneratorTool.journal')}</SelectItem>
                    <SelectItem value="report">{t('citationsGeneratorTool.report')}</SelectItem>
                    <SelectItem value="news">{t('citationsGeneratorTool.news')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Authors */}
              <div>
                <Label>{t('citationsGeneratorTool.authors')}</Label>
                {authors.map((author, index) => (
                  <div key={index} className="flex gap-2 mt-2">
                    <Input
                      placeholder={t('citationsGeneratorTool.firstName')}
                      value={author.firstName}
                      onChange={(e) => updateAuthor(index, 'firstName', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder={t('citationsGeneratorTool.middleOptional')}
                      value={author.middleName}
                      onChange={(e) => updateAuthor(index, 'middleName', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder={t('citationsGeneratorTool.lastName')}
                      value={author.lastName}
                      onChange={(e) => updateAuthor(index, 'lastName', e.target.value)}
                      className="flex-1"
                    />
                    {authors.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAuthor(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addAuthor}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('citationsGeneratorTool.addAuthor')}
                </Button>
              </div>

              {/* Title */}
              <div>
                <Label>{t('citationsGeneratorTool.title')}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('citationsGeneratorTool.enterTitle')}
                />
              </div>

              {/* Date */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>{t('citationsGeneratorTool.year')}</Label>
                  <Input
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2025"
                  />
                </div>
                <div>
                  <Label>{t('citationsGeneratorTool.monthOptional')}</Label>
                  <Input
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    placeholder="01"
                  />
                </div>
                <div>
                  <Label>{t('citationsGeneratorTool.dayOptional')}</Label>
                  <Input
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    placeholder="15"
                  />
                </div>
              </div>

              {/* Source-specific fields */}
              {sourceType === 'website' && (
                <>
                  <div>
                    <Label>Website Name</Label>
                    <Input
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      placeholder="Example Website"
                    />
                  </div>
                  <div>
                    <Label>URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={scrapeFromUrl}
                        disabled={scraping || !url.trim()}
                      >
                        {scraping ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Scraping...
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4 mr-2" />
                            Auto-Fill
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Enter a URL and click Auto-Fill to extract metadata
                    </p>
                  </div>
                  <div>
                    <Label>Access Date (optional)</Label>
                    <Input
                      value={accessDate}
                      onChange={(e) => setAccessDate(e.target.value)}
                      placeholder="October 2, 2025"
                    />
                  </div>
                </>
              )}

              {sourceType === 'book' && (
                <>
                  <div>
                    <Label>Publisher</Label>
                    <Input
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      placeholder="Publisher Name"
                    />
                  </div>
                  <div>
                    <Label>Place of Publication</Label>
                    <Input
                      value={place}
                      onChange={(e) => setPlace(e.target.value)}
                      placeholder="New York"
                    />
                  </div>
                  <div>
                    <Label>Edition (optional)</Label>
                    <Input
                      value={edition}
                      onChange={(e) => setEdition(e.target.value)}
                      placeholder="2nd ed."
                    />
                  </div>
                  <div>
                    <Label>ISBN (optional)</Label>
                    <Input
                      value={isbn}
                      onChange={(e) => setIsbn(e.target.value)}
                      placeholder="978-0-123456-78-9"
                    />
                  </div>
                </>
              )}

              {sourceType === 'journal' && (
                <>
                  <div>
                    <Label>Journal Title</Label>
                    <Input
                      value={journalTitle}
                      onChange={(e) => setJournalTitle(e.target.value)}
                      placeholder="Journal of Example Studies"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Volume</Label>
                      <Input
                        value={volume}
                        onChange={(e) => setVolume(e.target.value)}
                        placeholder="12"
                      />
                    </div>
                    <div>
                      <Label>Issue (optional)</Label>
                      <Input
                        value={issue}
                        onChange={(e) => setIssue(e.target.value)}
                        placeholder="3"
                      />
                    </div>
                    <div>
                      <Label>Pages</Label>
                      <Input
                        value={pages}
                        onChange={(e) => setPages(e.target.value)}
                        placeholder="45-67"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>DOI (optional)</Label>
                    <Input
                      value={doi}
                      onChange={(e) => setDoi(e.target.value)}
                      placeholder="10.1234/example.2025.001"
                    />
                  </div>
                </>
              )}

              {sourceType === 'report' && (
                <>
                  <div>
                    <Label>Institution</Label>
                    <Input
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="Research Institute"
                    />
                  </div>
                  <div>
                    <Label>Report Number (optional)</Label>
                    <Input
                      value={reportNumber}
                      onChange={(e) => setReportNumber(e.target.value)}
                      placeholder="Report No. 2025-01"
                    />
                  </div>
                </>
              )}

              {sourceType === 'news' && (
                <>
                  <div>
                    <Label>Publication</Label>
                    <Input
                      value={publication}
                      onChange={(e) => setPublication(e.target.value)}
                      placeholder="The Example Times"
                    />
                  </div>
                  <div>
                    <Label>URL (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={scrapeFromUrl}
                        disabled={scraping || !url.trim()}
                      >
                        {scraping ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Scraping...
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4 mr-2" />
                            Auto-Fill
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Click Auto-Fill to extract article metadata
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={clearForm} className="flex-1">
                  {t('citationsGeneratorTool.clearForm')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('citationsGeneratorTool.citationPreview')}</CardTitle>
              <CardDescription>{t('citationsGeneratorTool.citationPreviewDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">{t('citationsGeneratorTool.fullCitation')}</Label>
                <Textarea
                  value={citation}
                  readOnly
                  className="min-h-[120px] font-serif text-sm mt-2"
                />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(citation)}
                  >
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? t('citationsGeneratorTool.copied') : t('citationsGeneratorTool.copy')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveToLibrary}
                  >
                    {saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {saved ? t('citationsGeneratorTool.saved') : t('citationsGeneratorTool.save')}
                  </Button>
                </div>
              </div>

              {inTextCitation && (
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400">{t('citationsGeneratorTool.inTextCitation')}</Label>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mt-2">
                    <p className="font-mono text-sm">{inTextCitation}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(inTextCitation)}
                    className="mt-2 w-full"
                  >
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {t('citationsGeneratorTool.copyInText')}
                  </Button>
                </div>
              )}

              {/* Quick Reference */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                  {citationStyle.toUpperCase()} {t('citationsGeneratorTool.format')}
                </h4>
                <p className="text-xs text-blue-800 dark:text-blue-400">
                  {citationStyle === 'apa' && t('citationsGeneratorTool.apaFull')}
                  {citationStyle === 'mla' && t('citationsGeneratorTool.mlaFull')}
                  {citationStyle === 'chicago' && t('citationsGeneratorTool.chicagoFull')}
                  {citationStyle === 'harvard' && t('citationsGeneratorTool.harvardFull')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Citation Library */}
      <CitationLibrary key={refreshKey} onRefresh={() => setRefreshKey(prev => prev + 1)} />
    </div>
  )
}
