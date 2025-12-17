/**
 * Settings Types
 *
 * Type definitions for hash-based user settings
 */

export type Theme = 'light' | 'dark' | 'system'
export type Language = 'en' | 'es'
export type Density = 'compact' | 'comfortable' | 'spacious'
export type SidebarBehavior = 'always_open' | 'auto_collapse' | 'manual'
export type FontSize = 'small' | 'medium' | 'large' | 'x-large'

export type AIModel = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-4o-mini'

export interface DisplaySettings {
  theme: Theme
  language: Language
  density: Density
  sidebar_behavior: SidebarBehavior
  font_size: FontSize
  show_tooltips: boolean
  animation_enabled: boolean
}

export interface AISettings {
  default_model: AIModel
  temperature: number // 0.0 - 1.0
  max_tokens: number
  show_cost_tracking: boolean
  show_token_usage: boolean
  auto_suggestions: boolean
  context_window: number
}

export interface NotificationSettings {
  email_enabled: boolean
  desktop_enabled: boolean
  analysis_complete: boolean
  export_ready: boolean
  workspace_invite: boolean
}

export interface WorkspaceSettings {
  default_workspace_id: string
  auto_save_enabled: boolean
  auto_save_interval: number // seconds
  show_recent_items: boolean
  recent_items_limit: number
}

export interface UserSettings {
  user_hash: string
  display: DisplaySettings
  ai: AISettings
  notifications: NotificationSettings
  workspace: WorkspaceSettings
  updated_at?: string
}

export interface SettingUpdate {
  category: 'display' | 'ai' | 'notifications' | 'workspace'
  key: string
  value: unknown
}

// Workspace types (enhanced from existing)
export type WorkspaceType = 'PERSONAL' | 'TEAM' | 'PUBLIC'
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Workspace {
  id: string
  name: string
  description?: string
  type: WorkspaceType
  user_hash: string // Owner's hash
  is_public: boolean
  is_default: boolean
  created_at: string
  updated_at?: string
  member_count?: number
  role?: WorkspaceRole // User's role in this workspace
}

export interface WorkspaceCreateInput {
  name: string
  description?: string
  type: WorkspaceType
  is_public?: boolean
}

export interface WorkspaceUpdateInput {
  name?: string
  description?: string
  is_public?: boolean
}

// Data export types
export type ExportFormat = 'json' | 'csv' | 'excel' | 'pdf'
export type ExportType = 'full' | 'workspace' | 'settings' | 'frameworks' | 'evidence'

export interface ExportRequest {
  export_type: ExportType
  format: ExportFormat
  workspace_id?: string
  include_metadata?: boolean
  include_comments?: boolean
  date_range?: {
    start: string
    end: string
  }
}

export interface ExportResponse {
  export_id: string
  user_hash: string
  export_type: ExportType
  format: ExportFormat
  file_size: number
  item_count: number
  download_url: string
  expires_at: string
  created_at: string
}

export interface DataExport {
  export_id: string
  user_hash: string
  exported_at: string
  version: string
  data: {
    settings: UserSettings
    workspaces: Workspace[]
    frameworks?: unknown[]
    evidence?: unknown[]
    analyses?: unknown[]
  }
}

export interface ImportOptions {
  merge: boolean // Merge with existing data
  overwrite: boolean // Overwrite existing items
  import_settings: boolean
  import_workspaces: boolean
  import_frameworks: boolean
  import_evidence: boolean
  import_analyses: boolean
}

export interface ImportRequest {
  data: DataExport
  options: ImportOptions
}

export interface ImportResponse {
  success: boolean
  imported_count: {
    settings: number
    workspaces: number
    frameworks: number
    evidence: number
    analyses: number
  }
  errors?: string[]
  warnings?: string[]
}

// Hash backup types
export interface HashBackup {
  account_hash: string
  created_at: string
  backup_code: string // Additional verification code
  recovery_instructions: string
  workspaces: string[] // List of workspace names
  last_login?: string
}

// Default settings
export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: 'system',
  language: 'en',
  density: 'comfortable',
  sidebar_behavior: 'auto_collapse',
  font_size: 'medium',
  show_tooltips: true,
  animation_enabled: true,
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  default_model: 'gpt-5-mini',
  temperature: 0.7,
  max_tokens: 2048,
  show_cost_tracking: true,
  show_token_usage: true,
  auto_suggestions: true,
  context_window: 4096,
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_enabled: false,
  desktop_enabled: true,
  analysis_complete: true,
  export_ready: true,
  workspace_invite: true,
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  default_workspace_id: '1',
  auto_save_enabled: true,
  auto_save_interval: 30,
  show_recent_items: true,
  recent_items_limit: 10,
}

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, 'user_hash'> = {
  display: DEFAULT_DISPLAY_SETTINGS,
  ai: DEFAULT_AI_SETTINGS,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  workspace: DEFAULT_WORKSPACE_SETTINGS,
}
