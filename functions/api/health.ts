// Health check endpoint for monitoring

interface Env {
  DB: D1Database
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const start = performance.now()
  
  let dbStatus = 'unknown'
  let dbLatency = 0

  try {
    if (env.DB) {
      const dbStart = performance.now()
      await env.DB.prepare('SELECT 1').first()
      dbLatency = performance.now() - dbStart
      dbStatus = 'connected'
    } else {
      dbStatus = 'not_configured'
    }
  } catch (err) {
    console.error('Health check DB error:', err)
    dbStatus = 'disconnected'
  }

  const totalLatency = performance.now() - start

  return new Response(JSON.stringify({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'researchtoolspy-api',
    version: '1.0.0', // Ideally from package.json
    checks: {
      database: {
        status: dbStatus,
        latency_ms: Math.round(dbLatency)
      }
    },
    latency_ms: Math.round(totalLatency)
  }), {
    status: dbStatus === 'connected' ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}