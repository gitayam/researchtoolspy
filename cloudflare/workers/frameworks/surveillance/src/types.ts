/**
 * SURVEILLANCE Framework Type Definitions
 */

// Core data structure
export interface SURVEILLANCEData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface SURVEILLANCECreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface SURVEILLANCEUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface SURVEILLANCEAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: SURVEILLANCEData;
}

// Export types
export type SURVEILLANCEExportFormat = 'pdf' | 'docx' | 'json';
