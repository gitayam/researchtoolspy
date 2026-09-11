import type { TimelineWorkspaceExport } from '../types/timeline-workspace'
import { withTimelineNarrativeDefaults } from './timeline-workspace'

export const TIMELINE_IMPORT_MAX_BYTES = 4 * 1024 * 1024
const categories = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political']
const importance = ['low', 'normal', 'high', 'critical']
const roles = ['context', 'buildup', 'turning_point', 'response', 'consequence', 'resolution']
type RecordValue = Record<string, unknown>
function fail(path: string): never { throw new Error(`Invalid timeline JSON: ${path}.`) }
function object(value: unknown, path: string, keys: string[]): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path)
  const record = value as RecordValue
  if (Object.keys(record).some(key => !keys.includes(key))) fail(`${path} contains unsupported fields`)
  return record
}
function string(value: unknown, path: string, max = 10000): asserts value is string {
  if (typeof value !== 'string' || value.length > max) fail(path)
}
function optionalString(value: unknown, path: string, max = 10000) {
  if (value !== undefined) string(value, path, max)
}
function enumValue(value: unknown, options: string[], path: string) {
  if (typeof value !== 'string' || !options.includes(value)) fail(path)
}
function bool(value: unknown, path: string) { if (typeof value !== 'boolean') fail(path) }
function integer(value: unknown, path: string, max = 1000000) {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > max) fail(path)
}
function list(value: unknown, path: string, max = 1000): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(path)
  return value
}
function id(value: unknown, path: string): string {
  string(value, path, 200)
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) fail(path)
  return value
}
function url(value: unknown, path: string) {
  string(value, path, 4096)
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) fail(path)
  } catch { fail(`${path} must be an HTTP(S) URL without credentials`) }
}
function date(value: unknown, path: string) {
  string(value, path, 10)
  if (!/^\d{4}(-\d{2})?(-\d{2})?$/.test(value)) fail(path)
  const padded = value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value
  const parsed = new Date(`${padded}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== padded) fail(path)
}
function timestamp(value: unknown, path: string) {
  string(value, path, 64)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail(path)
  date(value.slice(0, 10), path)
}
function eventFields(record: RecordValue, path: string, extracted: boolean) {
  string(record.title, `${path}.title`, 1000)
  if (!record.title.trim()) fail(`${path}.title`)
  if (record.description !== null) string(record.description, `${path}.description`)
  enumValue(record.category, categories, `${path}.category`)
  enumValue(record.importance, importance, `${path}.importance`)
  if (extracted || record.eventDate !== undefined) date(record.eventDate, `${path}.eventDate`)
  if (extracted || record.datePrecision !== undefined) {
    enumValue(record.datePrecision, ['day', 'month', 'year'], `${path}.datePrecision`)
    if (typeof record.eventDate !== 'string' || record.eventDate.length !== ({ day: 10, month: 7, year: 4 }[record.datePrecision as 'day'])) fail(`${path}.datePrecision does not match date`)
  }
}
function extractedEvent(value: unknown, path: string) {
  const record = object(value, path, ['eventDate', 'datePrecision', 'title', 'description', 'category', 'importance'])
  eventFields(record, path, true)
}

/** Import is local, bounded and lossless for the supported v1 shape. Unknown fields fail closed. */
export function decodeTimelineWorkspace(text: string): TimelineWorkspaceExport {
  if (new TextEncoder().encode(text).byteLength > TIMELINE_IMPORT_MAX_BYTES) throw new Error('Timeline JSON must be 4 MiB or smaller.')
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('The selected file is not valid JSON.') }
  const root = object(parsed, 'document', ['schemaVersion', 'exportedAt', 'source', 'analystWorkspace'])
  enumValue(root.schemaVersion, ['timeline-workspace.v1'], 'schemaVersion')
  timestamp(root.exportedAt, 'exportedAt')
  const source = object(root.source, 'source', ['schemaVersion', 'title', 'requestId', 'outcome', 'article', 'events', 'extraction', 'model'])
  enumValue(source.schemaVersion, ['timeline-manual.v1', 'timeline-analysis.v1'], 'source.schemaVersion')
  let title: string
  if (source.schemaVersion === 'timeline-manual.v1') {
    object(source, 'manual source', ['schemaVersion', 'title'])
    string(source.title, 'source.title', 1000)
    title = source.title
  } else {
    object(source, 'extracted source', ['schemaVersion', 'requestId', 'outcome', 'article', 'events', 'extraction', 'model'])
    id(source.requestId, 'source.requestId')
    enumValue(source.outcome, ['events', 'no_events'], 'source.outcome')
    const article = object(source.article, 'source.article', ['url', 'title', 'domain', 'publishedAt'])
    url(article.url, 'source.article.url')
    string(article.title, 'source.article.title', 1000)
    title = article.title
    string(article.domain, 'source.article.domain', 1000)
    optionalString(article.publishedAt, 'source.article.publishedAt', 200)
    const events = list(source.events, 'source.events', 100)
    events.forEach((event, index) => extractedEvent(event, `source.events[${index}]`))
    if ((source.outcome === 'events') !== (events.length > 0)) fail('source.outcome/event count mismatch')
    const extraction = object(source.extraction, 'source.extraction', ['contentSource', 'sourceMode', 'method', 'wordCount', 'quality', 'fallbackAttempts'])
    string(extraction.contentSource, 'extraction.contentSource', 1000)
    enumValue(extraction.sourceMode, ['live', 'supplied', 'archive', 'provider'], 'extraction.sourceMode')
    optionalString(extraction.method, 'extraction.method', 1000)
    integer(extraction.wordCount, 'extraction.wordCount', 100000000)
    list(extraction.fallbackAttempts, 'extraction.fallbackAttempts', 100).forEach(value => string(value, 'fallback attempt', 1000))
    const quality = object(extraction.quality, 'quality', ['version', 'score', 'accepted', 'reason'])
    string(quality.version, 'quality.version', 1000)
    if (typeof quality.score !== 'number' || !Number.isFinite(quality.score) || quality.score < 0 || quality.score > 100) fail('quality.score')
    bool(quality.accepted, 'quality.accepted')
    optionalString(quality.reason, 'quality.reason')
    const model = object(source.model, 'source.model', ['name', 'status', 'rejectedEventCount'])
    string(model.name, 'model.name', 1000)
    enumValue(model.status, ['ok', 'no_events'], 'model.status')
    if ((model.status === 'ok') !== (events.length > 0)) fail('model.status/event count mismatch')
    integer(model.rejectedEventCount, 'model.rejectedEventCount')
  }
  const workspace = object(root.analystWorkspace, 'analystWorkspace', ['mode', 'events', 'questions', 'hypotheses', 'narrative', 'presentation', 'sortDirection'])
  enumValue(workspace.mode, ['basic', 'robust'], 'workspace.mode')
  if (workspace.presentation !== undefined) enumValue(workspace.presentation, ['analyst', 'narrative'], 'workspace.presentation')
  if (workspace.sortDirection !== undefined) enumValue(workspace.sortDirection, ['oldest', 'latest'], 'workspace.sortDirection')
  const chapters = new Set<string>()
  if (workspace.narrative !== undefined) {
    const narrative = object(workspace.narrative, 'narrative', ['title', 'framing', 'question', 'intendedUse', 'scope', 'timezone', 'dataThrough', 'chapters'])
    for (const field of ['title', 'framing', 'question', 'intendedUse', 'scope', 'timezone', 'dataThrough']) string(narrative[field], `narrative.${field}`)
    if (narrative.timezone) {
      try { new Intl.DateTimeFormat('en', { timeZone: narrative.timezone as string }) } catch { fail('narrative.timezone') }
    }
    if (narrative.dataThrough) date(narrative.dataThrough, 'narrative.dataThrough')
    list(narrative.chapters, 'narrative.chapters', 100).forEach(value => {
      const chapter = object(value, 'chapter', ['id', 'title', 'claim'])
      const chapterId = id(chapter.id, 'chapter.id')
      if (chapters.has(chapterId)) fail('duplicate chapter ID')
      chapters.add(chapterId)
      string(chapter.title, 'chapter.title', 1000)
      string(chapter.claim, 'chapter.claim')
    })
  }
  const ids = new Set<string>()
  const workspaceEvents = list(workspace.events, 'workspace.events')
  workspaceEvents.forEach((value, index) => {
    const path = `workspace.events[${index}]`
    const event = object(value, path, ['id', 'eventDate', 'eventTime', 'datePrecision', 'title', 'description', 'category', 'importance', 'origin', 'assessment', 'analystNote', 'modified', 'sequenceOrder', 'placement', 'original', 'narrativeIncluded', 'narrativeRole', 'whyItMatters', 'transition', 'chapterId', 'narrativeOrder'])
    const eventId = id(event.id, `${path}.id`)
    if (ids.has(eventId)) fail('duplicate event ID')
    ids.add(eventId)
    eventFields(event, path, false)
    if (event.eventTime !== undefined && (typeof event.eventTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(event.eventTime))) fail(`${path}.eventTime`)
    enumValue(event.origin, ['source', 'analyst'], `${path}.origin`)
    enumValue(event.assessment, ['unreviewed', 'corroborated', 'disputed', 'hypothesis'], `${path}.assessment`)
    string(event.analystNote, `${path}.analystNote`)
    bool(event.modified, `${path}.modified`)
    for (const field of ['sequenceOrder', 'narrativeOrder']) if (event[field] !== undefined) integer(event[field], `${path}.${field}`)
    if (event.original !== undefined) extractedEvent(event.original, `${path}.original`)
    if (event.narrativeIncluded !== undefined) bool(event.narrativeIncluded, `${path}.narrativeIncluded`)
    if (event.narrativeRole !== undefined) enumValue(event.narrativeRole, roles, `${path}.narrativeRole`)
    optionalString(event.whyItMatters, `${path}.whyItMatters`)
    optionalString(event.transition, `${path}.transition`)
    if (event.chapterId !== undefined && !chapters.has(id(event.chapterId, `${path}.chapterId`))) fail(`${path}.chapterId is missing`)
  })
  function reference(value: unknown, path: string) {
    if (value !== undefined && !ids.has(id(value, path))) fail(`${path} refers to a missing event`)
  }
  workspaceEvents.forEach(value => {
    const event = value as RecordValue
    if (event.placement !== undefined) {
      const placement = object(event.placement, 'placement', ['mode', 'relation', 'anchorEventId', 'position'])
      enumValue(placement.mode, ['absolute', 'relative', 'position'], 'placement.mode')
      if (placement.mode === 'absolute') object(placement, 'absolute placement', ['mode'])
      if (placement.mode === 'relative') {
        object(placement, 'relative placement', ['mode', 'relation', 'anchorEventId'])
        enumValue(placement.relation, ['before', 'after'], 'placement.relation')
        id(placement.anchorEventId, 'placement.anchorEventId')
        reference(placement.anchorEventId, 'placement.anchorEventId')
        if (placement.anchorEventId === event.id) fail('self-referencing placement')
      }
      if (placement.mode === 'position') {
        object(placement, 'numbered placement', ['mode', 'position'])
        integer(placement.position, 'placement.position')
        if (Number(placement.position) < 1) fail('placement.position')
      }
    }
  })
  for (const kind of ['questions', 'hypotheses']) {
    const itemIds = new Set<string>()
    list(workspace[kind], `workspace.${kind}`).forEach(value => {
      const item = object(value, kind, kind === 'questions'
        ? ['id', 'afterEventId', 'beforeEventId', 'question', 'status', 'answer', 'sources']
        : ['id', 'afterEventId', 'beforeEventId', 'hypothesis', 'rationale', 'origin'])
      const itemId = id(item.id, `${kind}.id`)
      if (itemIds.has(itemId)) fail(`duplicate ${kind} ID`)
      itemIds.add(itemId)
      reference(item.afterEventId, `${kind}.afterEventId`)
      reference(item.beforeEventId, `${kind}.beforeEventId`)
      if (kind === 'questions') {
        string(item.question, 'question')
        string(item.answer, 'answer')
        enumValue(item.status, ['open', 'answered'], 'question.status')
        if (item.sources !== undefined) {
          const sourceIds = new Set<string>()
          list(item.sources, 'question.sources', 100).forEach(value => {
            const source = object(value, 'question source', ['id', 'url', 'title'])
            const sourceId = id(source.id, 'question source.id')
            if (sourceIds.has(sourceId)) fail('duplicate question source ID')
            sourceIds.add(sourceId)
            url(source.url, 'question source.url')
            optionalString(source.title, 'question source.title', 1000)
          })
        }
      } else {
        string(item.hypothesis, 'hypothesis')
        string(item.rationale, 'rationale')
        enumValue(item.origin, ['ai'], 'hypothesis.origin')
      }
    })
  }
  const result = parsed as TimelineWorkspaceExport
  const restored = { ...result, analystWorkspace: withTimelineNarrativeDefaults(result.analystWorkspace, title) }
  if (new TextEncoder().encode(JSON.stringify(restored, null, 2)).byteLength > TIMELINE_IMPORT_MAX_BYTES) throw new Error('The restored timeline exceeds the 4 MiB limit. Reduce its content before importing.')
  return restored
}
