/**
 * BEHAVIOR Framework Type Definitions
 */

// Core data structure
export interface BEHAVIORData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface BEHAVIORCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface BEHAVIORUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface BEHAVIORAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: BEHAVIORData;
}

// Export types
export type BEHAVIORExportFormat = 'pdf' | 'docx' | 'json';
