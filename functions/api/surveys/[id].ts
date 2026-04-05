/**
 * Survey Drops CRUD — Get, Update, Archive
 *
 * GET    /api/surveys/:id  — get survey detail (owner only)
 * PUT    /api/surveys/:id  — update survey fields
 * DELETE /api/surveys/:id  — archive (soft delete)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, safeJsonParse } from '../_shared/api-utils'
import { hashPassword, isValidAccessLevel, isValidSlug } from '../_shared/survey-drops'

interface Env {
  DB: D1Database
}

// GET — get survey detail (owner only)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const survey = await env.DB.prepare(`
      SELECT id, title, description, form_schema, share_token, status,
             access_level, allowed_countries, rate_limit_per_hour, custom_slug,
             expires_at, theme_color, logo_url, success_message, redirect_url,
             auto_tag_category, require_location, require_contact, submission_count,
             cop_session_id, workspace_id, created_by, created_at, updated_at,
             facts, changelog,
             CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END as has_password
      FROM survey_drops WHERE id = ? AND created_by = ?
    `).bind(surveyId, userId).first()

    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      ...survey,
      has_password: !!(survey as any).has_password,
      form_schema: safeJsonParse((survey as any).form_schema, []),
      allowed_countries: safeJsonParse((survey as any).allowed_countries, []),
      facts: safeJsonParse((survey as any).facts, []),
      changelog: safeJsonParse((survey as any).changelog, []),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] GET detail error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch survey' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// PUT — update survey fields
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    // Ownership check
    const existing = await env.DB.prepare(
      'SELECT id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const sets: string[] = []
    const bindings: any[] = []

    // Title
    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title) {
        return new Response(JSON.stringify({ error: 'title cannot be empty' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      sets.push('title = ?')
      bindings.push(title)
    }

    // Simple text fields
    const textFields = [
      'description', 'status', 'expires_at', 'theme_color', 'logo_url',
      'success_message', 'redirect_url', 'auto_tag_category', 'cop_session_id',
    ] as const
    for (const field of textFields) {
      if (body[field] !== undefined) {
        sets.push(`${field} = ?`)
        bindings.push(body[field] || null)
      }
    }

    // facts (array -> JSON string)
    if (body.facts !== undefined) {
      sets.push('facts = ?')
      bindings.push(Array.isArray(body.facts) ? JSON.stringify(body.facts) : '[]')
    }

    // changelog (array -> JSON string)
    if (body.changelog !== undefined) {
      sets.push('changelog = ?')
      bindings.push(Array.isArray(body.changelog) ? JSON.stringify(body.changelog) : '[]')
    }

    // form_schema (array -> JSON string)
    if (body.form_schema !== undefined) {
      if (Array.isArray(body.form_schema)) {
        if (body.form_schema.length > 50) {
          return new Response(JSON.stringify({ error: 'Maximum 50 fields per survey' }), { status: 400, headers: JSON_HEADERS })
        }
        for (const field of body.form_schema) {
          if (typeof field.label === 'string' && field.label.length > 200) {
            return new Response(JSON.stringify({ error: 'Field labels must be under 200 characters' }), { status: 400, headers: JSON_HEADERS })
          }
        }
      }
      sets.push('form_schema = ?')
      bindings.push(Array.isArray(body.form_schema) ? JSON.stringify(body.form_schema) : '[]')
    }

    // access_level with validation
    if (body.access_level !== undefined) {
      if (!isValidAccessLevel(body.access_level)) {
        return new Response(JSON.stringify({ error: 'Invalid access_level. Must be: public, password, internal' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      sets.push('access_level = ?')
      bindings.push(body.access_level)
    }

    // Password hash
    if (body.password !== undefined) {
      if (body.password) {
        sets.push('password_hash = ?')
        bindings.push(await hashPassword(body.password))
      } else {
        sets.push('password_hash = ?')
        bindings.push(null)
      }
    }

    // allowed_countries
    if (body.allowed_countries !== undefined) {
      if (Array.isArray(body.allowed_countries) && body.allowed_countries.length > 0) {
        sets.push('allowed_countries = ?')
        bindings.push(JSON.stringify(body.allowed_countries.map((c: string) => String(c).toUpperCase())))
      } else {
        sets.push('allowed_countries = ?')
        bindings.push('[]')
      }
    }

    // rate_limit_per_hour
    if (body.rate_limit_per_hour !== undefined) {
      sets.push('rate_limit_per_hour = ?')
      bindings.push(Number(body.rate_limit_per_hour) || 0)
    }

    // custom_slug with validation + uniqueness
    if (body.custom_slug !== undefined) {
      if (body.custom_slug) {
        const slug = String(body.custom_slug).toLowerCase()
        if (!isValidSlug(slug)) {
          return new Response(JSON.stringify({ error: 'Invalid slug. Must be 3-50 chars, lowercase alphanumeric and hyphens' }), {
            status: 400, headers: JSON_HEADERS,
          })
        }
        const slugExists = await env.DB.prepare(
          'SELECT id FROM survey_drops WHERE custom_slug = ? AND id != ?'
        ).bind(slug, surveyId).first()
        if (slugExists) {
          return new Response(JSON.stringify({ error: 'Slug already in use' }), {
            status: 409, headers: JSON_HEADERS,
          })
        }
        sets.push('custom_slug = ?')
        bindings.push(slug)
      } else {
        sets.push('custom_slug = ?')
        bindings.push(null)
      }
    }

    // Boolean fields
    if (body.require_location !== undefined) {
      sets.push('require_location = ?')
      bindings.push(body.require_location ? 1 : 0)
    }
    if (body.require_contact !== undefined) {
      sets.push('require_contact = ?')
      bindings.push(body.require_contact ? 1 : 0)
    }

    if (sets.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Always update timestamp
    sets.push("updated_at = datetime('now')")
    bindings.push(surveyId)

    await env.DB.prepare(
      `UPDATE survey_drops SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...bindings).run()

    return new Response(JSON.stringify({ message: 'Survey updated' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] PUT update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update survey' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// DELETE — archive (soft delete)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const existing = await env.DB.prepare(
      'SELECT id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    await env.DB.prepare(
      "UPDATE survey_drops SET status = 'closed', updated_at = datetime('now') WHERE id = ?"
    ).bind(surveyId).run()

    return new Response(JSON.stringify({ message: 'Survey archived' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] DELETE archive error:', error)
    return new Response(JSON.stringify({ error: 'Failed to archive survey' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
