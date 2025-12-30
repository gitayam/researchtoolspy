import { Env } from '../../types'

interface BatchItem {
  id: string
  type: 'url' | 'file'
  source: string
  metadata?: any
}

interface BatchOptions {
  maxWorkers?: number
  retryFailed?: boolean
  stopOnError?: boolean
  createDatasets?: boolean
}

interface BatchRequest {
  operation: 'analyze-url' | 'extract-content' | 'generate-citation' | 'scrape-metadata'
  items: BatchItem[]
  options?: BatchOptions
}

// Process a single URL based on operation type
async function processSingleURL(url: string, operation: string): Promise<any> {
  const startTime = Date.now()

  try {
    let endpoint = ''
    let body: any = { url }

    switch (operation) {
      case 'analyze-url':
        endpoint = '/api/tools/analyze-url'
        body.checkWayback = true
        body.checkSEO = true
        break
      case 'scrape-metadata':
        endpoint = '/api/tools/scrape-metadata'
        break
      case 'extract-content':
        endpoint = '/api/tools/extract'
        break
      default:
        throw new Error(`Unsupported operation: ${operation}`)
    }

    const response = await fetch(`https://cloudflare-react-nextjs-to-v.researchtoolspy.pages.dev${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    const duration = Date.now() - startTime

    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.error || 'Request failed',
        duration
      }
    }

    return {
      success: true,
      data,
      duration
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Processing failed',
      duration: Date.now() - startTime
    }
  }
}

// Process items in parallel batches
async function processInBatches(items: BatchItem[], operation: string, maxWorkers: number, stopOnError: boolean) {
  const results: any[] = []
  let succeeded = 0
  let failed = 0

  // Process in chunks of maxWorkers
  for (let i = 0; i < items.length; i += maxWorkers) {
    const batch = items.slice(i, i + maxWorkers)

    // Process batch in parallel
    const batchPromises = batch.map(async (item) => {
      const itemResult = {
        id: item.id,
        type: item.type,
        source: item.source,
        status: 'processing' as const,
        startedAt: new Date().toISOString(),
        completedAt: '',
        duration: 0,
        result: null as any,
        error: ''
      }

      try {
        const result = await processSingleURL(item.source, operation)

        itemResult.completedAt = new Date().toISOString()
        itemResult.duration = result.duration

        if (result.success) {
          itemResult.status = 'success'
          itemResult.result = result.data
          succeeded++
        } else {
          itemResult.status = 'error'
          itemResult.error = result.error
          failed++
        }
      } catch (error: any) {
        itemResult.status = 'error'
        itemResult.error = error.message || 'Unknown error'
        itemResult.completedAt = new Date().toISOString()
        failed++
      }

      return itemResult
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // Stop if error occurred and stopOnError is true
    if (stopOnError && failed > 0) {
      // Mark remaining items as pending
      for (let j = i + maxWorkers; j < items.length; j++) {
        results.push({
          id: items[j].id,
          type: items[j].type,
          source: items[j].source,
          status: 'pending',
          error: 'Stopped due to previous error'
        })
      }
      break
    }
  }

  return { results, succeeded, failed }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request } = context
  const startTime = Date.now()

  try {
    const body = await request.json() as BatchRequest

    if (!body.operation) {
      return new Response(JSON.stringify({ error: 'Operation is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!body.items || body.items.length === 0) {
      return new Response(JSON.stringify({ error: 'Items array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Limit batch size to avoid timeout (Cloudflare Workers have 30s CPU time limit)
    const MAX_BATCH_SIZE = 20
    if (body.items.length > MAX_BATCH_SIZE) {
      return new Response(JSON.stringify({
        error: `Batch size limited to ${MAX_BATCH_SIZE} items. You provided ${body.items.length} items.`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Assign IDs to items if not provided
    const items = body.items.map((item, index) => ({
      ...item,
      id: item.id || `item-${index + 1}`
    }))

    // Default options
    const options = {
      maxWorkers: body.options?.maxWorkers || 3,
      retryFailed: body.options?.retryFailed || false,
      stopOnError: body.options?.stopOnError || false,
      createDatasets: body.options?.createDatasets || false
    }

    // Validate maxWorkers
    if (options.maxWorkers < 1 || options.maxWorkers > 5) {
      return new Response(JSON.stringify({
        error: 'maxWorkers must be between 1 and 5'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Process batch
    const { results, succeeded, failed } = await processInBatches(
      items,
      body.operation,
      options.maxWorkers,
      options.stopOnError
    )

    const duration = Date.now() - startTime
    const jobId = `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const response = {
      jobId,
      operation: body.operation,
      status: failed === 0 ? 'completed' : (succeeded === 0 ? 'failed' : 'completed'),
      total: items.length,
      processed: succeeded + failed,
      succeeded,
      failed,
      items: results,
      options,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      duration
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Batch processing error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to process batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

// Handle OPTIONS requests for CORS
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
