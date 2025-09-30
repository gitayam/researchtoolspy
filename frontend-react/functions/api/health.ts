// Health check endpoint for monitoring

export async function onRequest(context: any) {
  const { request } = context

  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'researchtoolspy-api',
    method: request.method,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  })
}