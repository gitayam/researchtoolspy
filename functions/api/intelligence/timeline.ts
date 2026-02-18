import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserIdOrDefault(request, env)

    const [frameworkActivity, evidenceActivity, entityActivity, firstFramework] = await Promise.all([
      env.DB.prepare(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as created,
          SUM(CASE WHEN updated_at > created_at THEN 1 ELSE 0 END) as updated
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).bind(userId).all<{ date: string; created: number; updated: number }>(),

      env.DB.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM evidence_items
        WHERE created_by = ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).bind(userId).all<{ date: string; count: number }>(),

      env.DB.prepare(`
        SELECT date, SUM(count) as count FROM (
          SELECT DATE(created_at) as date, COUNT(*) as count FROM actors WHERE created_by = ? GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) as date, COUNT(*) as count FROM sources WHERE created_by = ? GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) as date, COUNT(*) as count FROM events WHERE created_by = ? GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) as date, COUNT(*) as count FROM places WHERE created_by = ? GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) as date, COUNT(*) as count FROM behaviors WHERE created_by = ? GROUP BY DATE(created_at)
        ) GROUP BY date ORDER BY date ASC
      `).bind(userId, userId, userId, userId, userId).all<{ date: string; count: number }>(),

      env.DB.prepare(`
        SELECT MIN(created_at) as first_date, framework_type
        FROM framework_sessions
        WHERE user_id = ?
      `).bind(userId).first<{ first_date: string; framework_type: string }>(),
    ])

    // Build unified daily activity
    const dateSet = new Set<string>()
    const fwByDate: Record<string, { created: number; updated: number }> = {}
    const evByDate: Record<string, number> = {}
    const entByDate: Record<string, number> = {}

    for (const r of frameworkActivity.results || []) {
      dateSet.add(r.date)
      fwByDate[r.date] = { created: r.created, updated: r.updated }
    }
    for (const r of evidenceActivity.results || []) {
      dateSet.add(r.date)
      evByDate[r.date] = r.count
    }
    for (const r of entityActivity.results || []) {
      dateSet.add(r.date)
      entByDate[r.date] = r.count
    }

    const sortedDates = Array.from(dateSet).sort()
    const activity = sortedDates.map(date => ({
      date,
      frameworks_created: fwByDate[date]?.created ?? 0,
      frameworks_updated: fwByDate[date]?.updated ?? 0,
      evidence_added: evByDate[date] ?? 0,
      entities_added: entByDate[date] ?? 0,
    }))

    // Cumulative evidence
    let cumulative = 0
    const evidenceAccumulation = sortedDates.map(date => {
      cumulative += evByDate[date] ?? 0
      return { date, cumulative }
    })

    // Milestones
    const milestones: { date: string; type: string; description: string }[] = []
    if (firstFramework?.first_date) {
      milestones.push({
        date: firstFramework.first_date.split('T')[0],
        type: 'first_framework',
        description: `First analysis created (${firstFramework.framework_type})`,
      })
    }

    return new Response(JSON.stringify({
      activity,
      evidence_accumulation: evidenceAccumulation,
      milestones,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence timeline error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch timeline data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
