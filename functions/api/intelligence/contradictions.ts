import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserIdOrDefault(request, env)

    const frameworks = await env.DB.prepare(`
      SELECT id, framework_type, title, data
      FROM framework_sessions
      WHERE user_id = ? AND status != 'archived'
    `).bind(userId).all<{ id: number; framework_type: string; title: string; data: string }>()

    const contradictions: any[] = []
    const fwResults = frameworks.results || []

    const parsed = fwResults.map(fw => {
      let data: any = {}
      try { data = JSON.parse(fw.data || '{}') } catch { /* skip */ }
      return { ...fw, parsedData: data }
    })

    // Detection 1: ACH hypotheses vs Deception assessment
    const achFrameworks = parsed.filter(f => f.framework_type === 'ach')
    const deceptionFrameworks = parsed.filter(f => f.framework_type === 'deception')

    for (const ach of achFrameworks) {
      for (const dec of deceptionFrameworks) {
        const topHypothesis = (ach.parsedData.hypotheses || [])
          .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))[0]
        const deceptionLikelihood = dec.parsedData.deception_likelihood ?? dec.parsedData.likelihood

        if (topHypothesis && deceptionLikelihood && deceptionLikelihood > 60) {
          contradictions.push({
            description: `ACH analysis "${ach.title}" identifies "${topHypothesis.name || topHypothesis.title}" as most likely, but Deception analysis "${dec.title}" rates deception likelihood at ${deceptionLikelihood}%`,
            side_a: { framework_type: 'ach', session_id: String(ach.id), claim: `Hypothesis "${topHypothesis.name || topHypothesis.title}" scored highest` },
            side_b: { framework_type: 'deception', session_id: String(dec.id), claim: `Deception likelihood: ${deceptionLikelihood}%` },
            severity: deceptionLikelihood > 80 ? 'CRITICAL' : 'WARNING',
            suggested_resolution: 'Review evidence quality and source reliability. Consider whether key evidence supporting the top ACH hypothesis comes from potentially deceptive sources.',
          })
        }
      }
    }

    // Detection 2: SWOT strengths vs COG vulnerabilities
    const swotFrameworks = parsed.filter(f => f.framework_type === 'swot')
    const cogFrameworks = parsed.filter(f => f.framework_type === 'cog')

    for (const swot of swotFrameworks) {
      for (const cog of cogFrameworks) {
        const strengths = (swot.parsedData.strengths || []).map((s: any) => (s.text || s.name || s).toLowerCase())
        const vulnerabilities = (cog.parsedData.cogs || cog.parsedData.centers_of_gravity || [])
          .flatMap((c: any) => (c.vulnerabilities || []).map((v: any) => (v.name || v.text || v).toLowerCase()))

        for (const strength of strengths) {
          for (const vuln of vulnerabilities) {
            const words1 = new Set(strength.split(/\s+/))
            const words2 = new Set(vuln.split(/\s+/))
            const overlap = [...words1].filter(w => words2.has(w) && w.length > 3)
            if (overlap.length >= 2) {
              contradictions.push({
                description: `SWOT identifies "${strength.substring(0, 80)}" as a strength, but COG identifies "${vuln.substring(0, 80)}" as a vulnerability`,
                side_a: { framework_type: 'swot', session_id: String(swot.id), claim: `Strength: ${strength.substring(0, 100)}` },
                side_b: { framework_type: 'cog', session_id: String(cog.id), claim: `Vulnerability: ${vuln.substring(0, 100)}` },
                severity: 'INFO',
                suggested_resolution: 'This may reflect different perspectives (internal vs external view). Investigate whether the capability is both a strength to leverage and a vulnerability to protect.',
              })
            }
          }
        }
      }
    }

    const bySeverity = { INFO: 0, WARNING: 0, CRITICAL: 0 }
    for (const c of contradictions) {
      bySeverity[c.severity as keyof typeof bySeverity]++
    }

    return new Response(JSON.stringify({
      contradictions,
      total_count: contradictions.length,
      by_severity: bySeverity,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    console.error('Intelligence contradictions error:', error)
    return new Response(JSON.stringify({ error: 'Failed to detect contradictions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
