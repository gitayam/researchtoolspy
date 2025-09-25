/**
 * CAUSEWAY Framework Type Definitions
 */

// Core data structure
export interface CAUSEWAYData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface CAUSEWAYCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface CAUSEWAYUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface CAUSEWAYAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: CAUSEWAYData;
}

// Export types
export type CAUSEWAYExportFormat = 'pdf' | 'docx' | 'json';
