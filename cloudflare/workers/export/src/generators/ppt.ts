/**
 * PowerPoint Generator for framework exports
 */

import { Env } from '../../../shared/types';
import { ExportRequest } from '../index';

export async function generatePowerPoint(
  request: ExportRequest,
  env: Env
): Promise<ArrayBuffer> {
  const { data, frameworkType, options } = request;

  // For edge compatibility, generate a simple HTML presentation format
  // that can be imported into PowerPoint
  const htmlContent = generateHTMLPresentation(frameworkType, data, options);

  return new TextEncoder().encode(htmlContent).buffer;
}

function generateHTMLPresentation(
  frameworkType: string,
  data: any,
  options?: any
): string {
  const timestamp = new Date().toISOString();

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${frameworkType.toUpperCase()} Analysis Presentation</title>
  <style>
    body { font-family: Arial, sans-serif; }
    .slide {
      width: 960px;
      height: 720px;
      padding: 40px;
      margin: 20px auto;
      border: 1px solid #ccc;
      page-break-after: always;
      background: white;
    }
    h1 { color: #2c3e50; font-size: 48px; margin-bottom: 20px; }
    h2 { color: #34495e; font-size: 36px; margin-bottom: 15px; }
    h3 { color: #7f8c8d; font-size: 28px; margin-bottom: 10px; }
    ul { font-size: 24px; line-height: 1.6; }
    .strength { color: #27ae60; }
    .weakness { color: #e74c3c; }
    .opportunity { color: #3498db; }
    .threat { color: #e67e22; }
    .footer { position: absolute; bottom: 20px; right: 40px; font-size: 14px; color: #95a5a6; }
  </style>
</head>
<body>
`;

  // Title slide
  html += `
  <div class="slide">
    <h1>${frameworkType.toUpperCase()} Analysis</h1>
    <h3>Generated: ${timestamp}</h3>
    ${data.title ? `<h2>${data.title}</h2>` : ''}
    ${data.description ? `<p>${data.description}</p>` : ''}
  </div>
`;

  // Add framework-specific slides
  if (frameworkType === 'swot') {
    html += formatSWOTSlides(data);
  } else if (frameworkType === 'ach') {
    html += formatACHSlides(data);
  } else {
    html += formatGenericSlides(data);
  }

  // Summary slide
  html += `
  <div class="slide">
    <h1>Summary</h1>
    ${data.analysis ? `<p>${data.analysis}</p>` : '<p>Analysis complete</p>'}
    ${data.recommendations ? formatRecommendations(data.recommendations) : ''}
    <div class="footer">${frameworkType.toUpperCase()} Analysis</div>
  </div>
`;

  html += '</body></html>';
  return html;
}

function formatSWOTSlides(data: any): string {
  let slides = '';

  // Strengths slide
  if (data.strengths?.length > 0) {
    slides += `
    <div class="slide">
      <h1 class="strength">Strengths</h1>
      <ul>
        ${data.strengths.map((item: any) => `
          <li>${item.text || item}${item.priority ? ` (Priority: ${item.priority})` : ''}</li>
        `).join('')}
      </ul>
      <div class="footer">SWOT Analysis - Strengths</div>
    </div>
    `;
  }

  // Weaknesses slide
  if (data.weaknesses?.length > 0) {
    slides += `
    <div class="slide">
      <h1 class="weakness">Weaknesses</h1>
      <ul>
        ${data.weaknesses.map((item: any) => `
          <li>${item.text || item}${item.priority ? ` (Priority: ${item.priority})` : ''}</li>
        `).join('')}
      </ul>
      <div class="footer">SWOT Analysis - Weaknesses</div>
    </div>
    `;
  }

  // Opportunities slide
  if (data.opportunities?.length > 0) {
    slides += `
    <div class="slide">
      <h1 class="opportunity">Opportunities</h1>
      <ul>
        ${data.opportunities.map((item: any) => `
          <li>${item.text || item}${item.priority ? ` (Priority: ${item.priority})` : ''}</li>
        `).join('')}
      </ul>
      <div class="footer">SWOT Analysis - Opportunities</div>
    </div>
    `;
  }

  // Threats slide
  if (data.threats?.length > 0) {
    slides += `
    <div class="slide">
      <h1 class="threat">Threats</h1>
      <ul>
        ${data.threats.map((item: any) => `
          <li>${item.text || item}${item.priority ? ` (Priority: ${item.priority})` : ''}</li>
        `).join('')}
      </ul>
      <div class="footer">SWOT Analysis - Threats</div>
    </div>
    `;
  }

  return slides;
}

function formatACHSlides(data: any): string {
  let slides = '';

  if (data.hypotheses?.length > 0) {
    // Overview slide
    slides += `
    <div class="slide">
      <h1>Hypotheses Overview</h1>
      <ul>
        ${data.hypotheses.map((h: any, i: number) => `
          <li><strong>H${i + 1}:</strong> ${h.text}</li>
        `).join('')}
      </ul>
      <div class="footer">ACH Analysis - Overview</div>
    </div>
    `;

    // Individual hypothesis slides
    data.hypotheses.forEach((hypothesis: any, index: number) => {
      slides += `
      <div class="slide">
        <h1>Hypothesis ${index + 1}</h1>
        <h2>${hypothesis.text}</h2>
        ${hypothesis.evidence?.length > 0 ? `
          <h3>Supporting Evidence:</h3>
          <ul>
            ${hypothesis.evidence.map((e: any) => `
              <li>${e.text}${e.consistency ? ` (${e.consistency})` : ''}</li>
            `).join('')}
          </ul>
        ` : ''}
        ${hypothesis.likelihood ? `<p><strong>Likelihood:</strong> ${hypothesis.likelihood}</p>` : ''}
        <div class="footer">ACH Analysis - H${index + 1}</div>
      </div>
      `;
    });
  }

  return slides;
}

function formatGenericSlides(data: any): string {
  // Create slides for each major section of the data
  let slides = '';
  const sections = Object.keys(data).filter(key =>
    typeof data[key] === 'object' && data[key] !== null
  );

  sections.forEach(section => {
    slides += `
    <div class="slide">
      <h1>${section.charAt(0).toUpperCase() + section.slice(1)}</h1>
      <pre>${JSON.stringify(data[section], null, 2)}</pre>
      <div class="footer">${section}</div>
    </div>
    `;
  });

  return slides;
}

function formatRecommendations(recommendations: any[]): string {
  if (!recommendations || recommendations.length === 0) return '';

  return `
    <h2>Recommendations</h2>
    <ul>
      ${recommendations.map((rec: any) => `
        <li>${rec.text || rec}</li>
      `).join('')}
    </ul>
  `;
}