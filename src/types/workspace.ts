/**
 * Unified Workspace Types
 *
 * Maps unified workspace types to both investigation types and COP templates,
 * enabling a single wizard to create both records atomically.
 */

import type { CopTemplateType, CopEventType } from '@/types/cop'

// ── Workspace Type Union ────────────────────────────────────────

export type UnifiedWorkspaceType =
  | 'deep_research'
  | 'quick_analysis'
  | 'topic_exploration'
  | 'event_monitor'
  | 'crisis_response'
  | 'event_analysis'

// ── Workspace Type Definition ───────────────────────────────────

export interface WorkspaceTypeDefinition {
  id: UnifiedWorkspaceType
  label: string
  description: string
  features: string[]
  icon: string
  investigationType: 'structured_research' | 'general_topic' | 'rapid_analysis'
  copTemplate: CopTemplateType
  timeHint: string
}

export const WORKSPACE_TYPES: WorkspaceTypeDefinition[] = [
  {
    id: 'deep_research',
    label: 'Deep Research',
    description: 'Systematic investigation with full analytical toolkit',
    features: ['Research question & plan', 'Hypothesis testing', 'Full layer stack', 'Framework analyses'],
    icon: 'BookOpen',
    investigationType: 'structured_research',
    copTemplate: 'area_study',
    timeHint: 'All time',
  },
  {
    id: 'quick_analysis',
    label: 'Quick Analysis',
    description: 'Fast turnaround analysis for immediate insights',
    features: ['Single framework focus', 'Quick brief layers', 'Targeted analysis', 'Immediate results'],
    icon: 'Zap',
    investigationType: 'rapid_analysis',
    copTemplate: 'quick_brief',
    timeHint: '1h snapshot',
  },
  {
    id: 'topic_exploration',
    label: 'Topic Exploration',
    description: 'Open-ended exploration of a topic or region',
    features: ['Flexible exploration', 'Multiple perspectives', 'Evidence gathering', 'Custom layers'],
    icon: 'Folder',
    investigationType: 'general_topic',
    copTemplate: 'custom',
    timeHint: 'Your choice',
  },
  {
    id: 'event_monitor',
    label: 'Event Monitor',
    description: 'Track a developing situation in real time',
    features: ['Rolling time window', 'ACLED + GDELT feeds', 'Auto-refresh layers', 'Alert-ready'],
    icon: 'Radio',
    investigationType: 'general_topic',
    copTemplate: 'event_monitor',
    timeHint: '48h rolling',
  },
  {
    id: 'crisis_response',
    label: 'Crisis Response',
    description: 'Full operational picture for active situations',
    features: ['Tactical markers', 'All conflict feeds', 'Drawing tools', 'Relationship mapping'],
    icon: 'AlertTriangle',
    investigationType: 'structured_research',
    copTemplate: 'crisis_response',
    timeHint: 'Ongoing',
  },
  {
    id: 'event_analysis',
    label: 'Event Analysis',
    description: 'Analyze a specific event with full intel toolkit',
    features: ['Event classification', 'Timeline building', 'Source URLs', 'Fact extraction'],
    icon: 'Search',
    investigationType: 'structured_research',
    copTemplate: 'event_analysis',
    timeHint: 'Event-driven',
  },
]

// ── Wizard State ────────────────────────────────────────────────

export interface WorkspaceWizardData {
  // Step 1: Purpose
  workspaceType: UnifiedWorkspaceType | null

  // Step 2: Details
  title: string
  description: string
  tags: string[]

  // Step 2.5: Event details (event_analysis only)
  eventType: CopEventType | ''
  eventDescription: string
  initialUrls: string

  // Step 3: Location
  locationSearch: string

  // Step 4: Time window
  selectedTimeHours: number | null | undefined // undefined = not yet chosen

  // Step 5: Key questions
  questions: string[]
}
