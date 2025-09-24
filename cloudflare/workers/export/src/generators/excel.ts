/**
 * Excel Generator for framework exports
 */

import { Env } from '../../../shared/types';
import { ExportRequest } from '../index';

export async function generateExcel(
  request: ExportRequest,
  env: Env
): Promise<ArrayBuffer> {
  const { data, frameworkType, options } = request;

  // For edge compatibility, create a simple CSV format that Excel can open
  // Full Excel generation would require edge-compatible libraries
  const csvContent = generateCSV(frameworkType, data, options);

  return new TextEncoder().encode(csvContent).buffer;
}

function generateCSV(
  frameworkType: string,
  data: any,
  options?: any
): string {
  let csv = '';

  // Add header
  csv += `${frameworkType.toUpperCase()} Analysis Export\n`;
  csv += `Generated: ${new Date().toISOString()}\n\n`;

  // Framework-specific formatting
  if (frameworkType === 'swot') {
    csv += formatSWOTAsCSV(data);
  } else if (frameworkType === 'ach') {
    csv += formatACHAsCSV(data);
  } else {
    csv += formatGenericAsCSV(data);
  }

  return csv;
}

function formatSWOTAsCSV(data: any): string {
  let csv = 'Category,Item,Priority,Notes\n';

  if (data.strengths?.length > 0) {
    data.strengths.forEach((item: any) => {
      csv += `"Strengths","${escapeCSV(item.text || item)}","${item.priority || 'Medium'}","${escapeCSV(item.notes || '')}"\n`;
    });
  }

  if (data.weaknesses?.length > 0) {
    data.weaknesses.forEach((item: any) => {
      csv += `"Weaknesses","${escapeCSV(item.text || item)}","${item.priority || 'Medium'}","${escapeCSV(item.notes || '')}"\n`;
    });
  }

  if (data.opportunities?.length > 0) {
    data.opportunities.forEach((item: any) => {
      csv += `"Opportunities","${escapeCSV(item.text || item)}","${item.priority || 'Medium'}","${escapeCSV(item.notes || '')}"\n`;
    });
  }

  if (data.threats?.length > 0) {
    data.threats.forEach((item: any) => {
      csv += `"Threats","${escapeCSV(item.text || item)}","${item.priority || 'Medium'}","${escapeCSV(item.notes || '')}"\n`;
    });
  }

  return csv;
}

function formatACHAsCSV(data: any): string {
  let csv = 'Hypothesis,Evidence,Consistency,Credibility,Weight\n';

  if (data.hypotheses) {
    data.hypotheses.forEach((hypothesis: any) => {
      if (hypothesis.evidence) {
        hypothesis.evidence.forEach((evidence: any) => {
          csv += `"${escapeCSV(hypothesis.text)}","${escapeCSV(evidence.text)}","${evidence.consistency || ''}","${evidence.credibility || ''}","${evidence.weight || ''}"\n`;
        });
      }
    });
  }

  return csv;
}

function formatGenericAsCSV(data: any): string {
  // Convert object to CSV format
  const rows: string[] = [];
  const headers = new Set<string>();

  // Flatten the data structure
  const flatData = flattenObject(data);

  // Get all unique headers
  Object.keys(flatData).forEach(key => headers.add(key));

  // Create header row
  rows.push(Array.from(headers).join(','));

  // Create data row
  const values = Array.from(headers).map(header => {
    const value = flatData[header];
    return `"${escapeCSV(String(value || ''))}"`;
  });
  rows.push(values.join(','));

  return rows.join('\n');
}

function escapeCSV(text: string): string {
  if (!text) return '';
  return text.replace(/"/g, '""').replace(/\n/g, ' ');
}

function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const flat: Record<string, any> = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(flat, flattenObject(obj[key], newKey));
      } else if (Array.isArray(obj[key])) {
        flat[newKey] = obj[key].join('; ');
      } else {
        flat[newKey] = obj[key];
      }
    }
  }

  return flat;
}