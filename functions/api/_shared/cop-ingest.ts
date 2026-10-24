/**
 * Evidence-form submissions → COP items.
 *
 * A submission to a form (survey_drops) linked to a COP becomes:
 *   - one unverified evidence item: the form's answers as text (form fields only;
 *     never the submitter's name, contact or network location), the form's URL
 *     field as source_url, its images stored as COP uploads (identifying metadata
 *     stripped; for a drop-form tip — keep_photo_location on its row — the team's copy
 *     keeps a photo's GPS position and capture time, which that form tells the tipster
 *     before they submit; every other row is fully stripped);
 *   - a POSSIBLE marker, only when the form has an explicit location (geopoint)
 *     field. The response's own lat/lon columns are never mapped: on the survey
 *     path they can be the submitter's IP-derived position;
 *   - a POSSIBLE "Photo location" marker when its first photo with a valid GPS
 *     position has one (cop-photo-location.ts: the team's only until confirmed);
 *   - the form's auto_tag_category as a tag (source 'drop').
 *
 * Auto-ingest (survey_drops.auto_ingest, default on) does this at once, capped per
 * form per hour so a flood stays in the review inbox. Accepting in the inbox or
 * "push to COP" does the same on demand. The claim (linked_evidence_id set from
 * NULL in one UPDATE) makes a double submit, a retry or two reviewers clicking at
 * once produce one evidence item.
 */
import { deleteLinksOf, fileTipUnderChosenQuestions, linksTableMissing } from './cop-evidence-links'
import { applyItemTags, cleanTagName, dropItemTags, tagsTableMissing } from './cop-tags'
import { emitCopEventLoose } from './cop-events-loose'
import { queryEvidenceInSession, UNTITLED_TIP_TITLE } from './cop-input'
import { columnMissing, copSessionScope, insertCopEvidence, insertCopMarker } from './cop-records'
import { cleanFile, copUploadPath, storeCopUpload, uploadObjectKeys, type R2Like, type StoredLocation } from './cop-uploads'
import { IMAGE_TYPES, type SniffedType } from './image-sanitize'
import { PHOTO_GPS_SOURCE, placePhotoMarkerQuietly } from './cop-photo-location'

export const AUTO_INGEST_PER_HOUR = 30
const MAX_FILES = 5

export interface FormField {
  name: string
  type: string
  label: string
  /** The form marks this field as its summary: a tip may be titled from it (text or long text only). */
  summary?: boolean
}

export function parseFormSchema(raw: unknown): FormField[] {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(parsed)) return []
  const out: FormField[] = []
  for (const f of parsed) {
    if (!f || typeof f !== 'object') continue
    const field = f as Record<string, unknown>
    if (typeof field.name !== 'string' || !field.name) continue
    out.push({
      name: field.name,
      type: typeof field.type === 'string' ? field.type : 'text',
      label: typeof field.label === 'string' && field.label.trim() ? field.label.trim() : field.name,
      ...(field.summary === true ? { summary: true } : {}),
    })
  }
  return out
}

function oneLine(value: unknown, max: number): string {
  // eslint-disable-next-line no-control-regex
  return String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.length > 2000) return null
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/** The form's URL field (the first url-type answer that is an http(s) link). */
export function sourceUrlFrom(formData: Record<string, unknown>, schema: FormField[]): string | null {
  for (const field of schema) {
    if (field.type !== 'url') continue
    const url = httpUrl(formData[field.name])
    if (url) return url
  }
  return null
}

/** An explicit location field's coordinates ("lat,lon", or the `<name>_lat`/`_lon` pair). */
export function geopointFrom(formData: Record<string, unknown>, schema: FormField[]): { lat: number; lon: number; field: string } | null {
  for (const field of schema) {
    if (field.type !== 'geopoint') continue
    let lat = Number(formData[`${field.name}_lat`])
    let lon = Number(formData[`${field.name}_lon`])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const parts = String(formData[field.name] ?? '').split(',')
      if (parts.length !== 2) continue
      lat = Number(parts[0].trim())
      lon = Number(parts[1].trim())
    }
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)) {
      return { lat, lon, field: field.label }
    }
  }
  return null
}

const DATA_URL = /^data:([a-z0-9.+/-]+)?(;[a-z0-9=.+-]+)*;base64,([A-Za-z0-9+/=\s]+)$/i

export function decodeDataUrl(value: unknown): Uint8Array | null {
  if (typeof value !== 'string' || !value.startsWith('data:')) return null
  const match = DATA_URL.exec(value)
  if (!match) return null
  try {
    const binary = atob(match[3].replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function encodeDataUrl(type: string, bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${type};base64,${btoa(binary)}`
}

/** File answers carried inline as data: URLs. */
export function fileAnswers(formData: Record<string, unknown>, schema: FormField[]): { field: FormField; value: string }[] {
  return schema
    .filter((f) => f.type === 'file' && typeof formData[f.name] === 'string' && String(formData[f.name]).startsWith('data:'))
    .map((field) => ({ field, value: String(formData[field.name]) }))
}

/**
 * Before a submission is stored: type every inline file from its bytes and strip
 * image metadata, so the response row never holds it. A file that isn't an accepted
 * type, or an image that can't be parsed, refuses the submission with a message for
 * the submitter.
 *
 * `keepLocation` (the drop form, whose notice says so before submit): an image is
 * stored as the TEAM copy — GPS position, capture time and Orientation kept, every
 * other identifying block removed. Without it (surveys, intake forms) nothing but
 * Orientation stays. No public route returns the answers themselves (the public
 * results route gives ordinary surveys' totals only).
 */
export async function sanitizeFormDataFiles(
  formData: Record<string, unknown>,
  schema: FormField[],
  options: { keepLocation?: boolean } = {},
): Promise<{ ok: true; formData: Record<string, unknown>; error?: undefined } | { ok: false; error: string; formData?: undefined }> {
  const files = fileAnswers(formData, schema)
  if (files.length === 0) return { ok: true, formData }
  const next = { ...formData }
  for (const { field, value } of files) {
    const bytes = decodeDataUrl(value)
    if (!bytes) return { ok: false, error: `The file in "${field.label}" could not be read.` }
    // Images and PDFs only: anonymous submitters never add documents or audio.
    const clean = await cleanFile(bytes, { keepLocation: options.keepLocation === true })
    if (clean.ok === false) return { ok: false, error: `The file in "${field.label}" was not accepted: ${clean.error}` }
    next[field.name] = encodeDataUrl(clean.type, clean.teamBytes ?? clean.bytes)
    next[`${field.name}_type`] = clean.type
  }
  return { ok: true, formData: next }
}

const HELPER_SUFFIX = /_(?:raw|resolving|format|precision|mgrs|lat|lon|name|type)$/

/** The answers as "Label: value" lines, in form order. Files and helper keys are summarised, not copied. */
export function describeSubmission(formData: Record<string, unknown>, schema: FormField[]): string {
  const lines: string[] = []
  const named = new Set(schema.map((f) => f.name))
  for (const field of schema) {
    const value = formData[field.name]
    if (value === undefined || value === null || value === '') continue
    if (field.type === 'file') {
      const name = oneLine(formData[`${field.name}_name`], 80)
      lines.push(`${field.label}: (file attached${name ? `: ${name}` : ''})`)
      continue
    }
    const text = Array.isArray(value) ? value.map((v) => oneLine(v, 200)).join(', ') : oneLine(value, 1000)
    if (text && !text.startsWith('data:')) lines.push(`${field.label}: ${text}`)
  }
  // Answers to fields the schema doesn't list (older forms), skipping helper keys.
  for (const [key, value] of Object.entries(formData)) {
    if (named.has(key) || HELPER_SUFFIX.test(key) || key.startsWith('cf-') || key.startsWith('_')) continue
    const text = oneLine(value, 500)
    if (text && !text.startsWith('data:')) lines.push(`${oneLine(key, 60)}: ${text}`)
  }
  return lines.join('\n').slice(0, 5000) || '(no answers)'
}

/** Characters of a tip's answer kept in its title (after the "Tip: " prefix). */
const TIP_TITLE_MAX = 100

/**
 * A tip's title comes from an allow-list of fields, never a word list: the field the form
 * marks as its summary (`summary: true`, a text or long-text field), else its first
 * long-text (textarea) answer. A short single-line field never names a tip: those are
 * where forms ask for a name, handle, callsign, unit, phone, grid or place, in any
 * language ("Your handle", "Callsign", "Reach me at", "MGRS grid", "Nombre", "Kontakt"),
 * and titles travel into the COP's lists and its linked Signal rooms.
 *
 * `safe` says the title came from such a field; ingest records it in the evidence's
 * metadata (`title_safe`), and the chat feed shows a drop-form tip's title only with it.
 * With no such answer: UNTITLED_TIP_TITLE, not safe.
 */
export function tipTitle(formData: Record<string, unknown>, schema: FormField[]): { title: string; safe: boolean } {
  const answer = (field: FormField): string => {
    const value = formData[field.name]
    if (typeof value !== 'string' || value.trim().startsWith('data:')) return ''
    return oneLine(value, TIP_TITLE_MAX)
  }
  const summaries = schema.filter((f) => f.summary === true && (f.type === 'text' || f.type === 'textarea'))
  const longText = schema.filter((f) => f.type === 'textarea')
  for (const field of [...summaries, ...longText]) {
    const text = answer(field)
    if (text) return { title: `Tip: ${text}`, safe: true }
  }
  return { title: UNTITLED_TIP_TITLE, safe: false }
}

// ── Ingest ─────────────────────────────────────────────────────────────────

export interface IngestEnv {
  DB: D1Database
  UPLOADS?: R2Like
}

export type IngestResult =
  | { ok: true; created: boolean; evidenceId: string; markerId: string | null; status?: undefined; error?: undefined }
  | { ok: false; status: number; error: string; created?: undefined; evidenceId?: undefined; markerId?: undefined }

interface ResponseRow {
  id: string
  survey_id: string
  form_data: string | null
  cop_session_id: string | null
  linked_evidence_id: string | null
  linked_marker_id?: string | null
  auto_ingested?: number | null
  ingested_evidence_id?: string | null
  /** 1: stored by drop-submit, whose form said photos keep where and when they were taken. */
  keep_photo_location?: number | null
}

const RESPONSE_BASE = 'id, survey_id, form_data, cop_session_id, linked_evidence_id'
const RESPONSE_0023 = `${RESPONSE_BASE}, linked_marker_id, auto_ingested, ingested_evidence_id`

async function loadResponse(db: D1Database, responseId: string, sessionId: string): Promise<ResponseRow | null> {
  const select = (columns: string) => db.prepare(`
      SELECT ${columns}
      FROM survey_responses WHERE id = ? AND cop_session_id = ?
    `).bind(responseId, sessionId).first<ResponseRow>()
  try {
    return await select(`${RESPONSE_0023}, keep_photo_location`)
  } catch (error) {
    if (!columnMissing(error, 'keep_photo_location')) {
      if (!columnMissing(error, 'linked_marker_id') && !columnMissing(error, 'auto_ingested') && !columnMissing(error, 'ingested_evidence_id')) throw error
      return select(RESPONSE_BASE)
    }
  }
  // Before managed migration 0029 no row records consent: nothing keeps a location.
  try {
    return await select(RESPONSE_0023)
  } catch (error) {
    if (!columnMissing(error, 'linked_marker_id') && !columnMissing(error, 'auto_ingested') && !columnMissing(error, 'ingested_evidence_id')) throw error
    return select(RESPONSE_BASE)
  }
}

const CLAIM_PREFIX = 'claim:'

/**
 * Create the COP items for one submission, once. `actorUserId` is the reviewer
 * (null for auto-ingest, which acts as the form's owner).
 */
export async function ingestSubmission(
  env: IngestEnv,
  input: { responseId: string; sessionId: string; actorUserId: number | null; auto: boolean },
): Promise<IngestResult> {
  const { DB: db } = env
  const response = await loadResponse(db, input.responseId, input.sessionId)
  if (!response) return { ok: false, status: 404, error: 'Submission not found' }
  if (response.linked_evidence_id && !response.linked_evidence_id.startsWith(CLAIM_PREFIX)) {
    return { ok: true, created: false, evidenceId: response.linked_evidence_id, markerId: response.linked_marker_id ?? null }
  }
  const form = await db.prepare('SELECT id, title, form_schema, auto_tag_category, created_by FROM survey_drops WHERE id = ?')
    .bind(response.survey_id).first<{ id: string; title: string | null; form_schema: string | null; auto_tag_category: string | null; created_by: number }>()
  if (!form) return { ok: false, status: 404, error: 'Form not found' }
  const scope = await copSessionScope(db, input.sessionId)
  if (!scope) return { ok: false, status: 404, error: 'COP session not found' }
  if (scope.archived) return { ok: false, status: 410, error: 'This COP session is archived' }

  const claim = `${CLAIM_PREFIX}${crypto.randomUUID()}`
  const claimed = await db.prepare(
    'UPDATE survey_responses SET linked_evidence_id = ? WHERE id = ? AND cop_session_id = ? AND linked_evidence_id IS NULL'
  ).bind(claim, input.responseId, input.sessionId).run()
  if (!claimed.meta?.changes) {
    const now = await loadResponse(db, input.responseId, input.sessionId)
    if (now?.linked_evidence_id && !now.linked_evidence_id.startsWith(CLAIM_PREFIX)) {
      return { ok: true, created: false, evidenceId: now.linked_evidence_id, markerId: now.linked_marker_id ?? null }
    }
    return { ok: false, status: 409, error: 'This submission is already being added to the COP' }
  }

  const actor = input.actorUserId ?? form.created_by
  let formData: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(response.form_data || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) formData = parsed
  } catch { /* an unreadable row still becomes a (bare) evidence item */ }
  const schema = parseFormSchema(form.form_schema)
  const tip = tipTitle(formData, schema)

  let evidenceId: string
  const uploadIds: string[] = []
  let photoLocation: StoredLocation | null = null
  try {
    // Inline files: stored as COP uploads (already cleaned at submit time; cleaned again
    // here). A photo keeps where and when it was taken (team copy, marker) only when the
    // row says its form told the submitter so (drop-submit, keep_photo_location = 1);
    // surveys, intake forms and older rows are fully stripped.
    const keepLocation = Number(response.keep_photo_location) === 1
    if (env.UPLOADS) {
      for (const { value } of fileAnswers(formData, schema).slice(0, MAX_FILES)) {
        const bytes = decodeDataUrl(value)
        if (!bytes) continue
        // documents stays off: a submitter's file is an image or a PDF, never more.
        const stored = await storeCopUpload({ DB: db, UPLOADS: env.UPLOADS }, {
          sessionId: input.sessionId, bytes, originalName: null, createdBy: actor, sourceChannel: 'drop', keepLocation,
        })
        if (stored.ok) {
          uploadIds.push(stored.row.id)
          photoLocation ??= stored.location
        }
      }
    }
    let imageUpload: string | null = null
    if (uploadIds.length > 0) {
      const first = await db.prepare('SELECT id, content_type FROM cop_uploads WHERE id = ?').bind(uploadIds[0]).first<{ id: string; content_type: string }>()
      if (first && IMAGE_TYPES.has(first.content_type as SniffedType)) imageUpload = first.id
    }
    const sourceUrl = sourceUrlFrom(formData, schema) ?? (imageUpload ? copUploadPath(input.sessionId, imageUpload) : null)
    evidenceId = await insertCopEvidence(db, scope, {
      title: tip.title,
      description: describeSubmission(formData, schema),
      sourceUrl,
      evidenceType: imageUpload ? 'image' : uploadIds.length > 0 ? 'document' : 'observation',
      credibility: 'unverified',
      sourceName: 'Evidence form',
      sourceChannel: 'drop',
      // title_safe: the title came from the form's summary or long-text answer (tipTitle).
      metadata: { survey_id: form.id, response_id: input.responseId, upload_ids: uploadIds, auto_ingested: input.auto, title_safe: tip.safe },
      createdBy: actor,
    })
  } catch (error) {
    await db.prepare('UPDATE survey_responses SET linked_evidence_id = NULL WHERE id = ? AND linked_evidence_id = ?')
      .bind(input.responseId, claim).run()
    throw error
  }

  if (uploadIds.length > 0) {
    await db.prepare(`UPDATE cop_uploads SET evidence_id = ? WHERE cop_session_id = ? AND id IN (${uploadIds.map(() => '?').join(',')})`)
      .bind(evidenceId, input.sessionId, ...uploadIds).run()
  }

  let markerId: string | null = null
  const point = geopointFrom(formData, schema)
  if (point) {
    try {
      markerId = await insertCopMarker(db, scope, {
        lat: point.lat,
        lon: point.lon,
        label: tip.title.slice(0, 80),
        description: `From the evidence form (${point.field}). Unverified.`,
        confidence: 'POSSIBLE',
        rationale: 'Location given in an evidence-form submission; not verified.',
        sourceType: 'EVIDENCE',
        sourceId: evidenceId,
        sourceChannel: 'drop',
        createdBy: actor,
      })
    } catch (error) {
      console.error('[cop-ingest] marker not created:', error instanceof Error ? error.message : error)
    }
  }
  // Where its photo says it was taken: the team's only until an editor confirms it.
  if (photoLocation) {
    await placePhotoMarkerQuietly(db, scope, { evidenceId, location: photoLocation, sourceChannel: 'drop', createdBy: actor })
  }

  // The questions the tipster picked, as drop-submit checked them (migrations 0024, 0026).
  try {
    await fileTipUnderChosenQuestions(db, {
      formId: form.id,
      responseId: input.responseId,
      scope: { sessionId: input.sessionId, workspaceId: scope.workspaceId },
      evidenceId,
      formData,
      actorUserId: actor,
    })
  } catch (error) {
    if (!linksTableMissing(error)) console.error('[cop-ingest] tip not filed under its question:', error instanceof Error ? error.message : error)
  }

  const tag = cleanTagName(form.auto_tag_category ?? '')
  if (tag) {
    try {
      await applyItemTags(db, { sessionId: input.sessionId, targetType: 'evidence', targetId: evidenceId, names: [tag], source: 'drop', actorUserId: actor })
      if (markerId) {
        await applyItemTags(db, { sessionId: input.sessionId, targetType: 'marker', targetId: markerId, names: [tag], source: 'drop', actorUserId: actor })
      }
    } catch (error) {
      if (!tagsTableMissing(error)) console.error('[cop-ingest] tag not applied:', error instanceof Error ? error.message : error)
    }
  }

  const now = new Date().toISOString()
  try {
    await db.prepare(`
      UPDATE survey_responses
      SET linked_evidence_id = ?, linked_marker_id = ?, auto_ingested = ?, ingested_evidence_id = ?,
          status = 'accepted', triaged_by = ?, updated_at = ?
      WHERE id = ? AND linked_evidence_id = ?
    `).bind(evidenceId, markerId, input.auto ? 1 : 0, input.auto ? evidenceId : null, input.actorUserId, now, input.responseId, claim).run()
  } catch (error) {
    if (!columnMissing(error, 'linked_marker_id') && !columnMissing(error, 'auto_ingested') && !columnMissing(error, 'ingested_evidence_id')) throw error
    await db.prepare(`
      UPDATE survey_responses SET linked_evidence_id = ?, status = 'accepted', triaged_by = ?, updated_at = ?
      WHERE id = ? AND linked_evidence_id = ?
    `).bind(evidenceId, input.actorUserId, now, input.responseId, claim).run()
  }

  await emitCopEventLoose(db, {
    copSessionId: input.sessionId,
    eventType: 'ingest.submission_triaged',
    entityType: 'submission',
    entityId: input.responseId,
    payload: { status: 'accepted', linked_evidence_id: evidenceId, linked_marker_id: markerId, auto: input.auto },
    createdBy: actor,
  })
  return { ok: true, created: true, evidenceId, markerId }
}

/**
 * Auto-ingest a submission just stored for a form linked to a COP. Returns the
 * created ids, or null when the form doesn't auto-ingest, its creator is not (or no
 * longer) the session's owner or an editor/admin, the hourly cap is reached, or the
 * schema predates migration 0023.
 *
 * The creator check is in the SQL itself: a form pointed at someone else's COP
 * (however the link was written) never files anything there. The cap is a slot
 * taken atomically per form and UTC hour, so concurrent tips can't pass it together;
 * tips beyond it are stored and wait in the review inbox.
 */
export async function autoIngestSubmission(
  env: IngestEnv,
  input: { formId: string; responseId: string; sessionId: string },
): Promise<{ evidence_id: string; marker_id: string | null } | null> {
  const { DB: db } = env
  let enabled: { auto_ingest: number | null } | null
  try {
    enabled = await db.prepare(`
      SELECT d.auto_ingest FROM survey_drops d
      JOIN cop_sessions s ON s.id = d.cop_session_id
      WHERE d.id = ? AND d.cop_session_id = ?
        AND (
          s.created_by = d.created_by
          OR EXISTS (
            SELECT 1 FROM cop_collaborators c
            WHERE c.cop_session_id = s.id AND c.user_id = d.created_by
              AND lower(trim(c.role)) IN ('editor', 'admin')
          )
        )
    `).bind(input.formId, input.sessionId).first<{ auto_ingest: number | null }>()
  } catch (error) {
    if (columnMissing(error, 'auto_ingest')) return null
    throw error
  }
  if (!enabled || Number(enabled.auto_ingest) !== 1) return null
  if (!(await takeIngestSlot(db, input.formId))) return null

  const result = await ingestSubmission(env, { responseId: input.responseId, sessionId: input.sessionId, actorUserId: null, auto: true })
  return result.ok ? { evidence_id: result.evidenceId, marker_id: result.markerId } : null
}

/** One of this form's AUTO_INGEST_PER_HOUR slots for the current UTC hour, taken in one statement. */
async function takeIngestSlot(db: D1Database, formId: string): Promise<boolean> {
  const hour = new Date().toISOString().slice(0, 13)
  try {
    const slot = await db.prepare(`
      INSERT INTO survey_drop_ingest_slots (survey_id, hour, n) VALUES (?, ?, 1)
      ON CONFLICT (survey_id, hour) DO UPDATE SET n = n + 1 WHERE n < ?
      RETURNING n
    `).bind(formId, hour, AUTO_INGEST_PER_HOUR).first<{ n: number }>()
    return Boolean(slot)
  } catch (error) {
    // Before migration 0023 there is no slot table: nothing is auto-ingested.
    if (/no such table:\s*(?:main\.)?survey_drop_ingest_slots/i.test(String(error instanceof Error ? error.message : error))) return false
    throw error
  }
}

/**
 * A reviewer rejected an auto-ingested submission: take back exactly what auto-ingest
 * created for it (the evidence recorded in ingested_evidence_id, its uploads and tags,
 * and the marker pointing at that evidence), and nothing else: not evidence the
 * submission was later linked to, not anything outside the COP. Items a person
 * accepted are left alone.
 */
export async function retractAutoIngest(
  env: IngestEnv,
  input: { responseId: string; sessionId: string; actorUserId: number },
): Promise<boolean> {
  const { DB: db } = env
  const response = await loadResponse(db, input.responseId, input.sessionId)
  if (!response || Number(response.auto_ingested) !== 1) return false
  const scope = await copSessionScope(db, input.sessionId)
  if (!scope) return false
  const evidenceId = response.ingested_evidence_id ?? null

  if (evidenceId) {
    // Both copies of each file (the public one and the team's).
    for (const upload of await uploadObjectKeys(db, input.sessionId, evidenceId)) {
      await db.prepare("UPDATE cop_uploads SET archived_at = ? WHERE id = ? AND cop_session_id = ?")
        .bind(new Date().toISOString(), upload.id, input.sessionId).run()
      for (const key of upload.keys) await env.UPLOADS?.delete?.(key).catch(() => {})
      await dropItemTags(db, input.sessionId, 'upload', upload.id)
    }
    // Only the item ingest wrote for this submission, and only within the COP.
    const removed = await queryEvidenceInSession(
      db,
      `DELETE FROM evidence_items
       WHERE CAST(id AS TEXT) = ?
         AND (CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.response_id') END) = ?
         AND {EVIDENCE_SCOPE}`,
      { sessionId: input.sessionId, workspaceId: scope.workspaceId },
      [evidenceId, input.responseId],
      [],
      (statement) => statement.run(),
    )
    if (removed.meta?.changes) {
      await dropItemTags(db, input.sessionId, 'evidence', evidenceId)
      // Its filings under questions go with it (else they'd linger as orphans).
      await deleteLinksOf(db, input.sessionId, { evidenceId })
      await emitCopEventLoose(db, {
        copSessionId: input.sessionId, eventType: 'evidence.deleted', entityType: 'evidence', entityId: evidenceId,
        payload: { reason: 'submission_rejected' }, createdBy: input.actorUserId,
      })
    }
    // The marker ingest placed for that evidence.
    if (response.linked_marker_id) {
      const gone = await db.prepare(
        "DELETE FROM cop_markers WHERE id = ? AND cop_session_id = ? AND source_type = 'EVIDENCE' AND source_id = ?"
      ).bind(response.linked_marker_id, input.sessionId, evidenceId).run()
      if (gone.meta?.changes) {
        await db.prepare('DELETE FROM cop_marker_changelog WHERE marker_id = ? AND cop_session_id = ?').bind(response.linked_marker_id, input.sessionId).run().catch(() => {})
        await dropItemTags(db, input.sessionId, 'marker', response.linked_marker_id)
        await emitCopEventLoose(db, {
          copSessionId: input.sessionId, eventType: 'marker.deleted', entityType: 'marker', entityId: response.linked_marker_id,
          payload: { reason: 'submission_rejected' }, createdBy: input.actorUserId,
        })
      }
    }
    // The photo-location marker ingest placed for that evidence (unless an editor confirmed it).
    const photoMarkers = await db.prepare(
      "SELECT id FROM cop_markers WHERE cop_session_id = ? AND source_type = ? AND source_id = ? AND (confidence IS NULL OR confidence != 'CONFIRMED')"
    ).bind(input.sessionId, PHOTO_GPS_SOURCE, evidenceId).all<{ id: string }>()
    for (const marker of photoMarkers.results ?? []) {
      const gone = await db.prepare('DELETE FROM cop_markers WHERE id = ? AND cop_session_id = ? AND source_type = ? AND source_id = ?')
        .bind(marker.id, input.sessionId, PHOTO_GPS_SOURCE, evidenceId).run()
      if (!gone.meta?.changes) continue
      await db.prepare('DELETE FROM cop_marker_changelog WHERE marker_id = ? AND cop_session_id = ?').bind(marker.id, input.sessionId).run().catch(() => {})
      await dropItemTags(db, input.sessionId, 'marker', marker.id)
      await emitCopEventLoose(db, {
        copSessionId: input.sessionId, eventType: 'marker.deleted', entityType: 'marker', entityId: marker.id,
        payload: { reason: 'submission_rejected' }, createdBy: input.actorUserId,
      })
    }
  }
  // A link a reviewer made to other evidence stays; the link to what was removed goes.
  await db.prepare(`
    UPDATE survey_responses
    SET linked_evidence_id = CASE WHEN linked_evidence_id = ? THEN NULL ELSE linked_evidence_id END,
        linked_marker_id = NULL, auto_ingested = 0, ingested_evidence_id = NULL
    WHERE id = ? AND cop_session_id = ?
  `).bind(evidenceId, input.responseId, input.sessionId).run()
  return true
}
