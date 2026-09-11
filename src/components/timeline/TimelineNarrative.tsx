import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { narrativeTimelineEvents, timelineChapterAnchor, timelineEventAnchor, timelineEventTemporalLabel } from '@/lib/timeline-workspace'
import type { TimelineNarrative as Narrative, TimelineNarrativeRole, TimelineWorkspaceEvent } from '@/types/timeline-workspace'

const roles: TimelineNarrativeRole[] = ['context', 'buildup', 'turning_point', 'response', 'consequence', 'resolution']
const fields = [
  ['title', 'Narrative title'], ['framing', 'Framing'], ['question', 'Research question'],
  ['intendedUse', 'Intended use'], ['scope', 'Scope'], ['timezone', 'Timezone'], ['dataThrough', 'Data through'],
] as const
const selectStyle = 'h-10 w-full rounded-md border bg-background px-3 text-sm'

interface Props {
  narrative: Narrative
  events: TimelineWorkspaceEvent[]
  editing: boolean
  sourceUrl: string
  openGapCount: number
  onNarrative: (value: Narrative) => void
  onEvents: (value: TimelineWorkspaceEvent[]) => void
  onInspect: (id: string) => void
}

export function TimelineNarrative({ narrative, events, editing, sourceUrl, openGapCount, onNarrative, onEvents, onInspect }: Props) {
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const selected = narrativeTimelineEvents(events)
  const hasDeparture = selected.some((event, index) => {
    const previous = selected[index - 1]
    if (!previous?.eventDate || !event.eventDate) return false
    return previous.eventDate > event.eventDate
      || (previous.eventDate === event.eventDate && previous.eventTime && event.eventTime && previous.eventTime > event.eventTime)
  })
  const missingBuildup = selected.some((event, index) => event.narrativeRole === 'turning_point'
    && !selected.slice(0, index).some(prior => prior.narrativeRole === 'context' || prior.narrativeRole === 'buildup'))
  const incomplete = selected.filter(event => !event.narrativeRole || !event.whyItMatters?.trim()).length
  function updateEvent(id: string, patch: Partial<TimelineWorkspaceEvent>) {
    onEvents(events.map(event => event.id === id ? { ...event, ...patch } : event))
  }
  function move(id: string, direction: -1 | 1) {
    const ordered = [...selected]
    const index = ordered.findIndex(event => event.id === id)
    const target = index + direction
    if (target < 0 || target >= ordered.length) return
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    const positions = new Map(ordered.map((event, position) => [event.id, position]))
    onEvents(events.map(event => positions.has(event.id) ? { ...event, narrativeOrder: positions.get(event.id)! } : event))
  }
  function updateMetadata(key: typeof fields[number][0], value: string) {
    if (key === 'timezone' && value) {
      try { new Intl.DateTimeFormat('en', { timeZone: value }) } catch {
        setMetadataError('Use a valid timezone, for example UTC or America/New_York.')
        return
      }
    }
    setMetadataError(null)
    onNarrative({ ...narrative, [key]: value })
  }
  const warnings = <div className="space-y-1 text-sm" aria-live="polite">
    {selected.length > 20 && <p role="status">More than 20 events selected. Consider a shorter account; all selected events remain included.</p>}
    {hasDeparture && <p role="status">Narrative order departs from chronological order. Analyst placement is unchanged.</p>}
    {missingBuildup && <p role="status">Add context or buildup before the turning point.</p>}
    {incomplete > 0 && <p role="status">{incomplete} selected events need a narrative role or why-it-matters explanation.</p>}
  </div>

  if (editing) return <details className="rounded-lg border p-4" open>
    <summary className="cursor-pointer font-semibold">Narrative editor</summary>
    <p className="my-3 text-sm text-muted-foreground">Curate an account without changing the source extraction. Importance does not determine narrative role.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(([key, label]) => <div key={key} className={key === 'framing' ? 'sm:col-span-2' : ''}>
        <Label htmlFor={`narrative-${key}`}>{label}</Label>
        {key === 'framing' ? <Textarea id={`narrative-${key}`} maxLength={10000} value={narrative[key]} onChange={event => updateMetadata(key, event.target.value)} />
          : key === 'timezone' ? <Input key={narrative.timezone} id={`narrative-${key}`} defaultValue={narrative[key]} placeholder="UTC or America/New_York" maxLength={100} onBlur={event => updateMetadata(key, event.target.value.trim())} />
            : <Input id={`narrative-${key}`} type={key === 'dataThrough' ? 'date' : 'text'} maxLength={1000} value={narrative[key]} onChange={event => updateMetadata(key, event.target.value)} />}
      </div>)}
    </div>
    {metadataError && <p role="alert" className="text-sm text-red-600">{metadataError}</p>}
    <div className="my-4 space-y-3">
      <h3 className="font-semibold">Chapters</h3>
      {narrative.chapters.map(chapter => <fieldset key={chapter.id} className="space-y-2 rounded border p-3">
        <legend className="px-1">{chapter.title || 'Untitled chapter'}</legend>
        <Label htmlFor={`chapter-title-${chapter.id}`}>Chapter title</Label>
        <Input id={`chapter-title-${chapter.id}`} maxLength={1000} value={chapter.title} onChange={event => onNarrative({ ...narrative, chapters: narrative.chapters.map(item => item.id === chapter.id ? { ...item, title: event.target.value } : item) })} />
        <Label htmlFor={`chapter-claim-${chapter.id}`}>What changes in this chapter?</Label>
        <Textarea id={`chapter-claim-${chapter.id}`} maxLength={10000} value={chapter.claim} onChange={event => onNarrative({ ...narrative, chapters: narrative.chapters.map(item => item.id === chapter.id ? { ...item, claim: event.target.value } : item) })} />
        <Button variant="outline" onClick={() => {
          onNarrative({ ...narrative, chapters: narrative.chapters.filter(item => item.id !== chapter.id) })
          onEvents(events.map(event => event.chapterId === chapter.id ? { ...event, chapterId: undefined } : event))
        }}>Remove chapter {chapter.title}</Button>
      </fieldset>)}
      <Button variant="outline" disabled={narrative.chapters.length >= 100} onClick={() => onNarrative({ ...narrative, chapters: [...narrative.chapters, { id: `chapter-${crypto.randomUUID()}`, title: '', claim: '' }] })}>Add chapter</Button>
    </div>
    {warnings}
    <h3 className="my-3 font-semibold">Event selection · {selected.length} of {events.length}</h3>
    <div className="space-y-2">
      {events.map(event => <details key={event.id} data-testid={`narrative-edit-${event.id}`} className="rounded border p-3">
        <summary className="cursor-pointer">{event.narrativeIncluded ? 'Included' : 'Not selected'} · {event.title}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={!!event.narrativeIncluded} onChange={change => updateEvent(event.id, { narrativeIncluded: change.target.checked, ...(change.target.checked ? { narrativeOrder: Math.max(-1, ...selected.map(item => item.narrativeOrder ?? 0)) + 1 } : {}) })} />Include {event.title} in narrative</label>
          <div><Label htmlFor={`role-${event.id}`}>Narrative role</Label><select id={`role-${event.id}`} className={selectStyle} value={event.narrativeRole ?? ''} onChange={change => updateEvent(event.id, { narrativeRole: (change.target.value || undefined) as TimelineNarrativeRole | undefined })}><option value="">Choose a role</option>{roles.map(role => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select></div>
          <div><Label htmlFor={`chapter-${event.id}`}>Chapter</Label><select id={`chapter-${event.id}`} className={selectStyle} value={event.chapterId ?? ''} onChange={change => updateEvent(event.id, { chapterId: change.target.value || undefined })}><option value="">Unassigned</option>{narrative.chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title || 'Untitled chapter'}</option>)}</select></div>
          <div className="sm:col-span-2"><Label htmlFor={`why-${event.id}`}>Why it matters</Label><Textarea id={`why-${event.id}`} maxLength={10000} value={event.whyItMatters ?? ''} onChange={change => updateEvent(event.id, { whyItMatters: change.target.value })} /></div>
          <div className="sm:col-span-2"><Label htmlFor={`transition-${event.id}`}>Transition</Label><Textarea id={`transition-${event.id}`} maxLength={10000} value={event.transition ?? ''} onChange={change => updateEvent(event.id, { transition: change.target.value })} /></div>
        </div>
      </details>)}
    </div>
    <h3 className="my-3 font-semibold">Narrative order</h3>
    <ol className="space-y-2">{selected.map((event, index) => <li key={event.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{index + 1}. {event.title}</span><Button variant="outline" size="sm" disabled={index === 0} aria-label={`Move ${event.title} earlier in narrative`} onClick={() => move(event.id, -1)}>Earlier</Button><Button variant="outline" size="sm" disabled={index === selected.length - 1} aria-label={`Move ${event.title} later in narrative`} onClick={() => move(event.id, 1)}>Later</Button></li>)}</ol>
  </details>

  return <article aria-label="Narrative presentation" className="space-y-5 rounded-lg border p-4 sm:p-6">
    <header className="space-y-2">
      <h2 className="text-2xl font-semibold">{narrative.title || 'Untitled narrative'}</h2>
      <p>{narrative.framing || 'Framing has not been supplied.'}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">{fields.filter(([key]) => key !== 'title' && key !== 'framing').map(([key, label]) => <div key={key}><dt className="font-medium">{label}</dt><dd>{narrative[key] || 'Not supplied'}</dd></div>)}</dl>
      <p className="text-sm text-muted-foreground">{selected.length} selected events · {sourceUrl ? '1 extraction source; event support requires review' : 'Analyst-created; no extraction source'} · {openGapCount} open questions</p>
      <p className="text-sm text-muted-foreground">Chronological sequence alone does not establish causation, motive, or a forecast.</p>
    </header>
    {warnings}
    <nav aria-label="Narrative outline" className="rounded border p-3">
      <h3 className="font-semibold">Narrative outline</h3>
      {narrative.chapters.length === 0 && <p className="text-sm">No chapters yet.</p>}
      <ul className="space-y-2">{narrative.chapters.map(chapter => <li key={chapter.id}><a className="font-medium text-blue-600 underline" href={`#${timelineChapterAnchor(chapter.id)}`}>{chapter.title || 'Untitled chapter'}</a><p className="text-sm">{chapter.claim || 'Chapter claim not supplied.'}</p><ul className="ml-4 list-disc">{selected.filter(event => event.chapterId === chapter.id).map(event => <li key={event.id}><a className="text-sm text-blue-600 underline" href={`#narrative-${timelineEventAnchor(event.id)}`}>{event.title}</a></li>)}</ul></li>)}</ul>
      <ul className="mt-2 space-y-1">{selected.filter(event => !event.chapterId).map(event => <li key={event.id}><a className="text-sm text-blue-600 underline" href={`#narrative-${timelineEventAnchor(event.id)}`}>{event.title}</a></li>)}</ul>
    </nav>
    {selected.length === 0 && <p>No events selected. Return to Analyst view to curate the narrative.</p>}
    {narrative.chapters.filter(chapter => !selected.some(event => event.chapterId === chapter.id)).map(chapter => <section id={timelineChapterAnchor(chapter.id)} key={chapter.id} className="scroll-mt-4"><h3 className="font-semibold">{chapter.title || 'Untitled chapter'}</h3><p>{chapter.claim}</p><p className="text-sm text-muted-foreground">No selected events in this chapter.</p></section>)}
    <ol className="space-y-5">{selected.map(event => <li id={`narrative-${timelineEventAnchor(event.id)}`} key={event.id} className="scroll-mt-4 rounded border p-4">
      {narrative.chapters.filter(chapter => chapter.id === event.chapterId && selected.find(item => item.chapterId === chapter.id)?.id === event.id).map(chapter => <div id={timelineChapterAnchor(chapter.id)} key={chapter.id} className="mb-4 scroll-mt-4 border-b pb-3"><h4 className="font-semibold">{chapter.title || 'Untitled chapter'}</h4><p className="text-sm">{chapter.claim}</p></div>)}
      <p className="text-sm text-muted-foreground">{timelineEventTemporalLabel(event)} · {event.narrativeRole?.replace('_', ' ') || 'Role needed'} · {event.assessment}</p>
      <h3 className="mt-1 font-semibold">{event.title}</h3>
      {event.description && <p className="mt-2">{event.description}</p>}
      <p className="mt-2 text-sm"><strong>Why it matters:</strong> {event.whyItMatters || 'Explanation needed.'}</p>
      {event.transition && <p className="mt-2 text-sm">{event.transition}</p>}
      <a className="mt-3 inline-block text-sm text-blue-600 underline" href={`#${timelineEventAnchor(event.id)}`} onClick={click => { click.preventDefault(); onInspect(event.id) }}>Inspect evidence for {event.title}</a>
    </li>)}</ol>
  </article>
}
