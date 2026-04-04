/**
 * Survey Drops List Page
 *
 * Card grid of surveys with status filter tabs, inline create form,
 * and share link copy. Dark-mode compatible.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Copy, Check, ClipboardList, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCopHeaders } from '@/lib/cop-auth'
import { cn } from '@/lib/utils'
import type { SurveyDrop, IntakeFormStatus, IntakeFormField } from '@/types/cop'

// ── Survey templates ────────────────────────────────────────────

// Templates are contributor-facing forms. The survey creator picks a template,
// gives it a title (e.g., "Down Pilot Near Kherson"), and shares the link.
// Contributors fill in these fields. The description on the survey provides context.
const SURVEY_TEMPLATES: { id: string; name: string; description: string; defaultTitle: string; defaultDescription: string; fields: IntakeFormField[] }[] = [
  {
    id: 'tip-line',
    name: 'Tip Line',
    description: 'Anonymous tip collection — share the link publicly',
    defaultTitle: 'Submit a Tip',
    defaultDescription: 'Help us by reporting what you know. All submissions are anonymous. Do not put yourself at risk.',
    fields: [
      { name: 'report', type: 'textarea', label: 'Your report', required: true, placeholder: 'Describe what you know — who, what, where, when' },
      { name: 'source_url', type: 'url', label: 'Source link', required: false, placeholder: 'Link to post, article, or video if applicable' },
      { name: 'location', type: 'geopoint', label: 'Related location', required: false, help_text: 'Paste a Google Maps link, coordinates, or MGRS' },
      { name: 'confidence', type: 'rating', label: 'Confidence', required: false, help_text: '1 = heard a rumor, 5 = witnessed firsthand' },
      { name: 'evidence', type: 'file', label: 'Evidence (photo/screenshot)', required: false, accept: 'image/*', help_text: 'Max 5 MB' },
    ],
  },
  {
    id: 'sighting',
    name: 'Sighting / Incident',
    description: 'Crowdsource reports of incidents, events, or sightings from multiple sources',
    defaultTitle: 'Report a Sighting',
    defaultDescription: 'Submit what you saw, found online, or heard about a reported incident. Include location and time if possible. Links to articles, posts, and channels are just as valuable as firsthand accounts.',
    fields: [
      { name: 'what_happened', type: 'textarea', label: 'What did you see or find?', required: true, placeholder: 'Describe the incident, sighting, or what the source is reporting' },
      { name: 'source_url', type: 'url', label: 'Source link', required: false, placeholder: 'Link to the article, post, channel, or video', help_text: 'Platform auto-detected from the link' },
      { name: 'location', type: 'geopoint', label: 'Location', required: false, help_text: 'Paste a Google Maps link, coordinates, or MGRS' },
      { name: 'when', type: 'datetime', label: 'When did this happen?', required: true },
      { name: 'category', type: 'select', label: 'Type', required: true, options: ['Explosion / Strike', 'Aircraft Down', 'Military Activity', 'Naval Incident', 'Vehicle Movement', 'Protest / Civil Unrest', 'Infrastructure Damage', 'Humanitarian', 'Cyber / Information', 'Other'] },
      { name: 'language', type: 'select', label: 'Language of source', required: false, options: ['English', 'Arabic', 'Farsi / Persian', 'Russian', 'Ukrainian', 'Hebrew', 'Turkish', 'French', 'Chinese', 'Other'] },
      { name: 'confidence', type: 'likert', label: 'Credibility', required: true, options: ['Unknown', 'Questionable', 'Plausible — single source', 'Credible — multiple sources', 'Official or firsthand'] },
      { name: 'evidence', type: 'file', label: 'Screenshot / Photo / Video', required: false, accept: 'image/*,video/*', help_text: 'Screenshot posts before deletion. Max 5 MB.' },
    ],
  },
  {
    id: 'missing-search',
    name: 'Search & Sightings',
    description: 'Collect sighting reports and online mentions for missing persons, aircraft, vehicles, etc.',
    defaultTitle: 'Have You Seen This?',
    defaultDescription: 'We are looking for any information — firsthand sightings, social media posts, news articles, or online discussions. Every link and detail helps build the picture.',
    fields: [
      { name: 'what_you_found', type: 'textarea', label: 'What do you know?', required: true, placeholder: 'Firsthand sighting, social media post, news article, or anything relevant' },
      { name: 'source_url', type: 'url', label: 'Link (if online)', required: false, placeholder: 'Article, post, channel, or discussion thread', help_text: 'Platform auto-detected from the link' },
      { name: 'sighting_location', type: 'geopoint', label: 'Location', required: false, help_text: 'Where was it seen? Paste a map link, coordinates, or MGRS' },
      { name: 'sighting_time', type: 'datetime', label: 'When?', required: false },
      { name: 'info_type', type: 'select', label: 'Type of information', required: true, options: ['Firsthand sighting', 'Social media post', 'News article', 'Photo or video', 'Online discussion', 'Tip from someone', 'Other'] },
      { name: 'photo', type: 'file', label: 'Photo / Screenshot', required: false, accept: 'image/*', help_text: 'Screenshot posts before deletion — max 5 MB' },
      { name: 'confidence', type: 'likert', label: 'How sure are you?', required: true, options: ['Not sure — could be wrong', 'Possible match', 'Probably the right one', 'Definitely a match'] },
      { name: 'contact', type: 'text', label: 'Contact info (optional)', required: false, placeholder: 'Phone or email if you want to be reached', help_text: 'Only shared with the research team' },
    ],
  },
  {
    id: 'infra-recon',
    name: 'Infrastructure Research',
    description: 'Collect network infrastructure indicators from your team',
    defaultTitle: 'Submit Infrastructure Findings',
    defaultDescription: 'Submit IPs, domains, .onion addresses, and service details you have identified. Include screenshots of WHOIS, certificates, or service banners when possible.',
    fields: [
      { name: 'ip_address', type: 'ip_address', label: 'IP Address', required: false, placeholder: '192.168.1.1 or 192.168.1.1:8080' },
      { name: 'onion_address', type: 'onion', label: '.onion Address', required: false, placeholder: 'http://abc...xyz.onion' },
      { name: 'service_url', type: 'url', label: 'URL', required: false, placeholder: 'https:// or http://' },
      { name: 'service_type', type: 'select', label: 'Service type', required: false, options: ['Web Server', 'FTP', 'SSH', 'Mail', 'DNS', 'Database', 'C2 / RAT', 'VPN', 'Proxy', 'Crypto Miner', 'Other'] },
      { name: 'first_seen', type: 'datetime', label: 'First seen', required: false },
      { name: 'screenshot', type: 'file', label: 'Screenshot (WHOIS, cert, banner)', required: false, accept: 'image/*', help_text: 'Max 5 MB' },
      { name: 'notes', type: 'textarea', label: 'Additional details', required: false, placeholder: 'Hosting provider, related domains, certificates, WHOIS info, etc.' },
    ],
  },
  {
    id: 'social-intel',
    name: 'Social Media Collection',
    description: 'Collect social media accounts, posts, channels, and groups',
    defaultTitle: 'Submit Social Media Finds',
    defaultDescription: 'Found a relevant account, post, channel, or group? Submit it here. Screenshot before it gets deleted — content disappears fast.',
    fields: [
      { name: 'profile_url', type: 'url', label: 'Link', required: true, placeholder: 'URL to the profile, post, channel, or group', help_text: 'Platform and handle auto-detected from the link' },
      { name: 'platform', type: 'select', label: 'Platform', required: false, options: ['Twitter/X', 'Telegram', 'Discord', 'Instagram', 'TikTok', 'Reddit', 'Facebook', 'YouTube', 'VKontakte', 'LinkedIn', 'Forum', 'Other'] },
      { name: 'handle', type: 'handle', label: 'Handle / username', required: false, placeholder: '@username or channel name' },
      { name: 'content', type: 'textarea', label: 'What is this about?', required: false, placeholder: 'Copy/paste the post text, or describe what the account/channel covers' },
      { name: 'language', type: 'select', label: 'Language', required: false, options: ['English', 'Arabic', 'Farsi / Persian', 'Russian', 'Ukrainian', 'Hebrew', 'Turkish', 'French', 'Chinese', 'Other'] },
      { name: 'screenshot', type: 'file', label: 'Screenshot', required: false, accept: 'image/*', help_text: 'Archive it before deletion — max 5 MB' },
      { name: 'observed_at', type: 'datetime', label: 'Date found', required: false },
    ],
  },
  {
    id: 'financial-trail',
    name: 'Financial / Crypto',
    description: 'Track wallet addresses and transactions',
    defaultTitle: 'Submit Financial Indicators',
    defaultDescription: 'Submit crypto wallet addresses, transaction links, or financial indicators relevant to the research.',
    fields: [
      { name: 'wallet', type: 'crypto_address', label: 'Wallet address', required: true, placeholder: 'bc1q... (BTC), 0x... (ETH), 4... (XMR)' },
      { name: 'currency', type: 'select', label: 'Currency', required: true, options: ['BTC', 'ETH', 'USDT', 'XMR', 'SOL', 'USDC', 'TRX', 'Other'] },
      { name: 'tx_url', type: 'url', label: 'Transaction link', required: false, placeholder: 'Link to blockchain explorer' },
      { name: 'amount', type: 'number', label: 'Amount', required: false },
      { name: 'related_wallet', type: 'crypto_address', label: 'Connected wallet', required: false, help_text: 'Destination or source if known' },
      { name: 'context', type: 'textarea', label: 'Why is this relevant?', required: false },
    ],
  },
  {
    id: 'source-debrief',
    name: 'Source Debrief',
    description: 'Structured source reporting with NATO reliability scale',
    defaultTitle: 'Submit Source Report',
    defaultDescription: 'Submit information obtained from a source. Rate the source reliability and information credibility.',
    fields: [
      { name: 'intel', type: 'textarea', label: 'Information', required: true, placeholder: 'What was reported? Use exact wording where possible.' },
      { name: 'reliability', type: 'select', label: 'Source reliability', required: true, options: ['A - Completely Reliable', 'B - Usually Reliable', 'C - Fairly Reliable', 'D - Not Usually Reliable', 'E - Unreliable', 'F - Cannot Be Judged'] },
      { name: 'credibility', type: 'rating', label: 'Info credibility (1-5)', required: true, help_text: '1 = Improbable, 3 = Possibly True, 5 = Confirmed' },
      { name: 'country', type: 'country', label: 'Country', required: false },
      { name: 'source_url', type: 'url', label: 'Source link', required: false },
      { name: 'notes', type: 'textarea', label: 'Your notes', required: false, placeholder: 'Your assessment, context, or follow-up needed' },
    ],
  },
  {
    id: 'media-verify',
    name: 'Media Verification',
    description: 'Collect media submissions for geolocation and authenticity checks',
    defaultTitle: 'Submit Media for Verification',
    defaultDescription: 'Found an image or video that needs verification? Submit it here with any context you have about the claim.',
    fields: [
      { name: 'media_url', type: 'url', label: 'Link to the media', required: true, placeholder: 'Direct link to image, video, or post' },
      { name: 'claimed_location', type: 'geopoint', label: 'Claimed location', required: false, help_text: 'Where does the source say this was taken?' },
      { name: 'claimed_date', type: 'datetime', label: 'Claimed date', required: false },
      { name: 'context', type: 'textarea', label: 'What does this claim to show?', required: true, placeholder: 'Describe the narrative or claim attached to this media' },
      { name: 'platform', type: 'select', label: 'Found on', required: true, options: ['Twitter/X', 'Telegram', 'TikTok', 'YouTube', 'Facebook', 'Instagram', 'Reddit', 'News Site', 'Other'] },
      { name: 'red_flags', type: 'multiselect', label: 'Red flags noticed', required: false, options: ['Metadata stripped', 'Cropped/edited', 'Reverse image match', 'Old media recycled', 'AI generated', 'Deepfake', 'None'] },
      { name: 'screenshot', type: 'file', label: 'Screenshot/Archive', required: false, accept: 'image/*', help_text: 'Screenshot the post before deletion — max 5 MB' },
    ],
  },
]

// ── Status badge config ─────────────────────────────────────────

const STATUS_COLORS: Record<IntakeFormStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400',
}

type FilterTab = 'all' | IntakeFormStatus

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Draft', value: 'draft' },
  { label: 'Closed', value: 'closed' },
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function SurveyListPage() {
  const navigate = useNavigate()

  const [surveys, setSurveys] = useState<SurveyDrop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchSurveys = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const statusParam = filter !== 'all' ? `?status=${filter}` : ''
      const res = await fetch(`/api/surveys${statusParam}`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) throw new Error(`Failed to load surveys (${res.status})`)
      const data = await res.json() as { surveys: SurveyDrop[] }
      setSurveys(data.surveys)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load surveys')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    const controller = new AbortController()
    fetchSurveys(controller.signal)
    return () => controller.abort()
  }, [fetchSurveys])

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return
    setCreating(true)
    setError(null)
    try {
      const template = SURVEY_TEMPLATES.find(t => t.id === selectedTemplate)
      const body: Record<string, unknown> = {
        title: title.trim(),
        status: 'draft',
      }
      if (template) {
        body.description = template.defaultDescription
        body.form_schema = template.fields
      }
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error || `Failed to create survey (${res.status})`)
      }
      const data = await res.json() as { id: string }
      navigate(`/dashboard/surveys/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create survey')
    } finally {
      setCreating(false)
    }
  }, [title, selectedTemplate, navigate])

  const handleCopyLink = useCallback((survey: SurveyDrop, e: React.MouseEvent) => {
    e.stopPropagation()
    const url = survey.custom_slug
      ? `${window.location.origin}/drop/${survey.custom_slug}`
      : `${window.location.origin}/drop/${survey.share_token}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedId(survey.id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const handleToggleStatus = useCallback(async (survey: SurveyDrop, e: React.MouseEvent) => {
    e.stopPropagation()
    const nextStatus: Record<string, string> = { draft: 'active', active: 'closed', closed: 'draft' }
    const newStatus = nextStatus[survey.status] || 'draft'
    try {
      const res = await fetch(`/api/surveys/${survey.id}`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      setSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, status: newStatus as IntakeFormStatus } : s))
    } catch (err) { setError(err instanceof Error ? err.message : 'Status update failed') }
  }, [])

  const handleDuplicate = useCallback(async (survey: SurveyDrop, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          title: `${survey.title} (copy)`,
          description: survey.description,
          form_schema: survey.form_schema,
          status: 'draft',
        }),
      })
      if (!res.ok) throw new Error('Failed to duplicate survey')
      const data = await res.json() as { id: string }
      navigate(`/dashboard/surveys/${data.id}`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Duplicate failed') }
  }, [navigate])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Survey Drops</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage data collection surveys
          </p>
        </div>
        <Button onClick={() => { setShowCreate(true); setSelectedTemplate(null); setTitle('') }} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Survey
        </Button>
      </div>

      {/* Template picker / create form */}
      {showCreate && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6 space-y-4">
            {!selectedTemplate && selectedTemplate !== 'blank' ? (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Choose a template or start blank
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SURVEY_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => {
                        setSelectedTemplate(tmpl.id)
                        setTitle(tmpl.defaultTitle)
                      }}
                      className="text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors min-h-[80px]"
                    >
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                        {tmpl.name}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {tmpl.description}
                      </span>
                      <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                        {tmpl.fields.length} field{tmpl.fields.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedTemplate('blank')
                      setTitle('')
                    }}
                    className="text-left p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors min-h-[80px]"
                  >
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                      Blank Survey
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Start from scratch with no pre-built fields
                    </span>
                  </button>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false)
                      setSelectedTemplate(null)
                      setTitle('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedTemplate(null)
                      setTitle('')
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    &larr; Back to templates
                  </button>
                  {selectedTemplate !== 'blank' && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Template: {SURVEY_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Survey title"
                    className="w-full px-3 py-2 text-base rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={!title.trim() || creating}>
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false)
                      setSelectedTemplate(null)
                      setTitle('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 whitespace-nowrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'px-4 py-2 min-h-[40px] text-sm font-medium border-b-2 transition-colors',
                filter === tab.value
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      )}

      {/* Empty state */}
      {!loading && !error && surveys.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No surveys yet. Create your first survey to start collecting data.
          </p>
        </div>
      )}

      {/* Card grid */}
      {!loading && surveys.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map((survey) => (
            <Card
              key={survey.id}
              className="cursor-pointer hover:shadow-md transition-shadow dark:hover:border-gray-600"
              onClick={() => navigate(`/dashboard/surveys/${survey.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold line-clamp-2">
                    {survey.title}
                  </CardTitle>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                      STATUS_COLORS[survey.status]
                    )}
                  >
                    {survey.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {survey.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {survey.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{survey.submission_count} submission{survey.submission_count !== 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(survey.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleToggleStatus(survey, e)}
                    className="text-xs px-3 py-1.5 min-h-[36px] sm:text-[10px] sm:px-2 sm:py-0.5 sm:min-h-0 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={`Switch to ${({ draft: 'active', active: 'closed', closed: 'draft' } as Record<string, string>)[survey.status]}`}
                  >
                    {({ draft: 'Activate', active: 'Close', closed: 'Reopen' } as Record<string, string>)[survey.status]}
                  </button>
                  <button
                    onClick={(e) => handleDuplicate(survey, e)}
                    className="text-xs px-3 py-1.5 min-h-[36px] sm:text-[10px] sm:px-2 sm:py-0.5 sm:min-h-0 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Duplicate survey"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={(e) => handleCopyLink(survey, e)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 min-h-[36px] sm:text-[10px] sm:px-2 sm:py-0.5 sm:min-h-0 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {copiedId === survey.id ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Link
                      </>
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
