/**
 * Collection Job Status API
 *
 * GET /api/collection/{jobId}/status
 * Returns the status and details of a collection job
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { CollectionJob, CollectionResultsSummary } from '../../../../src/types/collection'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

/**
 * Generous wall-clock budget for a collection job. Normal jobs (agent search +
 * LLM scoring) finish in well under this; a job still 'running'/'pending' past
 * this point means the agent accepted the request but never called back.
 */
export const COLLECTION_TIMEOUT_MINUTES = 15

/**
 * True when a still-in-flight job has aged past the timeout and should be
 * transitioned to a terminal error state.
 *
 * @param createdAtUtc SQLite datetime('now') text: "YYYY-MM-DD HH:MM:SS", UTC, no 'Z'.
 * @param nowMs        Current time in epoch ms (passed in for deterministic testing).
 * @param timeoutMinutes Threshold; defaults to COLLECTION_TIMEOUT_MINUTES.
 * @returns true when (now - createdAt) >= timeoutMinutes (boundary inclusive).
 */
export function isCollectionJobStale(
  createdAtUtc: string,
  nowMs: number,
  timeoutMinutes = COLLECTION_TIMEOUT_MINUTES
): boolean {
  // SQLite stores UTC with a space separator and no zone suffix — make it
  // an explicit UTC ISO string before parsing so it isn't read as local time.
  const createdMs = new Date(createdAtUtc.replace(' ', 'T') + 'Z').getTime()
  if (Number.isNaN(createdMs)) return false // unparseable → never auto-fail
  return nowMs - createdMs >= timeoutMinutes * 60 * 1000
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // Auth check — collection data requires authentication
  const userId = await getUserFromRequest(context.request, context.env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: JSON_HEADERS
    })
  }

  try {
    const jobId = context.params.jobId as string

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Get job details
    const job = await context.env.DB.prepare(`
      SELECT id, workspace_id, query, categories, time_range, max_results,
             status, results_count, batch_job_id, error_message, llm_used,
             created_at, completed_at
      FROM collection_jobs WHERE id = ?
    `).bind(jobId).first()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Lazy timeout: start.ts only catches the INITIAL connection error to the
    // agent. If the agent accepted the request but never called back, the job
    // sits at 'running'/'pending' forever. On read, if it has aged past the
    // budget, transition it to a terminal error so the polling UI stops.
    //
    // Mutable copies so the response can reflect the post-timeout state.
    let status = job.status as CollectionJob['status']
    let errorMessage = job.error_message as string | undefined
    let completedAt = job.completed_at as string | undefined

    const inFlight = status === 'running' || status === 'pending'
    if (inFlight && isCollectionJobStale(job.created_at as string, Date.now())) {
      // Race-safe: the WHERE clause re-checks status + age, so a callback that
      // lands between our read and this write wins (0 rows changed → no override).
      const timeoutMsg = `Collection timed out — the research agent did not respond within ${COLLECTION_TIMEOUT_MINUTES} minutes.`
      const upd = await context.env.DB.prepare(`
        UPDATE collection_jobs
        SET status = 'error',
            error_message = ?,
            completed_at = datetime('now')
        WHERE id = ?
          AND status IN ('running','pending')
          AND created_at < datetime('now', '-' || ? || ' minutes')
      `).bind(timeoutMsg, jobId, COLLECTION_TIMEOUT_MINUTES).run()

      if (upd.meta?.changes && upd.meta.changes > 0) {
        // We owned the transition — re-read the authoritative terminal row so
        // completed_at matches what was written.
        const fresh = await context.env.DB.prepare(`
          SELECT status, error_message, completed_at
          FROM collection_jobs WHERE id = ?
        `).bind(jobId).first()
        status = (fresh?.status as CollectionJob['status']) ?? 'error'
        errorMessage = (fresh?.error_message as string | undefined) ?? timeoutMsg
        completedAt = fresh?.completed_at as string | undefined
      }
    }

    // Parse categories JSON and construct typed response
    const parsedJob: CollectionJob = {
      id: job.id as string,
      workspace_id: job.workspace_id as string,
      query: job.query as string,
      categories: (() => { try { return JSON.parse(job.categories as string || '[]') } catch { return [] } })(),
      time_range: job.time_range as CollectionJob['time_range'],
      max_results: job.max_results as number,
      status,
      results_count: job.results_count as number,
      batch_job_id: job.batch_job_id as string | undefined,
      error_message: errorMessage,
      llm_used: job.llm_used as CollectionJob['llm_used'],
      created_at: job.created_at as string,
      completed_at: completedAt
    }

    // If complete, include results summary by category
    if (status === 'complete') {
      const summary = await context.env.DB.prepare(`
        SELECT category, COUNT(*) as count, AVG(relevance_score) as avg_relevance
        FROM collection_results WHERE job_id = ?
        GROUP BY category
        ORDER BY count DESC
      `).bind(jobId).all()

      const resultsSummary: CollectionResultsSummary[] = (summary.results || []).map(row => ({
        category: row.category as CollectionResultsSummary['category'],
        count: row.count as number,
        avg_relevance: row.avg_relevance as number
      }))

      return new Response(JSON.stringify({
        ...parsedJob,
        resultsSummary
      }), {
        status: 200,
        headers: JSON_HEADERS
      })
    }

    return new Response(JSON.stringify(parsedJob), {
      status: 200,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Collection Status] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get status'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
