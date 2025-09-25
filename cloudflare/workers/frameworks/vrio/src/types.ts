/**
 * VRIO Framework Type Definitions
 */

// Core data structure
export interface VRIOData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface VRIOCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface VRIOUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface VRIOAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: VRIOData;
}

// Export types
export type VRIOExportFormat = 'pdf' | 'docx' | 'json';
