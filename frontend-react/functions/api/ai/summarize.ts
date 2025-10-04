/**
 * AI Summarization API
 *
 * POST: Summarize content (executive, standard, comprehensive)
 */

interface Env {
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  ENABLE_AI_FEATURES?: string
}

interface SummarizeRequest {
  content: string
  mode?: 'executive' | 'standard' | 'comprehensive'
}

const VERBOSITY_MAP = {
  executive: 'low',
  standard: 'medium',
  comprehensive: 'high'
} as const

/**
 * POST /api/ai/summarize
 * Summarize content
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (context.env.ENABLE_AI_FEATURES !== 'true') {
      return Response.json({ error: 'AI features are disabled' }, { status: 403 })
    }

    const apiKey = context.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const request = await context.request.json() as SummarizeRequest

    if (!request.content) {
      return Response.json({ error: 'Missing content to summarize' }, { status: 400 })
    }

    const mode = request.mode || 'standard'
    const verbosity = VERBOSITY_MAP[mode]

    // Build summarization prompt
    const prompt = `Summarize the following content as a ${mode} summary:

${request.content}

Requirements:
- Preserve key facts and findings
- Use intelligence community writing standards
- ${mode === 'executive' ? 'Limit to 2-3 sentences (BLUF format)' : mode === 'standard' ? 'Limit to 1 paragraph' : 'Provide comprehensive multi-paragraph summary with structure'}

${mode === 'executive' ? 'Format as a single paragraph with the most critical finding first.' : ''}
${mode === 'comprehensive' ? 'Use markdown headings (##) to organize sections.' : ''}`

    // Get model for summarization
    const config = await context.env.AI_CONFIG.get('default', { type: 'json' }) as any
    const model = config?.useCases?.summarization || 'gpt-5-mini'
    const modelSettings = config?.models?.[model] || {
      verbosity: 'medium',
      maxTokens: 2048,
      systemPrompt: 'You are an intelligence analyst assistant.'
    }

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(context.env.OPENAI_ORGANIZATION && { 'OpenAI-Organization': context.env.OPENAI_ORGANIZATION })
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: modelSettings.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: modelSettings.maxTokens,
        verbosity
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
      return Response.json({
        error: 'Summarization failed',
        message: error.error?.message || response.statusText
      }, { status: response.status })
    }

    const data = await response.json()

    return Response.json({
      summary: data.choices[0].message.content,
      mode,
      tokensUsed: data.usage.total_tokens
    })
  } catch (error) {
    console.error('Summarization error:', error)
    return Response.json({
      error: 'Summarization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
