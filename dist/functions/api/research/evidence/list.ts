/**
 * List Evidence API
 * GET /api/research/evidence/list?researchQuestionId=xxx
 *
 * List all evidence for a research question or investigation
 */

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const researchQuestionId = url.searchParams.get('researchQuestionId')
    const investigationPacketId = url.searchParams.get('investigationPacketId')
    const evidenceType = url.searchParams.get('type')
    const verificationStatus = url.searchParams.get('status')

    if (!researchQuestionId && !investigationPacketId) {
      return new Response(JSON.stringify({
        error: 'Must provide researchQuestionId or investigationPacketId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let query = `
      SELECT * FROM research_evidence
      WHERE 1=1
    `
    const params: any[] = []

    if (researchQuestionId) {
      query += ` AND research_question_id = ?`
      params.push(researchQuestionId)
    }

    if (investigationPacketId) {
      query += ` AND investigation_packet_id = ?`
      params.push(investigationPacketId)
    }

    if (evidenceType) {
      query += ` AND evidence_type = ?`
      params.push(evidenceType)
    }

    if (verificationStatus) {
      query += ` AND verification_status = ?`
      params.push(verificationStatus)
    }

    query += ` ORDER BY collected_at DESC`

    const stmt = context.env.DB.prepare(query).bind(...params)
    const result = await stmt.all()

    const evidence = result.results.map((row: any) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      chainOfCustody: row.chain_of_custody ? JSON.parse(row.chain_of_custody) : null,
      tags: row.tags ? JSON.parse(row.tags) : [],
      linkedEvidence: row.linked_evidence ? JSON.parse(row.linked_evidence) : [],
      entities: row.entities ? JSON.parse(row.entities) : []
    }))

    return new Response(JSON.stringify({
      success: true,
      evidence,
      count: evidence.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[list-evidence] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list evidence',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
