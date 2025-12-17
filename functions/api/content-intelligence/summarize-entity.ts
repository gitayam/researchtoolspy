/**
 * Entity Summarization API
 * Generates AI-powered summary of an entity's role and mentions in the content
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  OPENAI_API_KEY: string
}

interface SummarizeEntityRequest {
  content: string
  entity_name: string
  entity_type: string
  content_title?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const body = await request.json() as SummarizeEntityRequest
    const { content, entity_name, entity_type, content_title } = body

    if (!content || !entity_name || !entity_type) {
      return new Response(JSON.stringify({
        error: 'content, entity_name, and entity_type are required'
      }), {
        status: 400,
        headers: CORS_HEADERS
      })
    }

    console.log(`[Entity Summary] Generating summary for ${entity_type}: ${entity_name}`)

    // Truncate content for GPT (max 10000 chars)
    const truncatedContent = content.substring(0, 10000)

    // Extract relevant excerpts that mention the entity
    const excerpts = extractEntityMentions(truncatedContent, entity_name)

    const prompt = `Based on the following content${content_title ? ` titled "${content_title}"` : ''}, provide a 2-3 sentence summary about ${entity_name} (${entity_type}).

Focus on:
- What role does ${entity_name} play in this content?
- What key information is mentioned about ${entity_name}?
- What is the significance or context of ${entity_name}?

Content excerpts mentioning ${entity_name}:
${excerpts.slice(0, 5).map((e, i) => `${i + 1}. ...${e}...`).join('\n\n')}

${excerpts.length === 0 ? `Full context (first 2000 chars):\n${truncatedContent.substring(0, 2000)}` : ''}

Provide a concise, informative summary in 2-3 sentences.`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a research assistant that summarizes entities mentioned in documents. Provide clear, factual 2-3 sentence summaries focusing on the entity's role and significance in the given content.`
            },
            { role: 'user', content: prompt }
          ],
          max_completion_tokens: 300,
          temperature: 0.7
        })
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json() as any

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response')
      }

      const summary = data.choices[0].message.content.trim()

      console.log(`[Entity Summary] Generated summary for ${entity_name}: ${summary.substring(0, 100)}...`)

      return new Response(JSON.stringify({
        entity_name,
        entity_type,
        summary,
        mentions_found: excerpts.length,
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: CORS_HEADERS
      })

    } catch (error) {
      console.error('[Entity Summary] AI error:', error)

      // Fallback to simple mention count summary
      const mentionCount = (truncatedContent.match(new RegExp(entity_name, 'gi')) || []).length
      const fallbackSummary = `${entity_name} is mentioned ${mentionCount} time${mentionCount !== 1 ? 's' : ''} in this content. Unable to generate detailed AI summary at this time.`

      return new Response(JSON.stringify({
        entity_name,
        entity_type,
        summary: fallbackSummary,
        mentions_found: mentionCount,
        fallback: true,
        generated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: CORS_HEADERS
      })
    }

  } catch (error) {
    console.error('[Entity Summary] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate entity summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: CORS_HEADERS
  })
}

/**
 * Extract text excerpts that mention the entity
 */
function extractEntityMentions(content: string, entityName: string): string[] {
  const excerpts: string[] = []
  const regex = new RegExp(`\\b${escapeRegex(entityName)}\\b`, 'gi')

  // Split into sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)

  sentences.forEach(sentence => {
    if (regex.test(sentence)) {
      // Include surrounding context (prev + current + next sentence)
      excerpts.push(sentence.trim())
    }
  })

  return excerpts
}

/**
 * Escape special regex characters
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
