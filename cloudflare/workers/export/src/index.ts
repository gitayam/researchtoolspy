/**
 * Export Service Worker
 * Handles document generation and export for all framework analyses
 */

import { Env, AuthRequest, FrameworkSession } from '../../shared/types';
import { createErrorResponse, createSuccessResponse } from '../../shared/responses';
import { generatePDF } from './generators/pdf';
import { generateExcel } from './generators/excel';
import { generateWord } from './generators/word';
import { generatePowerPoint } from './generators/ppt';
import { generateJSON } from './generators/json';

export interface ExportRequest {
  format: 'pdf' | 'xlsx' | 'docx' | 'pptx' | 'json';
  sessionId: number;
  frameworkType: string;
  data: any;
  options?: {
    includeAnalysis?: boolean;
    includeCharts?: boolean;
    includeMetadata?: boolean;
    template?: string;
  };
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return createSuccessResponse({ status: 'healthy' });
    }

    // Parse export request
    if (request.method !== 'POST') {
      return createErrorResponse(405, 'Method not allowed');
    }

    try {
      const exportRequest: ExportRequest = await request.json();

      // Validate request
      if (!exportRequest.format || !exportRequest.sessionId || !exportRequest.data) {
        return createErrorResponse(400, 'Invalid export request');
      }

      // Generate export based on format
      let exportData: ArrayBuffer;
      let contentType: string;
      let fileName: string;

      const timestamp = new Date().toISOString().split('T')[0];
      const baseFileName = `${exportRequest.frameworkType}_${exportRequest.sessionId}_${timestamp}`;

      switch (exportRequest.format) {
        case 'pdf':
          exportData = await generatePDF(exportRequest, env);
          contentType = 'application/pdf';
          fileName = `${baseFileName}.pdf`;
          break;

        case 'xlsx':
          exportData = await generateExcel(exportRequest, env);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileName = `${baseFileName}.xlsx`;
          break;

        case 'docx':
          exportData = await generateWord(exportRequest, env);
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          fileName = `${baseFileName}.docx`;
          break;

        case 'pptx':
          exportData = await generatePowerPoint(exportRequest, env);
          contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          fileName = `${baseFileName}.pptx`;
          break;

        case 'json':
          exportData = await generateJSON(exportRequest, env);
          contentType = 'application/json';
          fileName = `${baseFileName}.json`;
          break;

        default:
          return createErrorResponse(400, `Unsupported format: ${exportRequest.format}`);
      }

      // Store in R2 if available
      if (env.EXPORTS) {
        const key = `exports/${exportRequest.frameworkType}/${fileName}`;
        await env.EXPORTS.put(key, exportData, {
          httpMetadata: {
            contentType,
            contentDisposition: `attachment; filename="${fileName}"`,
          },
          customMetadata: {
            sessionId: exportRequest.sessionId.toString(),
            frameworkType: exportRequest.frameworkType,
            format: exportRequest.format,
            createdAt: new Date().toISOString(),
          },
        });

        // Cache the export URL
        const exportUrl = `https://exports.researchtoolspy.com/${key}`;
        await env.CACHE?.put(
          `export:${exportRequest.sessionId}:${exportRequest.format}`,
          exportUrl,
          { expirationTtl: 3600 } // 1 hour cache
        );

        return createSuccessResponse({
          url: exportUrl,
          fileName,
          size: exportData.byteLength,
          format: exportRequest.format,
        });
      }

      // Return direct download if R2 not available
      return new Response(exportData, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': exportData.byteLength.toString(),
        },
      });
    } catch (error) {
      console.error('Export error:', error);
      return createErrorResponse(500, 'Export generation failed');
    }
  },
};

// Export functions for service binding
export async function handleExportRequest(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return exports.default.fetch(request, env, ctx);
}