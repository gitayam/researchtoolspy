/**
 * JSON Generator for framework exports
 */

import { Env } from '../../../shared/types';
import { ExportRequest } from '../index';

export async function generateJSON(
  request: ExportRequest,
  env: Env
): Promise<ArrayBuffer> {
  const { data, frameworkType, options } = request;

  const exportData = {
    metadata: {
      frameworkType,
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      options,
    },
    data: formatData(frameworkType, data),
    analysis: data.analysis || null,
    recommendations: data.recommendations || null,
    aiSuggestions: data.ai_suggestions || null,
  };

  // Pretty print JSON for readability
  const jsonString = JSON.stringify(exportData, null, 2);
  return new TextEncoder().encode(jsonString).buffer;
}

function formatData(frameworkType: string, data: any): any {
  // Clean and structure the data based on framework type
  switch (frameworkType) {
    case 'swot':
      return formatSWOTData(data);
    case 'ach':
      return formatACHData(data);
    case 'behavioral':
      return formatBehavioralData(data);
    case 'dotmlpf':
      return formatDOTMLPFData(data);
    case 'pmesii-pt':
      return formatPMESIIPTData(data);
    case 'dime':
      return formatDIMEData(data);
    case 'pest':
      return formatPESTData(data);
    case 'vrio':
      return formatVRIOData(data);
    case 'stakeholder':
      return formatStakeholderData(data);
    default:
      return data;
  }
}

function formatSWOTData(data: any): any {
  return {
    title: data.title || '',
    description: data.description || '',
    strengths: (data.strengths || []).map((item: any) => ({
      text: item.text || item,
      priority: item.priority || 'Medium',
      notes: item.notes || '',
      tags: item.tags || [],
    })),
    weaknesses: (data.weaknesses || []).map((item: any) => ({
      text: item.text || item,
      priority: item.priority || 'Medium',
      notes: item.notes || '',
      tags: item.tags || [],
    })),
    opportunities: (data.opportunities || []).map((item: any) => ({
      text: item.text || item,
      priority: item.priority || 'Medium',
      notes: item.notes || '',
      tags: item.tags || [],
    })),
    threats: (data.threats || []).map((item: any) => ({
      text: item.text || item,
      priority: item.priority || 'Medium',
      notes: item.notes || '',
      tags: item.tags || [],
    })),
    crossAnalysis: data.crossAnalysis || null,
  };
}

function formatACHData(data: any): any {
  return {
    title: data.title || '',
    description: data.description || '',
    hypotheses: (data.hypotheses || []).map((hypothesis: any) => ({
      id: hypothesis.id || null,
      text: hypothesis.text || '',
      likelihood: hypothesis.likelihood || 0,
      evidence: (hypothesis.evidence || []).map((evidence: any) => ({
        text: evidence.text || '',
        consistency: evidence.consistency || 'Neutral',
        credibility: evidence.credibility || 'Medium',
        weight: evidence.weight || 1,
        source: evidence.source || '',
      })),
      analysis: hypothesis.analysis || '',
    })),
    matrix: data.matrix || null,
    conclusion: data.conclusion || '',
  };
}

function formatBehavioralData(data: any): any {
  return {
    title: data.title || '',
    subject: data.subject || '',
    capability: {
      physical: data.capability?.physical || [],
      psychological: data.capability?.psychological || [],
    },
    opportunity: {
      social: data.opportunity?.social || [],
      physical: data.opportunity?.physical || [],
    },
    motivation: {
      reflective: data.motivation?.reflective || [],
      automatic: data.motivation?.automatic || [],
    },
    interventions: data.interventions || [],
  };
}

function formatDOTMLPFData(data: any): any {
  return {
    title: data.title || '',
    doctrine: data.doctrine || [],
    organization: data.organization || [],
    training: data.training || [],
    materiel: data.materiel || [],
    leadership: data.leadership || [],
    personnel: data.personnel || [],
    facilities: data.facilities || [],
    policy: data.policy || [],
    gaps: data.gaps || [],
    recommendations: data.recommendations || [],
  };
}

function formatPMESIIPTData(data: any): any {
  return {
    title: data.title || '',
    political: data.political || [],
    military: data.military || [],
    economic: data.economic || [],
    social: data.social || [],
    information: data.information || [],
    infrastructure: data.infrastructure || [],
    physical_environment: data.physical_environment || [],
    time: data.time || [],
    interactions: data.interactions || [],
  };
}

function formatDIMEData(data: any): any {
  return {
    title: data.title || '',
    diplomatic: data.diplomatic || [],
    information: data.information || [],
    military: data.military || [],
    economic: data.economic || [],
    integration: data.integration || [],
    strategies: data.strategies || [],
  };
}

function formatPESTData(data: any): any {
  return {
    title: data.title || '',
    political: data.political || [],
    economic: data.economic || [],
    social: data.social || [],
    technological: data.technological || [],
    trends: data.trends || [],
    impacts: data.impacts || [],
  };
}

function formatVRIOData(data: any): any {
  return {
    title: data.title || '',
    resources: (data.resources || []).map((resource: any) => ({
      name: resource.name || '',
      valuable: resource.valuable || false,
      rare: resource.rare || false,
      inimitable: resource.inimitable || false,
      organized: resource.organized || false,
      advantage: resource.advantage || 'None',
      notes: resource.notes || '',
    })),
    competitiveAdvantage: data.competitiveAdvantage || '',
    recommendations: data.recommendations || [],
  };
}

function formatStakeholderData(data: any): any {
  return {
    title: data.title || '',
    stakeholders: (data.stakeholders || []).map((stakeholder: any) => ({
      name: stakeholder.name || '',
      type: stakeholder.type || '',
      influence: stakeholder.influence || 'Medium',
      interest: stakeholder.interest || 'Medium',
      attitude: stakeholder.attitude || 'Neutral',
      engagement: stakeholder.engagement || '',
      notes: stakeholder.notes || '',
    })),
    matrix: data.matrix || null,
    strategies: data.strategies || [],
  };
}