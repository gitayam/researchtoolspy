/**
 * DIME Framework Type Definitions
 */

// Core data structure
export interface DIMEData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface DIMECreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface DIMEUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface DIMEAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: DIMEData;
}

// Export types
export type DIMEExportFormat = 'pdf' | 'docx' | 'json';
