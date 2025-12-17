/**
 * GPT-4o-mini Hypothesis Generation for ACH
 * Generates 4-6 competing hypotheses based on intelligence question
 */

interface Env {
  OPENAI_API_KEY: string
}

interface GenerateRequest {
  question: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as GenerateRequest

    if (!data.question) {
      return new Response(JSON.stringify({
        error: 'Question is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const apiKey = context.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Call GPT-4o-mini for hypothesis generation
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert intelligence analyst skilled in the Analysis of Competing Hypotheses (ACH) methodology.

Your task is to generate 4-6 competing hypotheses for intelligence questions. Follow these ACH principles:

1. **Mutually Exclusive**: Hypotheses should be distinct alternatives where possible
2. **Comprehensive Coverage**: Cover the full spectrum of plausible explanations
3. **Include Contrarian Views**: At least one hypothesis should challenge conventional thinking
4. **Specific & Testable**: Each hypothesis must be specific enough to evaluate with evidence
5. **Intelligence-Relevant**: Focus on intentions, capabilities, and strategic implications

Return ONLY a JSON array of hypothesis strings, no other text.`
          },
          {
            role: 'user',
            content: `Generate 4-6 competing hypotheses for this intelligence question:

"${data.question}"

Return format: ["hypothesis 1", "hypothesis 2", ...]`
          }
        ],
        temperature: 0.7,
        max_completion_tokens: 800,
        response_format: { type: 'json_object' }
      })
    })

    if (!gptResponse.ok) {
      const errorData = await gptResponse.json()
      console.error('[ACH] OpenAI API error:', errorData)
      throw new Error('OpenAI API request failed')
    }

    const gptData = await gptResponse.json()
    const content = gptData.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    // Parse the JSON response
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      console.error('[ACH] Failed to parse GPT response:', content)
      throw new Error('Invalid JSON from GPT')
    }

    // Extract hypotheses array (handle different response formats)
    let hypotheses: string[]
    if (Array.isArray(parsed)) {
      hypotheses = parsed
    } else if (parsed.hypotheses && Array.isArray(parsed.hypotheses)) {
      hypotheses = parsed.hypotheses
    } else {
      throw new Error('Unexpected response format from GPT')
    }

    // Validate hypotheses
    if (hypotheses.length < 2) {
      throw new Error('GPT generated fewer than 2 hypotheses')
    }

    if (hypotheses.length > 8) {
      hypotheses = hypotheses.slice(0, 6) // Limit to 6
    }

    return new Response(JSON.stringify({
      hypotheses,
      question: data.question,
      generated_at: new Date().toISOString(),
      model: 'gpt-4o-mini'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('[ACH] Hypothesis generation error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate hypotheses',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
