/**
 * POST /api/cop/:id/uploads - Add a file to a COP (editors; the bot)
 *
 * Body: multipart/form-data with `file` (and optional `evidence`, `title`, `tags`,
 * `source_ref`, `evidence_id`), or the raw file bytes with the same names as query
 * parameters (`?evidence=1&title=…&tags=a,b`, optional `X-File-Name`). At most 10 MB.
 *
 * The type comes from the bytes (functions/api/_shared/cop-uploads.ts): images
 * (JPEG, PNG, WebP, GIF) are stored without their metadata; PDFs, Office and
 * OpenDocument files, text and audio are stored as uploaded (metadata NOT removed) and
 * only ever downloaded; video, programs and archives are refused.
 *
 * → 201 { upload: { id, url, content_type, bytes, width, height, metadata_removed },
 *         evidence?: { id, tags } }
 *   `evidence=1` also files the upload as an unverified evidence item (image, document
 *   or audio) whose source_url is the upload's own address; `source_ref` (silo:<id> or
 *   peertube:<link>, cop-archive.ts) records where the original is archived.
 *   `evidence_id` instead attaches the file to an existing evidence item of this COP
 *   (a service: only its own) — e.g. a card held pending a virus scan whose file has
 *   now been cleared; the hold is lifted (scan_state 'clean').
 * Errors carry `code`: UNSUPPORTED_FILE (415), UNREADABLE_IMAGE (422),
 * FILE_TOO_LARGE (413), UPLOADS_UNAVAILABLE (503).
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { logEvent } from '../../_shared/event-log'
import { coded, copEditor, json } from '../../_shared/cop-route-auth'
import { copSessionScope, insertCopEvidence } from '../../_shared/cop-records'
import { cleanArchiveRef, readMetadata } from '../../_shared/cop-archive'
import { isMissingColumn, queryEvidenceInSession, serviceChangeRefused, serviceMayChange } from '../../_shared/cop-input'
import { applyItemTags, cleanTagName, MAX_TAGS_PER_CALL, tagsTableMissing } from '../../_shared/cop-tags'
import {
  cleanOriginalName,
  FILE_TOO_LARGE,
  MAX_COP_UPLOAD_BYTES,
  publicUpload,
  archiveOtherUploads,
  storeCopUpload,
  uploadKind,
  type R2Like,
} from '../../_shared/cop-uploads'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  UPLOADS?: R2Like
  COP_PEERTUBE_HOST?: string
}

interface UploadRequest {
  bytes: Uint8Array
  name: string | null
  evidence: boolean
  title: string | null
  tags: string[]
  sourceRef: unknown
  evidenceId: string | null
}

const EVIDENCE_TEXT = {
  image: { type: 'image', fallback: 'Photo', description: 'Photo added to the COP (location data removed).' },
  pdf: { type: 'document', fallback: 'Document', description: 'Document added to the COP (its metadata was not removed).' },
  document: { type: 'document', fallback: 'Document', description: 'Document added to the COP (its metadata was not removed).' },
  audio: { type: 'audio', fallback: 'Audio', description: 'Audio added to the COP (its metadata was not removed).' },
} as const

const truthy = (v: unknown) => v === true || v === '1' || v === 'true' || v === 'yes'

function tagList(raw: unknown): string[] | null {
  if (raw === null || raw === undefined || raw === '') return []
  const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length > MAX_TAGS_PER_CALL) return null
  const names = parts.map(cleanTagName)
  return names.some((n) => n === null) ? null : (names as string[])
}

function oneLine(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

async function readUpload(request: Request): Promise<UploadRequest | Response> {
  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > MAX_COP_UPLOAD_BYTES + 64 * 1024) {
    return coded(413, FILE_TOO_LARGE, `Files are limited to ${MAX_COP_UPLOAD_BYTES / (1024 * 1024)} MB.`)
  }
  const type = (request.headers.get('Content-Type') ?? '').toLowerCase()
  if (type.startsWith('multipart/form-data')) {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return json({ error: 'Invalid multipart body' }, 400)
    }
    // Workers' FormData types say string; a file part is a File at runtime.
    const file = form.get('file') as unknown as File | string | null
    if (!file || typeof file === 'string') return json({ error: 'Send the file in a "file" field' }, 400)
    if (file.size > MAX_COP_UPLOAD_BYTES) return coded(413, FILE_TOO_LARGE, `Files are limited to ${MAX_COP_UPLOAD_BYTES / (1024 * 1024)} MB.`)
    const tags = tagList(form.get('tags'))
    if (!tags) return json({ error: `tags: at most ${MAX_TAGS_PER_CALL} valid tag names, comma-separated` }, 400)
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      name: file.name || null,
      evidence: truthy(form.get('evidence')),
      title: oneLine(form.get('title'), 200),
      tags,
      sourceRef: form.get('source_ref') ?? undefined,
      evidenceId: typeof form.get('evidence_id') === 'string' ? String(form.get('evidence_id')) : null,
    }
  }
  const query = new URL(request.url).searchParams
  const tags = tagList(query.get('tags'))
  if (!tags) return json({ error: `tags: at most ${MAX_TAGS_PER_CALL} valid tag names, comma-separated` }, 400)
  const buffer = new Uint8Array(await request.arrayBuffer())
  if (buffer.length > MAX_COP_UPLOAD_BYTES) return coded(413, FILE_TOO_LARGE, `Files are limited to ${MAX_COP_UPLOAD_BYTES / (1024 * 1024)} MB.`)
  return {
    bytes: buffer,
    name: request.headers.get('X-File-Name') ?? query.get('name'),
    evidence: truthy(query.get('evidence')),
    title: oneLine(query.get('title'), 200),
    tags,
    sourceRef: query.get('source_ref') ?? undefined,
    evidenceId: query.get('evidence_id'),
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const access = await copEditor(context, sessionId, 'add files')
  if (access.ok === false) return access.response

  const parsed = await readUpload(context.request)
  if (parsed instanceof Response) return parsed
  const { env } = context
  const channel = access.service ? 'signal' : 'web'
  const archiveRef = cleanArchiveRef(parsed.sourceRef, env)
  if (archiveRef.ok === false) return json({ error: archiveRef.error }, 400)
  if (parsed.evidenceId !== null && !/^\d{1,15}$/.test(parsed.evidenceId)) return json({ error: 'evidence_id must be an evidence id' }, 400)

  try {
    // Attaching to an existing item: it must be this COP's evidence, and a service's own.
    let attachTo: { id: number; metadata: string | null } | null = null
    if (parsed.evidenceId !== null) {
      const existing = await queryEvidenceInSession(
        env.DB,
        'SELECT id, created_by, metadata FROM evidence_items WHERE id = ? AND {EVIDENCE_SCOPE}',
        { sessionId, workspaceId: access.workspaceId }, [Number(parsed.evidenceId)], [],
        (statement) => statement.first<{ id: number; created_by: number; metadata: string | null }>(),
      )
      if (!existing) return json({ error: 'Evidence not found' }, 404)
      if (!serviceMayChange(context, existing.created_by)) return serviceChangeRefused()
      attachTo = existing
    }

    const stored = await storeCopUpload(env, {
      sessionId, bytes: parsed.bytes, originalName: parsed.name, createdBy: access.userId, sourceChannel: channel, documents: true,
    })
    if (stored.ok === false) return coded(stored.status, stored.code, stored.error)
    const upload = publicUpload(stored.row)
    const text = EVIDENCE_TEXT[uploadKind(stored.row.content_type)]

    if (attachTo) {
      const metadata = { ...readMetadata(attachTo.metadata), upload_id: upload.id, scan_state: 'clean' }
      await env.DB.prepare(`
        UPDATE evidence_items SET source_url = ?, evidence_type = ?, metadata = ?, updated_at = ?
        WHERE id = ? AND workspace_id = ?
      `).bind(upload.url, text.type, JSON.stringify(metadata), new Date().toISOString(), attachTo.id, access.workspaceId).run()
      if (archiveRef.value !== undefined) await setArchiveRef(env.DB, attachTo.id, archiveRef.value)
      await env.DB.prepare('UPDATE cop_uploads SET evidence_id = ? WHERE id = ? AND cop_session_id = ?')
        .bind(String(attachTo.id), upload.id, sessionId).run()
      // The new file replaces any earlier one: a held or quarantined original must not
      // become downloadable when the hold is lifted for this copy.
      await archiveOtherUploads(env.DB, sessionId, attachTo.id, upload.id)
      return json({ upload, evidence: { id: attachTo.id, tags: [] } }, 201)
    }

    if (!parsed.evidence) return json({ upload }, 201)

    const scope = await copSessionScope(env.DB, sessionId)
    if (!scope) return json({ error: 'COP session not found' }, 404)
    const name = cleanOriginalName(parsed.name)
    const evidenceId = await insertCopEvidence(env.DB, scope, {
      title: parsed.title ?? text.fallback + (name ? `: ${name}` : ''),
      description: text.description,
      sourceUrl: upload.url,
      evidenceType: text.type,
      credibility: 'unverified',
      sourceName: channel === 'signal' ? 'Signal room' : 'Upload',
      sourceChannel: channel,
      metadata: { upload_id: upload.id },
      createdBy: access.userId,
    })
    if (archiveRef.value) await setArchiveRef(env.DB, evidenceId, archiveRef.value)
    await env.DB.prepare('UPDATE cop_uploads SET evidence_id = ? WHERE id = ? AND cop_session_id = ?')
      .bind(evidenceId, upload.id, sessionId).run()

    let tags: string[] = []
    if (parsed.tags.length > 0) {
      try {
        tags = await applyItemTags(env.DB, {
          sessionId, targetType: 'evidence', targetId: evidenceId, names: parsed.tags,
          source: access.service ? 'chat' : 'user', actorUserId: access.userId,
        })
      } catch (error) {
        if (!tagsTableMissing(error)) throw error
      }
    }
    return json({ upload, evidence: { id: evidenceId, tags } }, 201)
  } catch (error) {
    await logEvent(env, { level: 'error', source: 'cop/uploads', message: String(error instanceof Error ? error.message : error).slice(0, 500) })
    return json({ error: 'Failed to add the file' }, 500)
  }
}

/** Record where the original is archived (silo:/peertube:), tolerating a pending 0022. */
async function setArchiveRef(db: D1Database, evidenceId: number | string, ref: string | null): Promise<void> {
  try {
    await db.prepare('UPDATE evidence_items SET source_ref = ? WHERE id = ?').bind(ref, evidenceId).run()
  } catch (error) {
    if (!isMissingColumn(error)) throw error
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
