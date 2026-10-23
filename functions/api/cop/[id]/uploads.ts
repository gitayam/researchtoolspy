/**
 * POST /api/cop/:id/uploads - Add a photo or PDF to a COP (editors; the bot)
 *
 * Body: multipart/form-data with `file` (and optional `evidence`, `title`, `tags`),
 * or the raw file bytes with `?evidence=1&title=…&tags=a,b` (and optional
 * `X-File-Name`). At most 10 MB.
 *
 * The type comes from the bytes (JPEG, PNG, WebP, GIF, PDF); images are stored
 * without their metadata (GPS and the rest); an image that can't be parsed is
 * refused (functions/api/_shared/cop-uploads.ts).
 *
 * → 201 { upload: { id, url, content_type, bytes, width, height },
 *         evidence?: { id, tags } }
 *   `evidence=1` also files the upload as an unverified evidence item (image or
 *   document) whose source_url is the upload's own address.
 * Errors carry `code`: UNSUPPORTED_FILE (415), UNREADABLE_IMAGE (422),
 * FILE_TOO_LARGE (413), UPLOADS_UNAVAILABLE (503).
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { logEvent } from '../../_shared/event-log'
import { coded, copEditor, json } from '../../_shared/cop-route-auth'
import { copSessionScope, insertCopEvidence } from '../../_shared/cop-records'
import { applyItemTags, cleanTagName, MAX_TAGS_PER_CALL, tagsTableMissing } from '../../_shared/cop-tags'
import {
  cleanOriginalName,
  FILE_TOO_LARGE,
  MAX_COP_UPLOAD_BYTES,
  publicUpload,
  storeCopUpload,
  type R2Like,
} from '../../_shared/cop-uploads'
import { IMAGE_TYPES, type SniffedType } from '../../_shared/image-sanitize'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  UPLOADS?: R2Like
}

interface UploadRequest {
  bytes: Uint8Array
  name: string | null
  evidence: boolean
  title: string | null
  tags: string[]
}

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

  try {
    const stored = await storeCopUpload(env, {
      sessionId, bytes: parsed.bytes, originalName: parsed.name, createdBy: access.userId, sourceChannel: channel,
    })
    if (stored.ok === false) return coded(stored.status, stored.code, stored.error)
    const upload = publicUpload(stored.row)

    if (!parsed.evidence) return json({ upload }, 201)

    const scope = await copSessionScope(env.DB, sessionId)
    if (!scope) return json({ error: 'COP session not found' }, 404)
    const image = IMAGE_TYPES.has(stored.row.content_type as SniffedType)
    const name = cleanOriginalName(parsed.name)
    const evidenceId = await insertCopEvidence(env.DB, scope, {
      title: parsed.title ?? (image ? 'Photo' : 'Document') + (name ? `: ${name}` : ''),
      description: image ? 'Photo added to the COP (location data removed).' : 'Document added to the COP.',
      sourceUrl: upload.url,
      evidenceType: image ? 'image' : 'document',
      credibility: 'unverified',
      sourceName: channel === 'signal' ? 'Signal room' : 'Upload',
      sourceChannel: channel,
      metadata: { upload_id: upload.id },
      createdBy: access.userId,
    })
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

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
