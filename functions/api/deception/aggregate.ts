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
    // Check if DB binding is available
    if (!context.env.DB) {
      console.error('[Deception Aggregate] DB binding not available')
      return new Response(JSON.stringify({
        error: 'Database not configured',
        details: 'DB binding is not available. Please configure D1 database in Cloudflare Pages settings.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const userId = await getUserIdOrDefault(context.request, context.env)
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
    const eveEvidence = await context.env.DB.prepare(`
      SELECT
        e.id,
        e.title,
        e.eve_assessment
      FROM evidence e
      WHERE e.workspace_id = ?
        AND e.eve_assessment IS NOT NULL
    `).bind(workspaceId).all()

    let eveStats = { suspicious: 0, needs_review: 0, verified: 0, avg_score: 0, total: 0 }
    let eveAlerts: Alert[] = []

    if (eveEvidence.results) {
      const scores: number[] = []
      for (const evidence of eveEvidence.results as any[]) {
        try {
          const eve = typeof evidence.eve_assessment === 'string'
            ? JSON.parse(evidence.eve_assessment)
            : evidence.eve_assessment

          if (eve) {
            // EVE uses inverted scores for consistency/corroboration (high = good = low risk)
            // anomaly_detection is normal (high = bad = high risk)
            const consistencyRisk = 5 - (eve.internal_consistency ?? 3)
            const corroborationRisk = 5 - (eve.external_corroboration ?? 3)
            const anomalyRisk = eve.anomaly_detection ?? 0
            const avgScore = (consistencyRisk + corroborationRisk + anomalyRisk) / 3
            scores.push(avgScore)

            if (avgScore >= 3.5) {
              eveStats.suspicious++
              eveAlerts.push({
                type: 'EVIDENCE_EVE',
                entity_type: 'EVIDENCE',
                entity_id: evidence.id,
                entity_name: evidence.title || `Evidence #${evidence.id}`,
                risk_score: avgScore,
                severity: avgScore >= 4.0 ? 'CRITICAL' : 'HIGH',
                details: `Low consistency (${eve.internal_consistency}), low corroboration (${eve.external_corroboration}), anomalies (${eve.anomaly_detection})`,
                url: `/dashboard/evidence/${evidence.id}`
              })
            } else if (avgScore >= 2.0) {
              eveStats.needs_review++
            } else {
              eveStats.verified++
            }
          }
        } catch (e) {
          console.error('[EVE] Failed to parse eve_assessment for evidence:', evidence.id, e)
        }
      }
      eveStats.total = scores.length
      eveStats.avg_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    }

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
    // Query claims by workspace_id if available, fallback to user_id
    const claimAnalyses = await context.env.DB.prepare(`
      SELECT
        ca.id,
        ca.title,
        ca.url,
        ca.claim_analysis
      FROM content_analysis ca
      WHERE (ca.workspace_id = ? OR (ca.workspace_id IS NULL AND ca.user_id = ?))
        AND ca.claim_analysis IS NOT NULL
      ORDER BY ca.created_at DESC
      LIMIT 200
    `).bind(workspaceId, userId).all()

    let claimStats = { high: 0, medium: 0, low: 0, avg_score: 0, total: 0 }
    let claimAlerts: Alert[] = []

    if (claimAnalyses.results) {
      const scores: number[] = []
      for (const analysis of claimAnalyses.results as any[]) {
        try {
          const claimData = typeof analysis.claim_analysis === 'string'
            ? JSON.parse(analysis.claim_analysis)
            : analysis.claim_analysis

          if (claimData?.claims) {
            for (const claim of claimData.claims) {
              const riskScore = claim.deception_analysis?.risk_score ?? 0
              scores.push(riskScore)

              if (riskScore > 60) {
                claimStats.high++
                if (riskScore > 75) {
                  claimAlerts.push({
                    type: 'CLAIM_DECEPTION',
                    entity_type: 'CLAIM',
                    entity_id: analysis.id,
                    entity_name: (claim.claim || '').substring(0, 80) + ((claim.claim || '').length > 80 ? '...' : ''),
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

    // ===== 6. SAVED DECEPTION FRAMEWORK ANALYSES =====
    const frameworkAnalyses = await context.env.DB.prepare(`
      SELECT
        fs.id,
        fs.title,
        fs.data,
        fs.created_at
      FROM framework_sessions fs
      WHERE fs.workspace_id = ?
        AND fs.framework_type = 'deception'
        AND fs.data IS NOT NULL
      ORDER BY fs.updated_at DESC
      LIMIT 50
    `).bind(workspaceId).all()

    let frameworkStats = { high: 0, medium: 0, low: 0, avg_score: 0, total: 0 }
    let frameworkAlerts: Alert[] = []

    if (frameworkAnalyses.results) {
      const scores: number[] = []
      for (const analysis of frameworkAnalyses.results as any[]) {
        try {
          const data = typeof analysis.data === 'string'
            ? JSON.parse(analysis.data)
            : analysis.data

          if (data?.scores) {
            // Calculate overall likelihood from saved scores using same algorithm
            const mom = ((data.scores.motive ?? 0) + (data.scores.opportunity ?? 0) + (data.scores.means ?? 0)) / 3
            const pop = ((data.scores.historicalPattern ?? 0) + (data.scores.sophisticationLevel ?? 0) + (data.scores.successRate ?? 0)) / 3
            const moses = ((data.scores.sourceVulnerability ?? 0) + (data.scores.manipulationEvidence ?? 0)) / 2
            const eve = ((5 - (data.scores.internalConsistency ?? 5)) + (5 - (data.scores.externalCorroboration ?? 5)) + (data.scores.anomalyDetection ?? 0)) / 3
            const likelihood = Math.round((mom * 30 + pop * 25 + moses * 25 + eve * 20) / 5)

            scores.push(likelihood)

            if (likelihood >= 60) {
              frameworkStats.high++
              if (likelihood >= 75) {
                frameworkAlerts.push({
                  type: 'CLAIM_DECEPTION',
                  entity_type: 'CLAIM',
                  entity_id: analysis.id,
                  entity_name: analysis.title || `Analysis #${analysis.id}`,
                  risk_score: likelihood,
                  severity: likelihood >= 80 ? 'CRITICAL' : 'HIGH',
                  details: `SATS analysis: ${likelihood}% deception likelihood`,
                  url: `/dashboard/analysis-frameworks/deception/${analysis.id}`
                })
              }
            } else if (likelihood >= 40) {
              frameworkStats.medium++
            } else {
              frameworkStats.low++
            }
          }
        } catch (e) {
          console.error('[Framework] Failed to parse data for analysis:', analysis.id, e)
        }
      }
      frameworkStats.total = scores.length
      frameworkStats.avg_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    }

    // ===== CALCULATE OVERALL RISK SCORE =====
    // Include framework analyses in calculation (they're on 0-100 scale)
    const frameworkWeight = frameworkStats.total > 0 ? 0.15 : 0
    const adjustedWeights = {
      mom: frameworkWeight > 0 ? 0.20 : 0.25,
      pop: frameworkWeight > 0 ? 0.18 : 0.20,
      eve: frameworkWeight > 0 ? 0.22 : 0.25,
      moses: frameworkWeight > 0 ? 0.13 : 0.15,
      claims: frameworkWeight > 0 ? 0.12 : 0.15
    }

    const overallRiskScore = Math.round(
      (momStats.avg_score * 20 * adjustedWeights.mom) +  // MOM: 0-5 scale → 0-100
      (popStats.avg_score * 20 * adjustedWeights.pop) +  // POP: 0-5 scale → 0-100
      (eveStats.avg_score * 20 * adjustedWeights.eve) +  // EVE: 0-5 scale → 0-100
      (mosesStats.avg_score * 20 * adjustedWeights.moses) + // MOSES: 0-5 scale → 0-100
      (claimStats.avg_score * adjustedWeights.claims) +  // Claims: already 0-100
      (frameworkStats.avg_score * frameworkWeight)       // Framework: already 0-100
    )

    const riskLevel =
      overallRiskScore >= 75 ? 'CRITICAL' :
      overallRiskScore >= 60 ? 'HIGH' :
      overallRiskScore >= 40 ? 'MEDIUM' : 'LOW'

    // ===== COMBINE ALL ALERTS =====
    const allAlerts = [...momAlerts, ...eveAlerts, ...mosesAlerts, ...claimAlerts, ...frameworkAlerts]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 15) // Top 15 alerts

    // ===== GENERATE RECOMMENDED ACTIONS =====
    const recommendedActions = []
    if (frameworkAlerts.length > 0) {
      recommendedActions.push({
        priority: 1,
        action: `Review SATS analysis: '${frameworkAlerts[0].entity_name}'`,
        entity_type: 'FRAMEWORK',
        entity_id: frameworkAlerts[0].entity_id,
        url: frameworkAlerts[0].url
      })
    }
    if (momAlerts.length > 0) {
      recommendedActions.push({
        priority: recommendedActions.length + 1,
        action: `Review MOM assessment for '${momAlerts[0].entity_name}'`,
        entity_type: 'ACTOR',
        entity_id: momAlerts[0].entity_id,
        url: momAlerts[0].url
      })
    }
    if (eveAlerts.length > 0) {
      recommendedActions.push({
        priority: recommendedActions.length + 1,
        action: `Verify evidence quality: '${eveAlerts[0].entity_name}'`,
        entity_type: 'EVIDENCE',
        entity_id: eveAlerts[0].entity_id,
        url: eveAlerts[0].url
      })
    }
    if (mosesAlerts.length > 0) {
      recommendedActions.push({
        priority: recommendedActions.length + 1,
        action: `Verify source credibility for '${mosesAlerts[0].entity_name}'`,
        entity_type: 'SOURCE',
        entity_id: mosesAlerts[0].entity_id,
        url: mosesAlerts[0].url
      })
    }
    if (claimAlerts.length > 0) {
      recommendedActions.push({
        priority: recommendedActions.length + 1,
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
        claims: claimStats,
        framework_analyses: frameworkStats
      },
      recommended_actions: recommendedActions,
      metadata: {
        workspace_id: workspaceId,
        generated_at: new Date().toISOString(),
        data_sources: {
          actors: momActors.results?.length || 0,
          sources: mosesSources.results?.length || 0,
          evidence: eveEvidence.results?.length || 0,
          content_analyses: claimAnalyses.results?.length || 0,
          framework_analyses: frameworkAnalyses.results?.length || 0
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
