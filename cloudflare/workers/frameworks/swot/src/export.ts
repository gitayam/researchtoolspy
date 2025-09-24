/**
 * Export functionality for SWOT Framework
 * Handles PDF, DOCX, and JSON exports
 */

import { Env, FrameworkSession } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';
import { SWOTData, SWOTExportFormat, SWOTExportResult } from './types';

/**
 * Export SWOT analysis in various formats
 */
export async function exportSWOT(
  session: FrameworkSession,
  swotData: SWOTData,
  format: SWOTExportFormat,
  env: Env,
  userId: number
): Promise<SWOTExportResult> {
  switch (format) {
    case 'json':
      return exportToJSON(session, swotData, env, userId);
    case 'pdf':
      return exportToPDF(session, swotData, env, userId);
    case 'docx':
      return exportToDocx(session, swotData, env, userId);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export to JSON format
 */
async function exportToJSON(
  session: FrameworkSession,
  swotData: SWOTData,
  env: Env,
  userId: number
): Promise<SWOTExportResult> {
  const exportData = {
    metadata: {
      title: session.title,
      description: session.description,
      created_at: session.created_at,
      updated_at: session.updated_at,
      version: session.version,
      exported_at: new Date().toISOString(),
    },
    analysis: {
      objective: swotData.objective,
      context: swotData.context,
      strengths: swotData.strengths,
      weaknesses: swotData.weaknesses,
      opportunities: swotData.opportunities,
      threats: swotData.threats,
    },
    ai_insights: session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null,
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Generate unique filename
  const filename = `swot_${session.id}_${Date.now()}.json`;

  // Store in R2 if available
  if (env.EXPORTS) {
    await env.EXPORTS.put(filename, blob);

    // Record export in database
    const db = createDatabase(env);
    await db.insert('framework_exports', {
      session_id: session.id,
      export_type: 'json',
      file_path: filename,
      file_size: blob.size,
      exported_by_id: userId,
    });

    // Generate signed URL (valid for 1 hour)
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    return {
      download_url: `/api/v1/exports/${filename}`,
      format: 'json',
      file_size: blob.size,
      expires_at: expiresAt.toISOString(),
    };
  }

  // Fallback: Return data URL
  const dataUrl = `data:application/json;base64,${btoa(jsonString)}`;

  return {
    download_url: dataUrl,
    format: 'json',
    file_size: jsonString.length,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

/**
 * Export to PDF format
 */
async function exportToPDF(
  session: FrameworkSession,
  swotData: SWOTData,
  env: Env,
  userId: number
): Promise<SWOTExportResult> {
  // Generate HTML content
  const html = generateHTMLReport(session, swotData);

  // For now, return HTML that can be converted client-side
  // In production, use a PDF generation service or Worker
  const filename = `swot_${session.id}_${Date.now()}.html`;

  if (env.EXPORTS) {
    const blob = new Blob([html], { type: 'text/html' });
    await env.EXPORTS.put(filename, blob);

    const db = createDatabase(env);
    await db.insert('framework_exports', {
      session_id: session.id,
      export_type: 'pdf',
      file_path: filename,
      file_size: blob.size,
      exported_by_id: userId,
    });

    return {
      download_url: `/api/v1/exports/${filename}`,
      format: 'pdf',
      file_size: blob.size,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  }

  // Fallback
  const dataUrl = `data:text/html;base64,${btoa(html)}`;

  return {
    download_url: dataUrl,
    format: 'pdf',
    file_size: html.length,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

/**
 * Export to DOCX format
 */
async function exportToDocx(
  session: FrameworkSession,
  swotData: SWOTData,
  env: Env,
  userId: number
): Promise<SWOTExportResult> {
  // For DOCX, we'll create a structured JSON that can be processed client-side
  // or by a dedicated document generation service
  const docData = {
    title: session.title,
    sections: [
      {
        heading: 'Executive Summary',
        content: session.description,
      },
      {
        heading: 'Objective',
        content: swotData.objective,
      },
      {
        heading: 'Context',
        content: swotData.context || 'No additional context provided.',
      },
      {
        heading: 'Strengths',
        type: 'list',
        items: swotData.strengths,
      },
      {
        heading: 'Weaknesses',
        type: 'list',
        items: swotData.weaknesses,
      },
      {
        heading: 'Opportunities',
        type: 'list',
        items: swotData.opportunities,
      },
      {
        heading: 'Threats',
        type: 'list',
        items: swotData.threats,
      },
    ],
    metadata: {
      created: session.created_at,
      updated: session.updated_at,
      version: session.version,
    },
  };

  const jsonString = JSON.stringify(docData, null, 2);
  const filename = `swot_${session.id}_${Date.now()}.docx.json`;

  if (env.EXPORTS) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    await env.EXPORTS.put(filename, blob);

    const db = createDatabase(env);
    await db.insert('framework_exports', {
      session_id: session.id,
      export_type: 'docx',
      file_path: filename,
      file_size: blob.size,
      exported_by_id: userId,
    });

    return {
      download_url: `/api/v1/exports/${filename}`,
      format: 'docx',
      file_size: blob.size,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  }

  const dataUrl = `data:application/json;base64,${btoa(jsonString)}`;

  return {
    download_url: dataUrl,
    format: 'docx',
    file_size: jsonString.length,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

/**
 * Generate HTML report for PDF export
 */
function generateHTMLReport(session: FrameworkSession, swotData: SWOTData): string {
  const aiSuggestions = session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(session.title)} - SWOT Analysis</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .meta {
            opacity: 0.9;
            margin-top: 10px;
        }
        .section {
            background: white;
            padding: 25px;
            margin-bottom: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h2 {
            color: #667eea;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .swot-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
        }
        .swot-quadrant {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border: 2px solid;
        }
        .strengths { border-color: #48bb78; background: #f0fff4; }
        .weaknesses { border-color: #f56565; background: #fff5f5; }
        .opportunities { border-color: #4299e1; background: #ebf8ff; }
        .threats { border-color: #ed8936; background: #fffdf7; }
        .swot-quadrant h3 {
            margin-top: 0;
            margin-bottom: 15px;
        }
        .strengths h3 { color: #48bb78; }
        .weaknesses h3 { color: #f56565; }
        .opportunities h3 { color: #4299e1; }
        .threats h3 { color: #ed8936; }
        ul {
            margin: 0;
            padding-left: 20px;
        }
        li {
            margin-bottom: 8px;
        }
        .ai-insights {
            background: #f7fafc;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin-top: 20px;
        }
        .footer {
            text-align: center;
            color: #666;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }
        @media print {
            body { background: white; }
            .section { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${escapeHtml(session.title)}</h1>
        <div class="meta">
            <div>Created: ${new Date(session.created_at).toLocaleDateString()}</div>
            <div>Last Updated: ${new Date(session.updated_at).toLocaleDateString()}</div>
            <div>Version: ${session.version}</div>
        </div>
    </div>

    <div class="section">
        <h2>Objective</h2>
        <p>${escapeHtml(swotData.objective)}</p>

        ${swotData.context ? `
        <h2>Context</h2>
        <p>${escapeHtml(swotData.context)}</p>
        ` : ''}
    </div>

    <div class="section">
        <h2>SWOT Analysis Matrix</h2>
        <div class="swot-grid">
            <div class="swot-quadrant strengths">
                <h3>Strengths</h3>
                <ul>
                    ${swotData.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                </ul>
            </div>

            <div class="swot-quadrant weaknesses">
                <h3>Weaknesses</h3>
                <ul>
                    ${swotData.weaknesses.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
                </ul>
            </div>

            <div class="swot-quadrant opportunities">
                <h3>Opportunities</h3>
                <ul>
                    ${swotData.opportunities.map(o => `<li>${escapeHtml(o)}</li>`).join('')}
                </ul>
            </div>

            <div class="swot-quadrant threats">
                <h3>Threats</h3>
                <ul>
                    ${swotData.threats.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                </ul>
            </div>
        </div>
    </div>

    ${aiSuggestions && aiSuggestions.insights ? `
    <div class="section">
        <h2>AI-Generated Insights</h2>
        <div class="ai-insights">
            <h3>Key Insights</h3>
            <ul>
                ${aiSuggestions.insights.map((i: string) => `<li>${escapeHtml(i)}</li>`).join('')}
            </ul>

            ${aiSuggestions.recommendations ? `
            <h3>Recommendations</h3>
            <ul>
                ${aiSuggestions.recommendations.map((r: string) => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
            ` : ''}
        </div>
    </div>
    ` : ''}

    <div class="footer">
        <p>Generated by ResearchToolsPy - SWOT Analysis Framework</p>
        <p>${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}