/**
 * Normalize Claims to Database
 *
 * Takes claims extracted by GPT from content analysis and normalizes them
 * into the claim_adjustments table for individual tracking, entity linking,
 * and investigation workflows.
 *
 * Part of Phase 1: Claims & Entity Integration
 */

interface ClaimDeceptionAnalysis {
  overall_risk: 'low' | 'medium' | 'high'
  risk_score: number
  methods: {
    internal_consistency: { score: number; reasoning: string }
    source_credibility: { score: number; reasoning: string }
    evidence_quality: { score: number; reasoning: string }
    logical_coherence: { score: number; reasoning: string }
    temporal_consistency: { score: number; reasoning: string }
    specificity: { score: number; reasoning: string }
  }
  red_flags: string[]
  confidence_assessment: string
}

interface ClaimToNormalize {
  claim: string
  category: string
  source?: string
  deception_analysis: ClaimDeceptionAnalysis
}

interface NormalizeClaimsParams {
  content_analysis_id: number
  claims: ClaimToNormalize[]
  user_id: number
  workspace_id: string
}

/**
 * Normalizes extracted claims into the claim_adjustments table
 *
 * @param db - D1 Database instance
 * @param params - Claims and metadata
 * @returns Array of claim IDs created
 */
export async function normalizeClaims(
  db: D1Database,
  params: NormalizeClaimsParams
): Promise<string[]> {
  const claimIds: string[] = []

  console.log(`[normalize-claims] Normalizing ${params.claims.length} claims for content_analysis_id=${params.content_analysis_id}`)

  for (let i = 0; i < params.claims.length; i++) {
    const claim = params.claims[i]
    const claimId = `claim-${crypto.randomUUID()}`

    try {
      // Validate claim has required fields
      if (!claim.claim || !claim.deception_analysis) {
        console.warn(`[normalize-claims] Skipping claim ${i} - missing required fields`)
        continue
      }

      // Save to claim_adjustments table
      await db.prepare(`
        INSERT INTO claim_adjustments (
          id,
          content_analysis_id,
          claim_index,
          claim_text,
          claim_category,
          original_risk_score,
          original_overall_risk,
          original_methods,
          adjusted_by,
          workspace_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        claimId,
        params.content_analysis_id,
        i,
        claim.claim,
        claim.category || 'uncategorized',
        claim.deception_analysis.risk_score || 0,
        claim.deception_analysis.overall_risk || 'low',
        JSON.stringify(claim.deception_analysis.methods || {}),
        params.user_id,
        params.workspace_id
      ).run()

      claimIds.push(claimId)

      console.log(`[normalize-claims] Saved claim ${i}: ${claimId} (risk: ${claim.deception_analysis.overall_risk})`)
    } catch (error) {
      console.error(`[normalize-claims] Failed to save claim ${i}:`, error)
      // Continue with other claims even if one fails
    }
  }

  console.log(`[normalize-claims] Successfully normalized ${claimIds.length}/${params.claims.length} claims`)

  return claimIds
}

/**
 * Load normalized claims for a content analysis
 *
 * @param db - D1 Database instance
 * @param contentAnalysisId - Content analysis ID
 * @returns Array of claim adjustments
 */
export async function loadNormalizedClaims(
  db: D1Database,
  contentAnalysisId: number
): Promise<any[]> {
  const result = await db.prepare(`
    SELECT
      id,
      claim_index,
      claim_text,
      claim_category,
      original_risk_score,
      original_overall_risk,
      original_methods,
      adjusted_risk_score,
      user_comment,
      verification_status,
      adjusted_by,
      created_at,
      updated_at
    FROM claim_adjustments
    WHERE content_analysis_id = ?
    ORDER BY claim_index ASC
  `).bind(contentAnalysisId).all()

  return result.results.map(row => ({
    ...row,
    original_methods: row.original_methods ? JSON.parse(row.original_methods as string) : {}
  }))
}

/**
 * Get claim statistics for a content analysis
 *
 * @param db - D1 Database instance
 * @param contentAnalysisId - Content analysis ID
 * @returns Statistics about normalized claims
 */
export async function getClaimStatistics(
  db: D1Database,
  contentAnalysisId: number
): Promise<{
  total: number
  high_risk: number
  medium_risk: number
  low_risk: number
  verified: number
  debunked: number
  pending: number
}> {
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN original_overall_risk = 'high' THEN 1 ELSE 0 END) as high_risk,
      SUM(CASE WHEN original_overall_risk = 'medium' THEN 1 ELSE 0 END) as medium_risk,
      SUM(CASE WHEN original_overall_risk = 'low' THEN 1 ELSE 0 END) as low_risk,
      SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN verification_status = 'debunked' THEN 1 ELSE 0 END) as debunked,
      SUM(CASE WHEN verification_status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM claim_adjustments
    WHERE content_analysis_id = ?
  `).bind(contentAnalysisId).first()

  return {
    total: stats?.total as number || 0,
    high_risk: stats?.high_risk as number || 0,
    medium_risk: stats?.medium_risk as number || 0,
    low_risk: stats?.low_risk as number || 0,
    verified: stats?.verified as number || 0,
    debunked: stats?.debunked as number || 0,
    pending: stats?.pending as number || 0
  }
}
