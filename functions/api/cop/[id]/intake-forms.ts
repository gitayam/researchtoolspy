/**
 * COP Intake Forms API
 *
 * GET  /api/cop/:id/intake-forms  - List intake forms for a session
 * POST /api/cop/:id/intake-forms  - Create a new intake form
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { generatePrefixedId , JSON_HEADERS } from '../../_shared/api-utils'
import { hashPassword, isValidAccessLevel, isValidSlug } from '../../_shared/survey-drops'

interface Env {
  DB: D1Database
}


function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const workspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Check if user is session owner — non-owners must not see share_token
    const session = await env.DB.prepare(
      'SELECT created_by FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<{ created_by: number }>()
    const isOwner = session && String(session.created_by) === String(userId)

    const columns = isOwner
      ? '*'
      : 'id, cop_session_id, title, description, form_schema, status, auto_tag_category, require_location, require_contact, created_by, workspace_id, created_at, updated_at'

    const results = await env.DB.prepare(
      `SELECT ${columns} FROM cop_intake_forms WHERE cop_session_id = ? ORDER BY created_at DESC LIMIT 200`
    ).bind(sessionId).all()

    const forms = (results.results || []).map((row: any) => {
      let form_schema = []
      try { form_schema = row.form_schema ? JSON.parse(row.form_schema) : [] } catch { form_schema = [] }
      return { ...row, form_schema }
    })

    return new Response(JSON.stringify({ intake_forms: forms }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Intake Forms] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list intake forms' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403, headers: JSON_HEADERS,
    })
  }

  try {
    const body = await request.json() as any

    if (!body.title?.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Validate access_level
    const accessLevel = body.access_level || 'public'
    if (!isValidAccessLevel(accessLevel)) {
      return new Response(JSON.stringify({ error: 'access_level must be public, password, or internal' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Hash password if provided
    let passwordHash: string | null = null
    if (accessLevel === 'password') {
      if (!body.password) {
        return new Response(JSON.stringify({ error: 'Password is required for password-protected forms' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      passwordHash = await hashPassword(body.password)
    }

    // Validate custom slug
    if (body.custom_slug) {
      if (!isValidSlug(body.custom_slug)) {
        return new Response(JSON.stringify({ error: 'Slug must be 3-50 lowercase alphanumeric characters with hyphens' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      const slugExists = await env.DB.prepare(
        'SELECT id FROM cop_intake_forms WHERE custom_slug = ?'
      ).bind(body.custom_slug).first()
      if (slugExists) {
        return new Response(JSON.stringify({ error: 'This slug is already in use' }), {
          status: 409, headers: JSON_HEADERS,
        })
      }
    }

    // Validate allowed_countries (must be array of strings)
    let allowedCountries = '[]'
    if (body.allowed_countries && Array.isArray(body.allowed_countries)) {
      allowedCountries = JSON.stringify(body.allowed_countries.map((c: string) => String(c).toUpperCase()))
    }

    const id = generatePrefixedId('ifm')
    const shareToken = generateToken()
    const formSchema = JSON.stringify(body.form_schema || [])

    await env.DB.prepare(`
      INSERT INTO cop_intake_forms (
        id, cop_session_id, title, description, form_schema, share_token, status,
        auto_tag_category, require_location, require_contact, created_by, workspace_id,
        access_level, password_hash, allowed_countries, rate_limit_per_hour,
        custom_slug, expires_at, theme_color, logo_url, success_message, redirect_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, body.title.trim(), body.description?.trim() || null,
      formSchema, shareToken, body.status || 'draft',
      body.auto_tag_category || null,
      body.require_location ? 1 : 0,
      body.require_contact ? 1 : 0,
      userId, session.workspace_id,
      accessLevel, passwordHash, allowedCountries,
      body.rate_limit_per_hour ?? 0,
      body.custom_slug || null,
      body.expires_at || null,
      body.theme_color || null,
      body.logo_url || null,
      body.success_message || null,
      body.redirect_url || null
    ).run()

    return new Response(JSON.stringify({
      id, share_token: shareToken,
      custom_slug: body.custom_slug || null,
      message: 'Intake form created',
    }), { status: 201, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Intake Forms] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create intake form' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
