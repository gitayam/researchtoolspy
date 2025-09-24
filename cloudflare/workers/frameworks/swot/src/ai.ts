/**
 * AI Integration for SWOT Framework
 * Handles AI-powered suggestions, validation, and analysis
 */

import { Env } from '../../../shared/types';
import { SWOTData, AISuggestions, AIValidation, ValidationIssue } from './types';

/**
 * Generate AI suggestions for SWOT analysis
 */
export async function generateAISuggestions(
  swotData: SWOTData,
  env: Env
): Promise<AISuggestions | null> {
  if (!env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured');
    return null;
  }

  try {
    const prompt = constructSuggestionsPrompt(swotData);
    const response = await callOpenAI(prompt, env.OPENAI_API_KEY);

    if (!response) {
      return null;
    }

    return parseSuggestionsResponse(response);
  } catch (error) {
    console.error('AI suggestions error:', error);
    return null;
  }
}

/**
 * Validate SWOT analysis with AI
 */
export async function validateWithAI(
  swotData: SWOTData,
  env: Env
): Promise<AIValidation> {
  if (!env.OPENAI_API_KEY) {
    return performBasicValidation(swotData);
  }

  try {
    const prompt = constructValidationPrompt(swotData);
    const response = await callOpenAI(prompt, env.OPENAI_API_KEY);

    if (!response) {
      return performBasicValidation(swotData);
    }

    return parseValidationResponse(response);
  } catch (error) {
    console.error('AI validation error:', error);
    return performBasicValidation(swotData);
  }
}

/**
 * Construct prompt for AI suggestions
 */
function constructSuggestionsPrompt(swotData: SWOTData): string {
  return `You are a strategic business analyst expert in SWOT analysis. Analyze the following SWOT framework and provide additional suggestions:

Objective: ${swotData.objective}
Context: ${swotData.context || 'Not specified'}

Current Analysis:
STRENGTHS:
${swotData.strengths.map(s => `- ${s}`).join('\n') || '- None specified'}

WEAKNESSES:
${swotData.weaknesses.map(w => `- ${w}`).join('\n') || '- None specified'}

OPPORTUNITIES:
${swotData.opportunities.map(o => `- ${o}`).join('\n') || '- None specified'}

THREATS:
${swotData.threats.map(t => `- ${t}`).join('\n') || '- None specified'}

Please provide:
1. 3-5 additional strengths that haven't been identified
2. 3-5 additional weaknesses to consider
3. 3-5 additional opportunities to explore
4. 3-5 additional threats to monitor
5. 2-3 key strategic insights based on the analysis
6. 2-3 actionable recommendations

Respond in JSON format:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "opportunities": ["..."],
  "threats": ["..."],
  "insights": ["..."],
  "recommendations": ["..."],
  "confidence": 0.0-1.0
}`;
}

/**
 * Construct prompt for AI validation
 */
function constructValidationPrompt(swotData: SWOTData): string {
  return `You are a strategic analysis expert. Validate the following SWOT analysis for completeness, consistency, and quality:

Objective: ${swotData.objective}
Context: ${swotData.context || 'Not specified'}

STRENGTHS (${swotData.strengths.length} items):
${swotData.strengths.map(s => `- ${s}`).join('\n') || '- None'}

WEAKNESSES (${swotData.weaknesses.length} items):
${swotData.weaknesses.map(w => `- ${w}`).join('\n') || '- None'}

OPPORTUNITIES (${swotData.opportunities.length} items):
${swotData.opportunities.map(o => `- ${o}`).join('\n') || '- None'}

THREATS (${swotData.threats.length} items):
${swotData.threats.map(t => `- ${t}`).join('\n') || '- None'}

Evaluate and provide:
1. Completeness score (0-100): Are all key areas covered?
2. Consistency score (0-100): Are items properly categorized and non-contradictory?
3. Quality score (0-100): Are items specific, actionable, and relevant?
4. List any issues found (missing areas, vague items, contradictions, duplicates)
5. Suggestions for improvement

Respond in JSON format:
{
  "is_valid": boolean,
  "completeness_score": 0-100,
  "consistency_score": 0-100,
  "quality_score": 0-100,
  "issues": [
    {
      "category": "strengths|weaknesses|opportunities|threats",
      "issue_type": "missing|vague|contradictory|duplicate",
      "description": "...",
      "severity": "low|medium|high"
    }
  ],
  "suggestions": ["..."]
}`;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  prompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a strategic business analyst expert in SWOT analysis. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('OpenAI API call error:', error);
    return null;
  }
}

/**
 * Parse AI suggestions response
 */
function parseSuggestionsResponse(response: string): AISuggestions {
  try {
    const parsed = JSON.parse(response);
    return {
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      opportunities: parsed.opportunities || [],
      threats: parsed.threats || [],
      insights: parsed.insights || [],
      recommendations: parsed.recommendations || [],
      confidence: parsed.confidence || 0.8,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to parse AI suggestions:', error);
    return {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
      insights: [],
      recommendations: [],
      confidence: 0,
      generated_at: new Date().toISOString(),
    };
  }
}

/**
 * Parse AI validation response
 */
function parseValidationResponse(response: string): AIValidation {
  try {
    const parsed = JSON.parse(response);
    return {
      is_valid: parsed.is_valid ?? true,
      completeness_score: parsed.completeness_score || 0,
      consistency_score: parsed.consistency_score || 0,
      quality_score: parsed.quality_score || 0,
      issues: parsed.issues || [],
      suggestions: parsed.suggestions || [],
    };
  } catch (error) {
    console.error('Failed to parse AI validation:', error);
    return performBasicValidation({ strengths: [], weaknesses: [], opportunities: [], threats: [] } as SWOTData);
  }
}

/**
 * Perform basic validation without AI
 */
function performBasicValidation(swotData: SWOTData): AIValidation {
  const issues: ValidationIssue[] = [];
  const suggestions: string[] = [];

  // Check completeness
  const totalItems =
    swotData.strengths.length +
    swotData.weaknesses.length +
    swotData.opportunities.length +
    swotData.threats.length;

  if (swotData.strengths.length === 0) {
    issues.push({
      category: 'strengths',
      issue_type: 'missing',
      description: 'No strengths identified',
      severity: 'high',
    });
    suggestions.push('Add at least 3-5 organizational or project strengths');
  }

  if (swotData.weaknesses.length === 0) {
    issues.push({
      category: 'weaknesses',
      issue_type: 'missing',
      description: 'No weaknesses identified',
      severity: 'high',
    });
    suggestions.push('Identify 3-5 areas for improvement or limitations');
  }

  if (swotData.opportunities.length === 0) {
    issues.push({
      category: 'opportunities',
      issue_type: 'missing',
      description: 'No opportunities identified',
      severity: 'high',
    });
    suggestions.push('Explore 3-5 external opportunities or market trends');
  }

  if (swotData.threats.length === 0) {
    issues.push({
      category: 'threats',
      issue_type: 'missing',
      description: 'No threats identified',
      severity: 'high',
    });
    suggestions.push('Consider 3-5 external risks or challenges');
  }

  // Check for vague items
  const checkVague = (items: string[], category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats') => {
    items.forEach(item => {
      if (item.length < 10) {
        issues.push({
          category,
          issue_type: 'vague',
          description: `Item too brief: "${item}"`,
          severity: 'low',
        });
      }
    });
  };

  checkVague(swotData.strengths, 'strengths');
  checkVague(swotData.weaknesses, 'weaknesses');
  checkVague(swotData.opportunities, 'opportunities');
  checkVague(swotData.threats, 'threats');

  // Calculate scores
  const completenessScore = Math.min(100, (totalItems / 16) * 100); // Expecting ~4 items per category
  const hasIssues = issues.filter(i => i.severity === 'high').length > 0;
  const consistencyScore = hasIssues ? 60 : 85;
  const qualityScore = Math.max(0, 100 - (issues.length * 10));

  return {
    is_valid: !hasIssues,
    completeness_score: Math.round(completenessScore),
    consistency_score: consistencyScore,
    quality_score: Math.round(qualityScore),
    issues,
    suggestions,
  };
}

/**
 * Generate industry-specific SWOT suggestions
 */
export async function generateIndustrySpecificSuggestions(
  swotData: SWOTData,
  industry: string,
  env: Env
): Promise<AISuggestions | null> {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const prompt = `Generate SWOT suggestions specific to the ${industry} industry.
Context: ${swotData.context}
Objective: ${swotData.objective}

Provide industry-specific:
1. Key strengths typical in ${industry}
2. Common weaknesses in ${industry}
3. Emerging opportunities in ${industry}
4. Industry-specific threats

Respond in JSON format with strengths, weaknesses, opportunities, threats arrays.`;

  try {
    const response = await callOpenAI(prompt, env.OPENAI_API_KEY);
    return response ? parseSuggestionsResponse(response) : null;
  } catch (error) {
    console.error('Industry-specific suggestions error:', error);
    return null;
  }
}

/**
 * Generate strategic options from SWOT matrix
 */
export async function generateStrategicOptions(
  swotData: SWOTData,
  env: Env
): Promise<any> {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const prompt = `Based on this SWOT analysis, generate strategic options using TOWS matrix:

Strengths: ${swotData.strengths.join(', ')}
Weaknesses: ${swotData.weaknesses.join(', ')}
Opportunities: ${swotData.opportunities.join(', ')}
Threats: ${swotData.threats.join(', ')}

Generate:
1. SO Strategies (use strengths to capitalize on opportunities)
2. WO Strategies (overcome weaknesses by pursuing opportunities)
3. ST Strategies (use strengths to avoid threats)
4. WT Strategies (minimize weaknesses and avoid threats)

Provide 2-3 strategies for each category with priority and complexity ratings.`;

  try {
    const response = await callOpenAI(prompt, env.OPENAI_API_KEY);
    return response ? JSON.parse(response) : null;
  } catch (error) {
    console.error('Strategic options generation error:', error);
    return null;
  }
}