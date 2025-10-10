/**
 * Unified Deception Risk Aggregation API
 * Aggregates all 5 deception systems: MOM, POP, EVE, MOSES, Claims
 */

import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

interface Alert {
  type: 'ACTOR_MOM' | 'ACTOR_POP' | 'EVIDENCE_EVE' | 'SOURCE_MOSES' | 'CLAIM_DECEPTION'
  entity_type: 'ACTOR' | 'EVIDENCE' | 'SOURCE' | 'CLAIM'
  entity_id: string | number
  entity_name: string
  risk_score: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  details: string
  url?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = getUserIdOrDefault(context)
    const url = new URL(context.request.url)
    const workspaceId = url.searchParams.get('workspace_id') || '1'

    console.log('[Deception Aggregate] Fetching risk data for workspace:', workspaceId)

    // ===== 1. ACTOR MOM SCORES =====
    const momActors = await context.env.DB.prepare(`
      SELECT
        a.id,
        a.name,
        a.deception_profile
      FROM actors a
      WHERE a.workspace_id = ?
        AND a.deception_profile IS NOT NULL
    `).bind(workspaceId).all()

    let momStats = { high: 0, medium: 0, low: 0, avg_score: 0, total: 0 }
    let momAlerts: Alert[] = []

    if (momActors.results) {
      const scores: number[] = []
      for (const actor of momActors.results as any[]) {
        try {
          const profile = JSON.parse(actor.deception_profile)
          if (profile.mom) {
            const avgScore = ((profile.mom.motive || 0) + (profile.mom.opportunity || 0) + (profile.mom.means || 0)) / 3
            scores.push(avgScore)

            if (avgScore >= 4.0) {
              momStats.high++
              if (avgScore >= 4.5) {
                momAlerts.push({
                  type: 'ACTOR_MOM',
                  entity_type: 'ACTOR',
                  entity_id: actor.id,
                  entity_name: actor.name,
                  risk_score: avgScore,
                  severity: 'CRITICAL',
                  details: `High motive (${profile.mom.motive}), opportunity (${profile.mom.opportunity}), means (${profile.mom.means})`,
                  url: `/dashboard/entities/actors/${actor.id}`
                })
              }
            } else if (avgScore >= 3.0) {
              momStats.medium++
            } else {
              momStats.low++
            }
          }
        } catch (e) {
          console.error('[MOM] Failed to parse deception_profile for actor:', actor.id, e)
        }
      }
      momStats.total = scores.length
      momStats.avg_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    }

    // ===== 2. ACTOR POP SCORES =====
    let popStats = { high: 0, medium: 0, low: 0, avg_score: 0, total: 0 }

    if (momActors.results) {
      const scores: number[] = []
      for (const actor of momActors.results as any[]) {
        try {
          const profile = JSON.parse(actor.deception_profile)
          if (profile.pop) {
            const riskLevel = profile.pop.overall_risk_level?.toLowerCase() || 'medium'

            // Convert risk level to numeric score
            const score = riskLevel === 'high' ? 4.0 : riskLevel === 'medium' ? 3.0 : 2.0
            scores.push(score)

            if (riskLevel === 'high') popStats.high++
            else if (riskLevel === 'medium') popStats.medium++
            else popStats.low++
          }
        } catch (e) {
          console.error('[POP] Failed to parse deception_profile for actor:', actor.id, e)
        }
      }
      popStats.total = scores.length
      popStats.avg_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    }

    // ===== 3. EVIDENCE EVE SCORES =====
    // Note: EVE is not yet implemented in evidence_items schema
    // Placeholder for future implementation
    const eveStats = { suspicious: 0, needs_review: 0, verified: 0, avg_score: 0, total: 0 }
    const eveAlerts: Alert[] = []

    // ===== 4. SOURCE MOSES SCORES =====
    const mosesSources = await context.env.DB.prepare(`
      SELECT
        s.id,
        s.name,
        s.moses_assessment
      FROM sources s
      WHERE s.workspace_id = ?
        AND s.moses_assessment IS NOT NULL
    `).bind(workspaceId).all()

    let mosesStats = { compromised: 0, unreliable: 0, solid: 0, avg_score: 0, total: 0 }
    let mosesAlerts: Alert[] = []

    if (mosesSources.results) {
      const scores: number[] = []
      for (const source of mosesSources.results as any[]) {
        try {
          const moses = JSON.parse(source.moses_assessment)
          const vulnerability = moses.source_vulnerability || 0
          const manipulation = moses.manipulation_evidence || 0
          const avgScore = (vulnerability + manipulation) / 2
          scores.push(avgScore)

          if (avgScore >= 4.0) {
            mosesStats.compromised++
            mosesAlerts.push({
              type: 'SOURCE_MOSES',
              entity_type: 'SOURCE',
              entity_id: source.id,
              entity_name: source.name,
              risk_score: avgScore,
              severity: 'HIGH',
              details: `High vulnerability (${vulnerability}), manipulation evidence (${manipulation})`,
              url: `/dashboard/entities/sources/${source.id}`
            })
          } else if (avgScore >= 3.0) {
            mosesStats.unreliable++
          } else {
            mosesStats.solid++
          }
        } catch (e) {
          console.error('[MOSES] Failed to parse moses_assessment for source:', source.id, e)
        }
      }
      mosesStats.total = scores.length
      mosesStats.avg_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    }

    // ===== 5. CLAIM DECEPTION SCORES =====
    const claimAnalyses = await context.env.DB.prepare(`
      SELECT
        ca.id,
        ca.title,
        ca.url,
        ca.claim_analysis
      FROM content_analysis ca
      WHERE ca.user_id = ?
        AND ca.claim_analysis IS NOT NULL
      ORDER BY ca.created_at DESC
      LIMIT 100
    `).bind(userId).all()

    let claimStats = { high: 0, medium: 0, low: 0, avg_score: 0, total: 0 }
    let claimAlerts: Alert[] = []

    if (claimAnalyses.results) {
      const scores: number[] = []
      for (const analysis of claimAnalyses.results as any[]) {
        try {
          const claimData = JSON.parse(analysis.claim_analysis)
          if (claimData.claims) {
            for (const claim of claimData.claims) {
              const riskScore = claim.deception_analysis?.risk_score || 0
              scores.push(riskScore)

              if (riskScore > 60) {
                claimStats.high++
                if (riskScore > 75) {
                  claimAlerts.push({
                    type: 'CLAIM_DECEPTION',
                    entity_type: 'CLAIM',
                    entity_id: analysis.id,
                    entity_name: claim.claim.substring(0, 80) + (claim.claim.length > 80 ? '...' : ''),
                    risk_score: riskScore,
                    severity: riskScore > 85 ? 'CRITICAL' : 'HIGH',
                    details: `Risk score ${riskScore}/100 from content: ${analysis.title}`,
                    url: `/dashboard/tools/content-intelligence?id=${analysis.id}`
                  })
                }
              } else if (riskScore > 30) {
                claimStats.medium++
              } else {
                claimStats.low++
              }
            }
          }
        } catch (e) {
          console.error('[Claims] Failed to parse claim_analysis for content:', analysis.id, e)
        }
      }
      claimStats.total = scores.length
      claimStats.avg_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    }

    // ===== CALCULATE OVERALL RISK SCORE =====
    const overallRiskScore = Math.round(
      (momStats.avg_score * 20 * 0.25) +  // MOM: 0-5 scale → 0-100, weight 25%
      (popStats.avg_score * 20 * 0.20) +  // POP: 0-5 scale → 0-100, weight 20%
      (eveStats.avg_score * 20 * 0.25) +  // EVE: 0-5 scale → 0-100, weight 25%
      (mosesStats.avg_score * 20 * 0.15) + // MOSES: 0-5 scale → 0-100, weight 15%
      (claimStats.avg_score * 0.15)       // Claims: already 0-100, weight 15%
    )

    const riskLevel =
      overallRiskScore >= 75 ? 'CRITICAL' :
      overallRiskScore >= 60 ? 'HIGH' :
      overallRiskScore >= 40 ? 'MEDIUM' : 'LOW'

    // ===== COMBINE ALL ALERTS =====
    const allAlerts = [...momAlerts, ...eveAlerts, ...mosesAlerts, ...claimAlerts]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 10) // Top 10 alerts

    // ===== GENERATE RECOMMENDED ACTIONS =====
    const recommendedActions = []
    if (momAlerts.length > 0) {
      recommendedActions.push({
        priority: 1,
        action: `Review MOM assessment for '${momAlerts[0].entity_name}'`,
        entity_type: 'ACTOR',
        entity_id: momAlerts[0].entity_id,
        url: momAlerts[0].url
      })
    }
    if (mosesAlerts.length > 0) {
      recommendedActions.push({
        priority: 2,
        action: `Verify source credibility for '${mosesAlerts[0].entity_name}'`,
        entity_type: 'SOURCE',
        entity_id: mosesAlerts[0].entity_id,
        url: mosesAlerts[0].url
      })
    }
    if (claimAlerts.length > 0) {
      recommendedActions.push({
        priority: 3,
        action: `Cross-check high-risk claim: ${claimAlerts[0].entity_name}`,
        entity_type: 'CLAIM',
        entity_id: claimAlerts[0].entity_id,
        url: claimAlerts[0].url
      })
    }

    // ===== RETURN RESPONSE =====
    return new Response(JSON.stringify({
      overall_risk_score: overallRiskScore,
      risk_level: riskLevel,
      critical_alerts: allAlerts.filter(a => a.severity === 'CRITICAL'),
      high_alerts: allAlerts.filter(a => a.severity === 'HIGH'),
      all_alerts: allAlerts,
      risk_breakdown: {
        actors_mom: momStats,
        actors_pop: popStats,
        evidence_eve: eveStats,
        sources_moses: mosesStats,
        claims: claimStats
      },
      recommended_actions: recommendedActions,
      metadata: {
        workspace_id: workspaceId,
        generated_at: new Date().toISOString(),
        data_sources: {
          actors: momActors.results?.length || 0,
          sources: mosesSources.results?.length || 0,
          content_analyses: claimAnalyses.results?.length || 0
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Deception Aggregate] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to aggregate deception data',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
