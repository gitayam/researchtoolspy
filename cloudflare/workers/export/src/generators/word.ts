/**
 * Word Document Generator for framework exports
 */

import { Env } from '../../../shared/types';
import { ExportRequest } from '../index';

export async function generateWord(
  request: ExportRequest,
  env: Env
): Promise<ArrayBuffer> {
  const { data, frameworkType, options } = request;

  // For edge compatibility, generate RTF format which Word can open
  const rtfContent = generateRTF(frameworkType, data, options);

  return new TextEncoder().encode(rtfContent).buffer;
}

function generateRTF(
  frameworkType: string,
  data: any,
  options?: any
): string {
  const timestamp = new Date().toISOString();

  let rtf = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue255;\\red0\\green128\\blue0;}
\\f0\\fs24
{\\pard\\qc\\b\\fs32 ${frameworkType.toUpperCase()} Analysis Report\\par}
{\\pard\\qc Generated: ${timestamp}\\par}
\\par
`;

  // Add framework-specific content
  if (frameworkType === 'swot') {
    rtf += formatSWOTAsRTF(data);
  } else if (frameworkType === 'ach') {
    rtf += formatACHAsRTF(data);
  } else {
    rtf += formatGenericAsRTF(data);
  }

  rtf += '}';
  return rtf;
}

function formatSWOTAsRTF(data: any): string {
  let rtf = '';

  if (data.strengths?.length > 0) {
    rtf += '{\\pard\\b\\fs28\\cf2 STRENGTHS\\par}\n';
    data.strengths.forEach((item: any) => {
      rtf += `{\\pard\\li360 \\bullet ${escapeRTF(item.text || item)}\\par}\n`;
      if (item.notes) {
        rtf += `{\\pard\\li720\\i ${escapeRTF(item.notes)}\\par}\n`;
      }
    });
    rtf += '\\par\n';
  }

  if (data.weaknesses?.length > 0) {
    rtf += '{\\pard\\b\\fs28\\cf2 WEAKNESSES\\par}\n';
    data.weaknesses.forEach((item: any) => {
      rtf += `{\\pard\\li360 \\bullet ${escapeRTF(item.text || item)}\\par}\n`;
      if (item.notes) {
        rtf += `{\\pard\\li720\\i ${escapeRTF(item.notes)}\\par}\n`;
      }
    });
    rtf += '\\par\n';
  }

  if (data.opportunities?.length > 0) {
    rtf += '{\\pard\\b\\fs28\\cf3 OPPORTUNITIES\\par}\n';
    data.opportunities.forEach((item: any) => {
      rtf += `{\\pard\\li360 \\bullet ${escapeRTF(item.text || item)}\\par}\n`;
      if (item.notes) {
        rtf += `{\\pard\\li720\\i ${escapeRTF(item.notes)}\\par}\n`;
      }
    });
    rtf += '\\par\n';
  }

  if (data.threats?.length > 0) {
    rtf += '{\\pard\\b\\fs28\\cf1 THREATS\\par}\n';
    data.threats.forEach((item: any) => {
      rtf += `{\\pard\\li360 \\bullet ${escapeRTF(item.text || item)}\\par}\n`;
      if (item.notes) {
        rtf += `{\\pard\\li720\\i ${escapeRTF(item.notes)}\\par}\n`;
      }
    });
    rtf += '\\par\n';
  }

  if (data.analysis) {
    rtf += '{\\pard\\b\\fs28 ANALYSIS\\par}\n';
    rtf += `{\\pard ${escapeRTF(data.analysis)}\\par}\n`;
  }

  if (data.recommendations?.length > 0) {
    rtf += '{\\pard\\b\\fs28 RECOMMENDATIONS\\par}\n';
    data.recommendations.forEach((rec: any) => {
      rtf += `{\\pard\\li360 \\bullet ${escapeRTF(rec.text || rec)}\\par}\n`;
    });
  }

  return rtf;
}

function formatACHAsRTF(data: any): string {
  let rtf = '';

  if (data.hypotheses?.length > 0) {
    rtf += '{\\pard\\b\\fs28 HYPOTHESES\\par}\n';
    data.hypotheses.forEach((hypothesis: any, index: number) => {
      rtf += `{\\pard\\b H${index + 1}: ${escapeRTF(hypothesis.text)}\\par}\n`;

      if (hypothesis.evidence?.length > 0) {
        rtf += '{\\pard\\li360 Evidence:\\par}\n';
        hypothesis.evidence.forEach((evidence: any) => {
          rtf += `{\\pard\\li720 \\bullet ${escapeRTF(evidence.text)}`;
          if (evidence.consistency) {
            rtf += ` (Consistency: ${evidence.consistency})`;
          }
          rtf += '\\par}\n';
        });
      }

      if (hypothesis.likelihood) {
        rtf += `{\\pard\\li360 Likelihood: ${hypothesis.likelihood}\\par}\n`;
      }

      rtf += '\\par\n';
    });
  }

  return rtf;
}

function formatGenericAsRTF(data: any): string {
  return `{\\pard ${escapeRTF(JSON.stringify(data, null, 2))}\\par}\n`;
}

function escapeRTF(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\n/g, '\\par ');