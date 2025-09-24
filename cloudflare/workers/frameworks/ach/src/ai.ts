/**
 * AI integration for ACH Framework
 * Provides hypothesis generation, evidence evaluation, and analysis
 */

import { Env } from '../../../shared/types';
import {
  Hypothesis,
  Evidence,
  ACHAnalysis,
  EvidenceEvaluation,
  ConsistencyRating,
} from './types';

/**
 * Generate ACH suggestions using AI
 */
export async function generateACHSuggestions(
  title: string,
  description: string,
  env: Env
): Promise<{
  hypotheses?: Hypothesis[];
  evidence?: Evidence[];
  analysis?: string;
}> {
  if (!env.OPENAI_API_KEY) {
    return {};
  }

  try {
    const prompt = `
    Given the following analysis topic:
    Title: ${title}
    Description: ${description}

    Generate:
    1. 3-5 competing hypotheses that could explain the situation
    2. 5-7 pieces of evidence that could help evaluate these hypotheses
    3. Initial analysis of the problem space

    Format the response as JSON with:
    - hypotheses: array of {id, text, description}
    - evidence: array of {id, text, source, credibility}
    - analysis: string
    `;

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
            content: 'You are an expert analyst using the Analysis of Competing Hypotheses methodology.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const suggestions = JSON.parse(data.choices[0].message.content);

    // Add IDs and default values
    if (suggestions.hypotheses) {
      suggestions.hypotheses = suggestions.hypotheses.map((h: any, i: number) => ({
        id: h.id || `h${i + 1}`,
        text: h.text,
        description: h.description,
        created_at: new Date().toISOString(),
      }));
    }

    if (suggestions.evidence) {
      suggestions.evidence = suggestions.evidence.map((e: any, i: number) => ({
        id: e.id || `e${i + 1}`,
        text: e.text,
        source: e.source || 'Generated',
        credibility: e.credibility || 'medium',
      }));
    }

    return suggestions;
  } catch (error) {
    console.error('Error generating ACH suggestions:', error);
    return {};
  }
}

/**
 * Analyze a specific hypothesis against evidence
 */
export async function analyzeHypothesis(
  hypothesis: Hypothesis,
  evidence: Evidence[],
  env: Env
): Promise<ACHAnalysis> {
  if (!env.OPENAI_API_KEY) {
    return {
      hypothesis_id: hypothesis.id,
      likelihood: 50,
      strengths: [],
      weaknesses: [],
      critical_evidence: [],
      analysis: 'AI analysis not available',
    };
  }

  try {
    const evidenceList = evidence.map(e => ({
      id: e.id,
      text: e.text,
      credibility: e.credibility,
      consistency: hypothesis.evidence_ratings?.find(r => r.evidence_id === e.id)?.consistency || 'neutral',
    }));

    const prompt = `
    Analyze the following hypothesis against the available evidence:

    Hypothesis: ${hypothesis.text}
    ${hypothesis.description ? `Description: ${hypothesis.description}` : ''}

    Evidence:
    ${JSON.stringify(evidenceList, null, 2)}

    Provide:
    1. Likelihood assessment (0-100)
    2. Key strengths of this hypothesis
    3. Key weaknesses of this hypothesis
    4. Critical evidence IDs that most impact this hypothesis
    5. Detailed analysis
    6. Recommendation

    Format as JSON with fields: likelihood, strengths, weaknesses, critical_evidence, analysis, recommendation
    `;

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
            content: 'You are an expert analyst using the Analysis of Competing Hypotheses methodology.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);

    return {
      hypothesis_id: hypothesis.id,
      likelihood: analysis.likelihood || 50,
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      critical_evidence: analysis.critical_evidence || [],
      analysis: analysis.analysis || '',
      recommendation: analysis.recommendation,
    };
  } catch (error) {
    console.error('Error analyzing hypothesis:', error);
    return {
      hypothesis_id: hypothesis.id,
      likelihood: 50,
      strengths: [],
      weaknesses: [],
      critical_evidence: [],
      analysis: 'Error during analysis',
    };
  }
}

/**
 * Evaluate how a piece of evidence relates to each hypothesis
 */
export async function evaluateEvidence(
  evidence: Evidence,
  hypotheses: Hypothesis[],
  env: Env
): Promise<EvidenceEvaluation> {
  if (!env.OPENAI_API_KEY) {
    return {
      evidence_id: evidence.id,
      ratings: hypotheses.map(h => ({
        hypothesis_id: h.id,
        consistency: 'neutral' as ConsistencyRating,
        explanation: 'AI evaluation not available',
      })),
    };
  }

  try {
    const hypothesesList = hypotheses.map(h => ({
      id: h.id,
      text: h.text,
    }));

    const prompt = `
    Evaluate how the following evidence relates to each hypothesis:

    Evidence: ${evidence.text}
    Source: ${evidence.source || 'Unknown'}
    Credibility: ${evidence.credibility}

    Hypotheses:
    ${JSON.stringify(hypothesesList, null, 2)}

    For each hypothesis, rate the consistency of this evidence:
    - very_consistent: Strongly supports the hypothesis
    - consistent: Somewhat supports the hypothesis
    - neutral: Neither supports nor contradicts
    - inconsistent: Somewhat contradicts the hypothesis
    - very_inconsistent: Strongly contradicts the hypothesis

    Format as JSON with ratings array containing: hypothesis_id, consistency, explanation
    `;

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
            content: 'You are an expert analyst evaluating evidence consistency with hypotheses.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const evaluation = JSON.parse(data.choices[0].message.content);

    return {
      evidence_id: evidence.id,
      ratings: evaluation.ratings || [],
    };
  } catch (error) {
    console.error('Error evaluating evidence:', error);
    return {
      evidence_id: evidence.id,
      ratings: hypotheses.map(h => ({
        hypothesis_id: h.id,
        consistency: 'neutral' as ConsistencyRating,
        explanation: 'Error during evaluation',
      })),
    };
  }
}