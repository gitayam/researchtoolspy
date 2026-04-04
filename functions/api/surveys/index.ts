/**
 * Survey Drops CRUD — List + Create
 *
 * GET  /api/surveys      — list surveys for authenticated user
 * POST /api/surveys      — create a new survey
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { generatePrefixedId, JSON_HEADERS, safeJsonParse } from '../_shared/api-utils'
import { hashPassword, isValidAccessLevel, isValidSlug } from '../_shared/survey-drops'

interface Env {
  DB: D1Database
}

// GET — list surveys for authenticated user
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status')

    const VALID_SURVEY_STATUSES = ['draft', 'active', 'closed']
    if (statusFilter && !VALID_SURVEY_STATUSES.includes(statusFilter)) {
      return new Response(JSON.stringify({ error: 'Invalid status filter' }), { status: 400, headers: JSON_HEADERS })
    }

    let query = `SELECT id, title, description, form_schema, share_token, status,
             access_level, allowed_countries, rate_limit_per_hour, custom_slug,
             expires_at, theme_color, logo_url, success_message, redirect_url,
             auto_tag_category, require_location, require_contact, submission_count,
             cop_session_id, workspace_id, created_by, created_at, updated_at,
             CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END as has_password
      FROM survey_drops WHERE created_by = ?`
    const bindings: any[] = [userId]

    if (statusFilter) {
      query += ' AND status = ?'
      bindings.push(statusFilter)
    }

    query += ' ORDER BY created_at DESC LIMIT 200'

    const result = await env.DB.prepare(query).bind(...bindings).all()
    const surveys = (result.results || []).map((row: any) => ({
      ...row,
      has_password: !!row.has_password,
      form_schema: safeJsonParse(row.form_schema, []),
      allowed_countries: safeJsonParse(row.allowed_countries, []),
    }))

    return new Response(JSON.stringify({ surveys }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] GET list error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list surveys' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// POST — create a new survey
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any

    // Validate title
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return new Response(JSON.stringify({ error: 'title is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Validate access_level
    const accessLevel = body.access_level || 'public'
    if (!isValidAccessLevel(accessLevel)) {
      return new Response(JSON.stringify({ error: 'Invalid access_level. Must be: public, password, internal' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Password required for password-protected surveys
    let passwordHash: string | null = null
    if (accessLevel === 'password') {
      if (!body.password || typeof body.password !== 'string') {
        return new Response(JSON.stringify({ error: 'password is required when access_level is password' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      passwordHash = await hashPassword(body.password)
    }

    // Validate and check uniqueness of custom_slug
    let customSlug: string | null = null
    if (body.custom_slug) {
      const slug = String(body.custom_slug).toLowerCase()
      if (!isValidSlug(slug)) {
        return new Response(JSON.stringify({ error: 'Invalid slug. Must be 3-50 chars, lowercase alphanumeric and hyphens' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      // Check uniqueness
      const existing = await env.DB.prepare(
        'SELECT id FROM survey_drops WHERE custom_slug = ?'
      ).bind(slug).first()
      if (existing) {
        return new Response(JSON.stringify({ error: 'Slug already in use' }), {
          status: 409, headers: JSON_HEADERS,
        })
      }
      customSlug = slug
    }

    // Process allowed_countries
    let allowedCountries = '[]'
    if (Array.isArray(body.allowed_countries) && body.allowed_countries.length > 0) {
      allowedCountries = JSON.stringify(body.allowed_countries.map((c: string) => String(c).toUpperCase()))
    }

    // Validate form_schema limits
    if (body.form_schema && Array.isArray(body.form_schema)) {
      if (body.form_schema.length > 50) {
        return new Response(JSON.stringify({ error: 'Maximum 50 fields per survey' }), { status: 400, headers: JSON_HEADERS })
      }
      for (const field of body.form_schema) {
        if (typeof field.label === 'string' && field.label.length > 200) {
          return new Response(JSON.stringify({ error: 'Field labels must be under 200 characters' }), { status: 400, headers: JSON_HEADERS })
        }
      }
    }

    // Process form_schema
    const formSchema = Array.isArray(body.form_schema) ? JSON.stringify(body.form_schema) : '[]'

    const id = generatePrefixedId('srv')
    const shareToken = crypto.randomUUID().replace(/-/g, '')

    await env.DB.prepare(`
      INSERT INTO survey_drops (
        id, title, description, form_schema, share_token, status,
        access_level, password_hash, allowed_countries, rate_limit_per_hour,
        custom_slug, expires_at, theme_color, logo_url, success_message, redirect_url,
        auto_tag_category, require_location, require_contact, cop_session_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      title,
      body.description || null,
      formSchema,
      shareToken,
      body.status || 'draft',
      accessLevel,
      passwordHash,
      allowedCountries,
      body.rate_limit_per_hour ?? 0,
      customSlug,
      body.expires_at || null,
      body.theme_color || null,
      body.logo_url || null,
      body.success_message || null,
      body.redirect_url || null,
      body.auto_tag_category || null,
      body.require_location ? 1 : 0,
      body.require_contact ? 1 : 0,
      body.cop_session_id || null,
      userId,
    ).run()

    return new Response(JSON.stringify({
      id,
      share_token: shareToken,
      custom_slug: customSlug,
      message: 'Survey created',
    }), { status: 201, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] POST create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create survey' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
