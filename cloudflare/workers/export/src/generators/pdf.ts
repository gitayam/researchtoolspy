/**
 * PDF Generator for framework exports
 */

import { Env } from '../../../shared/types';
import { ExportRequest } from '../index';

export async function generatePDF(
  request: ExportRequest,
  env: Env
): Promise<ArrayBuffer> {
  // For edge compatibility, we'll use a simple PDF structure
  // In production, consider using a PDF generation service or edge-compatible library

  const { data, frameworkType, options } = request;

  // Create basic PDF structure
  const pdfContent = createBasicPDF(frameworkType, data, options);

  return new TextEncoder().encode(pdfContent).buffer;
}

function createBasicPDF(
  frameworkType: string,
  data: any,
  options?: any
): string {
  const timestamp = new Date().toISOString();

  // Basic PDF structure (simplified for edge runtime)
  let content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Font << /F1 6 0 R >> >>
endobj
5 0 obj
<< /Length ${calculateContentLength(frameworkType, data)} >>
stream
BT
/F1 12 Tf
50 750 Td
(${frameworkType.toUpperCase()} Analysis Report) Tj
0 -20 Td
(Generated: ${timestamp}) Tj
0 -40 Td
`;

  // Add framework-specific content
  if (frameworkType === 'swot') {
    content += formatSWOTContent(data);
  } else {
    content += formatGenericContent(data);
  }

  content += `
ET
endstream
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 7
0000000000 65535 f
0000000010 00000 n
0000000079 00000 n
0000000173 00000 n
0000000301 00000 n
0000000380 00000 n
0000000800 00000 n
trailer
<< /Size 7 /Root 1 0 R >>
startxref
900
%%EOF`;

  return content;
}

function calculateContentLength(frameworkType: string, data: any): number {
  // Calculate approximate content length
  return JSON.stringify(data).length * 2;
}

function formatSWOTContent(data: any): string {
  let content = '';

  if (data.strengths?.length > 0) {
    content += '(STRENGTHS:) Tj\n0 -20 Td\n';
    data.strengths.forEach((item: any) => {
      content += `(- ${item.text || item}) Tj\n0 -15 Td\n`;
    });
  }

  if (data.weaknesses?.length > 0) {
    content += '0 -30 Td\n(WEAKNESSES:) Tj\n0 -20 Td\n';
    data.weaknesses.forEach((item: any) => {
      content += `(- ${item.text || item}) Tj\n0 -15 Td\n`;
    });
  }

  if (data.opportunities?.length > 0) {
    content += '0 -30 Td\n(OPPORTUNITIES:) Tj\n0 -20 Td\n';
    data.opportunities.forEach((item: any) => {
      content += `(- ${item.text || item}) Tj\n0 -15 Td\n`;
    });
  }

  if (data.threats?.length > 0) {
    content += '0 -30 Td\n(THREATS:) Tj\n0 -20 Td\n';
    data.threats.forEach((item: any) => {
      content += `(- ${item.text || item}) Tj\n0 -15 Td\n`;
    });
  }

  return content;
}

function formatGenericContent(data: any): string {
  return `(${JSON.stringify(data, null, 2)}) Tj\n`;
}