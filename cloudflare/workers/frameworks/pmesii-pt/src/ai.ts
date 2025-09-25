/**
 * AI-powered analysis for PMESII-PT Framework
 */

import { Env } from '../../../shared/types';
import { PMESIIData, AISuggestions, AIValidation, PMESIIFactor, PMESIICategory, PMESIIInterconnection } from './types';

/**
 * Generate AI suggestions for PMESII-PT analysis
 */
export async function generateAISuggestions(
  data: PMESIIData,
  env: Env
): Promise<AISuggestions> {
  const prompt = `You are an expert analyst specializing in PMESII-PT (Political, Military, Economic, Social, Information, Infrastructure - Physical Environment, Time) framework analysis.

Analyze the following context and generate comprehensive suggestions for each PMESII-PT category:

OBJECTIVE: ${data.objective}
CONTEXT: ${data.context}
AREA OF INTEREST: ${data.area_of_interest || 'Not specified'}
TIME FRAME: ${data.time_frame || 'Not specified'}

Current factors:
${Object.entries(data.factors)
  .map(([category, factors]) => `${category.toUpperCase()}: ${factors.length > 0 ? factors.map(f => f.title).join(', ') : 'None'}`)
  .join('\n')}

Please provide:
1. Additional relevant factors for each category that are missing
2. Potential interconnections between factors
3. Key insights about the situation
4. Strategic recommendations

For each factor, include:
- A unique identifier
- Clear title and description
- Impact level (high/medium/low)
- Likelihood percentage
- Time horizon
- Relevant stakeholders

Respond in valid JSON format with the structure:
{
  "factors": {
    "political": [...],
    "military": [...],
    "economic": [...],
    "social": [...],
    "information": [...],
    "infrastructure": [...],
    "physical_environment": [...],
    "time": [...]
  },
  "interconnections": [...],
  "insights": [...],
  "recommendations": [...],
  "confidence": 0.85
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a strategic analysis expert specializing in PMESII-PT framework analysis. Provide detailed, actionable insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    // Parse the JSON response
    let suggestions: AISuggestions;
    try {
      suggestions = JSON.parse(content);
    } catch (parseError) {
      // Fallback parsing if JSON is malformed
      suggestions = {
        factors: {
          political: [],
          military: [],
          economic: [],
          social: [],
          information: [],
          infrastructure: [],
          physical_environment: [],
          time: [],
        },
        interconnections: [],
        insights: ['AI analysis temporarily unavailable due to parsing error'],
        recommendations: ['Please try regenerating suggestions'],
        confidence: 0.5,
      };
    }

    suggestions.generated_at = new Date().toISOString();
    return suggestions;

  } catch (error) {
    console.error('AI suggestions error:', error);

    // Return fallback suggestions
    return {
      factors: generateFallbackFactors(data),
      interconnections: [],
      insights: [
        'AI analysis temporarily unavailable',
        'Consider factors across all PMESII-PT categories',
        'Look for interconnections between different domains',
      ],
      recommendations: [
        'Analyze each category systematically',
        'Consider time-based dependencies',
        'Evaluate physical environment constraints',
      ],
      confidence: 0.3,
      generated_at: new Date().toISOString(),
    };
  }
}

/**
 * Validate PMESII-PT analysis with AI
 */
export async function validateWithAI(
  data: PMESIIData,
  env: Env
): Promise<AIValidation> {
  const prompt = `Analyze this PMESII-PT analysis for completeness, quality, and consistency:

OBJECTIVE: ${data.objective}
CONTEXT: ${data.context}

Factors by category:
${Object.entries(data.factors)
  .map(([category, factors]) =>
    `${category.toUpperCase()} (${factors.length}): ${factors.map(f => f.title).join(', ')}`
  )
  .join('\n')}

Interconnections: ${data.interconnections.length}

Please evaluate:
1. Completeness (0-100): Are all relevant factors covered?
2. Interconnection quality (0-100): How well are relationships mapped?
3. Overall quality (0-100): Clarity and usefulness of analysis

Identify specific issues and provide improvement suggestions.

Respond in JSON format:
{
  "is_valid": true/false,
  "completeness_score": 85,
  "interconnection_score": 70,
  "quality_score": 80,
  "issues": [{"category": "political", "issue_type": "missing", "description": "...", "severity": "medium"}],
  "suggestions": ["..."]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a PMESII-PT analysis validator. Provide objective, constructive feedback.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    return JSON.parse(content);

  } catch (error) {
    console.error('AI validation error:', error);

    // Return basic validation
    const totalFactors = Object.values(data.factors).reduce((sum, factors) => sum + factors.length, 0);

    return {
      is_valid: totalFactors > 0,
      completeness_score: Math.min(totalFactors * 10, 100),
      interconnection_score: data.interconnections.length * 20,
      quality_score: totalFactors > 0 ? 70 : 30,
      issues: totalFactors === 0 ? [
        {
          category: 'general',
          issue_type: 'missing',
          description: 'No factors have been identified in any category',
          severity: 'high' as const,
        }
      ] : [],
      suggestions: [
        'AI validation temporarily unavailable',
        'Manually review analysis completeness',
        'Verify all PMESII-PT categories are addressed',
      ],
    };
  }
}

/**
 * Generate fallback factors when AI is unavailable
 */
function generateFallbackFactors(data: PMESIIData): AISuggestions['factors'] {
  return {
    political: [
      {
        id: `pol_${Date.now()}_1`,
        category: 'political',
        title: 'Government Stability',
        description: 'Current political stability and governance effectiveness',
        impact_level: 'high',
        likelihood: 75,
        time_horizon: 'medium_term',
        stakeholders: ['Government', 'Opposition'],
        tags: ['governance', 'stability'],
      },
    ],
    military: [
      {
        id: `mil_${Date.now()}_1`,
        category: 'military',
        title: 'Security Environment',
        description: 'Overall security situation and threat levels',
        impact_level: 'high',
        likelihood: 80,
        time_horizon: 'immediate',
        stakeholders: ['Military', 'Security Services'],
        tags: ['security', 'threats'],
      },
    ],
    economic: [
      {
        id: `econ_${Date.now()}_1`,
        category: 'economic',
        title: 'Economic Conditions',
        description: 'Current economic climate and trends',
        impact_level: 'high',
        likelihood: 85,
        time_horizon: 'short_term',
        stakeholders: ['Businesses', 'Workers', 'Government'],
        tags: ['economy', 'trends'],
      },
    ],
    social: [
      {
        id: `soc_${Date.now()}_1`,
        category: 'social',
        title: 'Social Dynamics',
        description: 'Population demographics and social movements',
        impact_level: 'medium',
        likelihood: 70,
        time_horizon: 'medium_term',
        stakeholders: ['Civil Society', 'Communities'],
        tags: ['demographics', 'society'],
      },
    ],
    information: [
      {
        id: `info_${Date.now()}_1`,
        category: 'information',
        title: 'Information Environment',
        description: 'Media landscape and information flows',
        impact_level: 'medium',
        likelihood: 75,
        time_horizon: 'short_term',
        stakeholders: ['Media', 'Public'],
        tags: ['media', 'information'],
      },
    ],
    infrastructure: [
      {
        id: `infra_${Date.now()}_1`,
        category: 'infrastructure',
        title: 'Critical Infrastructure',
        description: 'State of essential infrastructure systems',
        impact_level: 'high',
        likelihood: 80,
        time_horizon: 'long_term',
        stakeholders: ['Government', 'Utilities', 'Public'],
        tags: ['infrastructure', 'systems'],
      },
    ],
    physical_environment: [
      {
        id: `phys_${Date.now()}_1`,
        category: 'physical_environment',
        title: 'Geographic Constraints',
        description: 'Physical and environmental factors affecting operations',
        impact_level: 'medium',
        likelihood: 85,
        time_horizon: 'long_term',
        stakeholders: ['Environment', 'Communities'],
        tags: ['geography', 'environment'],
      },
    ],
    time: [
      {
        id: `time_${Date.now()}_1`,
        category: 'time',
        title: 'Timing Considerations',
        description: 'Critical timing factors and windows of opportunity',
        impact_level: 'high',
        likelihood: 75,
        time_horizon: 'immediate',
        stakeholders: ['Decision Makers'],
        tags: ['timing', 'opportunity'],
      },
    ],
  };
}