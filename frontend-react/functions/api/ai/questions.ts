/**
 * AI Question Generation API
 *
 * POST: Generate analytical questions based on framework context
 */

interface Env {
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  ENABLE_AI_FEATURES?: string
}

interface QuestionRequest {
  framework: string
  completedFields: Record<string, any>
  linkedEvidence?: any[]
}

/**
 * POST /api/ai/questions
 * Generate analytical questions
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

    const request = await context.request.json() as QuestionRequest

    if (!request.framework || !request.completedFields) {
      return Response.json({ error: 'Missing framework or completed fields' }, { status: 400 })
    }

    // Build question generation prompt
    const prompt = `Framework: ${request.framework}
Completed Analysis:
${JSON.stringify(request.completedFields, null, 2)}

${request.linkedEvidence ? `Linked Evidence: ${request.linkedEvidence.length} items\n` : ''}

Generate 4-6 probing analytical questions that would strengthen this analysis.

Question types to include:
1. **Evidence Gaps**: What information is missing?
2. **Alternative Hypotheses**: What other explanations exist?
3. **Contradictions**: What inconsistencies need resolution?
4. **Collection Priorities**: What should be gathered next?

Each question should:
- Be specific to the analysis content
- Encourage critical thinking
- Identify actionable next steps
- Challenge assumptions

Return ONLY a JSON array of strings: ["Question 1?", "Question 2?", ...]
No explanations, just the JSON array.`

    // Get model for question generation
    const config = await context.env.AI_CONFIG.get('default', { type: 'json' }) as any
    const model = config?.useCases?.questionGeneration || 'gpt-5-nano'
    const modelSettings = config?.models?.[model] || {
      verbosity: 'low',
      reasoningEffort: 'minimal',
      maxTokens: 1024,
      systemPrompt: 'You are a research assistant.'
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
          { role: 'system', content: 'You are an analytical quality assurance assistant. Generate probing questions that help analysts identify gaps, biases, and alternative hypotheses. Be specific and encourage critical thinking.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: modelSettings.maxTokens,
        verbosity: modelSettings.verbosity,
        ...(modelSettings.reasoningEffort && { reasoning_effort: modelSettings.reasoningEffort })
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
      return Response.json({
        error: 'Question generation failed',
        message: error.error?.message || response.statusText
      }, { status: response.status })
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Try to parse as JSON
    let questions: string[]
    try {
      questions = JSON.parse(content)
    } catch {
      // Fallback: parse numbered list
      questions = content
        .split('\n')
        .filter((line: string) => /^\d+\./.test(line.trim()))
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    }

    return Response.json({
      questions,
      tokensUsed: data.usage.total_tokens
    })
  } catch (error) {
    console.error('Question generation error:', error)
    return Response.json({
      error: 'Question generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
