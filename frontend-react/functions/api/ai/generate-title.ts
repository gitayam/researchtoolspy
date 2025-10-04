/**
 * AI Title Generation API
 *
 * Generates meaningful titles for framework analyses based on framework type and data
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  OPENAI_API_KEY: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const { frameworkType, data, description } = await request.json()

    if (!frameworkType) {
      return new Response(
        JSON.stringify({ error: 'Framework type is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Build context from data
    let context = `Framework Type: ${frameworkType}\n`

    if (description) {
      context += `Description: ${description}\n`
    }

    // Extract key information from data
    if (data) {
      const itemCount = Object.keys(data)
        .filter(key => Array.isArray(data[key]))
        .reduce((sum, key) => sum + data[key].length, 0)

      if (itemCount > 0) {
        context += `Total items: ${itemCount}\n`
      }

      // Sample some items from the data
      const sampleItems: string[] = []
      Object.keys(data).forEach(key => {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          const items = data[key].slice(0, 2) // Take first 2 items from each section
          items.forEach((item: any) => {
            const text = typeof item === 'string' ? item : item.text
            if (text) sampleItems.push(text)
          })
        }
      })

      if (sampleItems.length > 0) {
        context += `Sample items:\n${sampleItems.slice(0, 5).join('\n')}\n`
      }
    }

    // Generate title using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert analyst who creates concise, meaningful titles for analytical frameworks. Generate a clear, professional title that captures the essence of the analysis. The title should be:
- Concise (3-8 words)
- Descriptive and specific
- Professional
- Action-oriented when appropriate

Return ONLY the title, nothing else.`
          },
          {
            role: 'user',
            content: `Generate a title for this ${frameworkType} analysis:\n\n${context}`
          }
        ],
        temperature: 0.7,
        max_tokens: 50
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to generate title' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const aiResponse = await response.json()
    const title = aiResponse.choices[0]?.message?.content?.trim() || 'Untitled Analysis'

    return new Response(
      JSON.stringify({ title }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error: any) {
    console.error('Title generation error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
}
