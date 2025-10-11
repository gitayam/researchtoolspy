/**
 * PMESII-PT URL Import
 *
 * Analyzes URL via Content Intelligence and maps to PMESII-PT dimensions
 * Uses GPT to generate dimension-specific questions and answers
 */

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
}

interface ImportRequest {
  url: string
  framework_id?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as ImportRequest

    if (!body.url) {
      return new Response(JSON.stringify({
        error: 'Missing URL'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Step 1: Analyze URL via Content Intelligence
    const analyzeResponse = await fetch(`${new URL(context.request.url).origin}/api/content-intelligence/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: body.url,
        mode: 'quick'
      })
    })

    if (!analyzeResponse.ok) {
      throw new Error('Failed to analyze URL')
    }

    const { analysis } = await analyzeResponse.json()

    // Step 2: Use GPT to map content to PMESII-PT dimensions
    const mappedDimensions = await mapToPMESIIPT(context.env, analysis)

    return new Response(JSON.stringify({
      success: true,
      analysis_id: analysis.id,
      url: body.url,
      title: analysis.title,
      dimensions: mappedDimensions
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error) {
    console.error('[PMESII-PT Import] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to import URL',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}

async function mapToPMESIIPT(env: Env, analysis: any) {
  const prompt = `You are an expert analyst using the PMESII-PT framework (Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time).

Analyze the following content and generate 2-3 relevant questions and answers for EACH of the 8 PMESII-PT dimensions:

**Content Summary:**
${analysis.summary || 'No summary available'}

**Extracted Entities:**
- People: ${(analysis.entities?.people || []).map((p: any) => p.name).slice(0, 5).join(', ')}
- Organizations: ${(analysis.entities?.organizations || []).map((o: any) => o.name).slice(0, 5).join(', ')}
- Locations: ${(analysis.entities?.locations || []).map((l: any) => l.name).slice(0, 5).join(', ')}
- Money: ${(analysis.entities?.money || []).map((m: any) => m.name).slice(0, 3).join(', ')}
- Dates: ${(analysis.entities?.dates || []).map((d: any) => d.name).slice(0, 3).join(', ')}

**Word Frequency (Top Phrases):**
${(analysis.top_phrases || []).slice(0, 10).map((p: any) => p.phrase).join(', ')}

Generate questions and answers following these guidelines:

**POLITICAL**: Government structure, leadership, political actors, governance, political stability, elections, policy decisions
**MILITARY**: Armed forces, defense capabilities, military operations, security forces, weapons systems, military doctrine, conflicts
**ECONOMIC**: Economy, GDP, trade, resources, financial systems, sanctions, economic policies, industry, employment
**SOCIAL**: Demographics, culture, education, religion, social structures, ethnicity, language, civil society, public opinion
**INFORMATION**: Media landscape, propaganda, information flow, communications infrastructure, social media, misinformation
**INFRASTRUCTURE**: Transportation, utilities, facilities, communications networks, physical infrastructure, supply chains
**PHYSICAL**: Geography, terrain, climate, environmental factors, natural resources, borders, physical constraints
**TIME**: Historical context, temporal patterns, timelines, deadlines, seasonal factors, long-term trends, critical dates

Return a JSON object with this structure:
{
  "political": [{"question": "...", "answer": "..."}],
  "military": [{"question": "...", "answer": "..."}],
  "economic": [{"question": "...", "answer": "..."}],
  "social": [{"question": "...", "answer": "..."}],
  "information": [{"question": "...", "answer": "..."}],
  "infrastructure": [{"question": "...", "answer": "..."}],
  "physical": [{"question": "...", "answer": "..."}],
  "time": [{"question": "...", "answer": "..."}]
}

For dimensions where the content provides no relevant information, return an empty array [].`

  const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert analyst specializing in PMESII-PT framework analysis. Generate insightful, evidence-based questions and answers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })
  })

  if (!gptResponse.ok) {
    console.error('[PMESII-PT] GPT API error:', await gptResponse.text())
    throw new Error('Failed to generate PMESII-PT mapping')
  }

  const gptData = await gptResponse.json()
  const dimensions = JSON.parse(gptData.choices[0].message.content)

  console.log('[PMESII-PT] Generated dimensions:', Object.keys(dimensions).map(k => `${k}: ${dimensions[k].length} items`))

  return dimensions
}
