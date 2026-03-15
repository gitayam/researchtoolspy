/**
 * Actor Credibility API
 * GET /api/actors/{actor_id}/credibility?workspace_id=xxx
 *
 * Returns an actor's credibility history including aggregated scores,
 * linked framework assessments, and MOM assessment history.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { checkWorkspaceAccess } from '../../_shared/workspace-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

/** Round to 1 decimal place */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Safely average an array of numbers, returns 0 if empty */
function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

// Score keys grouped by framework category
const SCORE_KEYS = {
  mom: ['motive', 'opportunity', 'means'] as const,
  pop: ['historicalPattern', 'sophisticationLevel', 'successRate'] as const,
  moses: ['sourceVulnerability', 'manipulationEvidence'] as const,
  eve: ['internalConsistency', 'externalCorroboration', 'anomalyDetection'] as const,
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return optionsResponse()
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const actorId = context.params.actor_id as string
    const workspaceId = url.searchParams.get('workspace_id')

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspace_id parameter required' }),
        { status: 400, headers: JSON_HEADERS }
      )
    }

    const userId = await getUserIdOrDefault(request, env)

    if (!(await checkWorkspaceAccess(workspaceId, userId, env))) {
      return new Response(
        JSON.stringify({ error: 'Access denied to workspace' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    // Fetch actor
    const actor = await env.DB.prepare(
      `SELECT id, name, type, description, aliases, deception_profile
       FROM actors WHERE id = ? AND workspace_id = ?`
    ).bind(actorId, workspaceId).first()

    if (!actor) {
      return new Response(
        JSON.stringify({ error: 'Actor not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    const aliases = actor.aliases ? JSON.parse(actor.aliases as string) : []

    // Fetch linked deception framework sessions via framework_entities
    const { results: linkedSessions } = await env.DB.prepare(`
      SELECT fs.id as framework_id, fs.title, fs.data, fs.created_at
      FROM framework_entities fe
      JOIN framework_sessions fs ON fs.id = fe.framework_id
      WHERE fe.entity_type = 'actor'
        AND fe.entity_id = ?
        AND fs.framework_type = 'deception'
        AND fs.workspace_id = ?
        AND fs.data IS NOT NULL
      ORDER BY fs.created_at DESC
      LIMIT 50
    `).bind(actorId, workspaceId).all()

    // Parse all sessions and extract scores
    const previousAssessments: Array<{
      framework_id: string
      title: string
      likelihood: number
      scores: Record<string, number>
      created_at: string
    }> = []

    const allScoreSets: Array<Record<string, number>> = []

    for (const session of linkedSessions) {
      try {
        const data = typeof session.data === 'string'
          ? JSON.parse(session.data as string)
          : session.data

        if (!data || typeof data !== 'object') continue

        const likelihood = data.calculatedAssessment?.likelihood
          ?? data.aiAnalysis?.deceptionLikelihood
          ?? null

        const scores: Record<string, number> = data.scores || {}

        if (likelihood !== null || Object.keys(scores).length > 0) {
          previousAssessments.push({
            framework_id: String(session.framework_id),
            title: session.title as string,
            likelihood: likelihood ?? 50,
            scores,
            created_at: session.created_at as string,
          })
          allScoreSets.push(scores)
        }
      } catch {
        continue
      }
    }

    // Fetch MOM assessments (table may not exist)
    let momAssessments: Array<{
      id: string
      motive: number
      opportunity: number
      means: number
      notes: string | null
      assessed_at: string
    }> = []

    try {
      const { results: momRows } = await env.DB.prepare(`
        SELECT id, motive, opportunity, means, notes, assessed_at
        FROM mom_assessments
        WHERE actor_id = ? AND workspace_id = ?
        ORDER BY assessed_at DESC
        LIMIT 50
      `).bind(actorId, workspaceId).all()

      momAssessments = momRows.map((row) => ({
        id: String(row.id),
        motive: row.motive as number,
        opportunity: row.opportunity as number,
        means: row.means as number,
        notes: (row.notes as string) || null,
        assessed_at: row.assessed_at as string,
      }))
    } catch {
      // mom_assessments table may not exist yet
    }

    const frameworkCount = previousAssessments.length
    const momCount = momAssessments.length
    const assessmentCount = frameworkCount + momCount

    // Build aggregated credibility summary
    let credibility: Record<string, any> | null = null

    if (assessmentCount > 0) {
      // Aggregate averages from framework session scores
      const avgForKey = (key: string): number => {
        const values = allScoreSets
          .map((s) => s[key])
          .filter((v) => typeof v === 'number' && !isNaN(v))
        return round1(avg(values))
      }

      // Fold MOM assessment scores into avg_mom (combines framework + standalone MOM data)
      const numFilter = (v: number) => typeof v === 'number' && !isNaN(v)
      const allMotive: number[] = allScoreSets
        .map((s) => s.motive).filter(numFilter)
        .concat(momAssessments.map((m) => m.motive).filter(numFilter))
      const allOpportunity: number[] = allScoreSets
        .map((s) => s.opportunity).filter(numFilter)
        .concat(momAssessments.map((m) => m.opportunity).filter(numFilter))
      const allMeans: number[] = allScoreSets
        .map((s) => s.means).filter(numFilter)
        .concat(momAssessments.map((m) => m.means).filter(numFilter))

      // Most recent assessment's scores for pre-fill
      const mostRecentScores = allScoreSets.length > 0 ? allScoreSets[0] : null
      const mostRecentLikelihood = previousAssessments.length > 0
        ? previousAssessments[0].likelihood
        : 50

      credibility = {
        assessment_count: assessmentCount,
        framework_count: frameworkCount,
        mom_count: momCount,
        avg_mom: {
          motive: round1(avg(allMotive)),
          opportunity: round1(avg(allOpportunity)),
          means: round1(avg(allMeans)),
        },
        avg_pop: {
          historicalPattern: avgForKey('historicalPattern'),
          sophisticationLevel: avgForKey('sophisticationLevel'),
          successRate: avgForKey('successRate'),
        },
        avg_moses: {
          sourceVulnerability: avgForKey('sourceVulnerability'),
          manipulationEvidence: avgForKey('manipulationEvidence'),
        },
        avg_eve: {
          internalConsistency: avgForKey('internalConsistency'),
          externalCorroboration: avgForKey('externalCorroboration'),
          anomalyDetection: avgForKey('anomalyDetection'),
        },
        most_recent_likelihood: mostRecentLikelihood,
        deception_profile: mostRecentScores,
      }
    }

    return new Response(
      JSON.stringify({
        actor: {
          id: actor.id,
          name: actor.name,
          type: actor.type,
          description: actor.description,
          aliases,
        },
        credibility,
        previous_assessments: previousAssessments.slice(0, 10),
        mom_assessments: momAssessments.slice(0, 10),
      }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Actor credibility API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
