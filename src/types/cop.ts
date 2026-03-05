// Common Operating Picture types

export const CopTemplateType = {
  QUICK_BRIEF: 'quick_brief',
  EVENT_MONITOR: 'event_monitor',
  AREA_STUDY: 'area_study',
  CRISIS_RESPONSE: 'crisis_response',
  CUSTOM: 'custom',
} as const

export type CopTemplateType = typeof CopTemplateType[keyof typeof CopTemplateType]

export const CopStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const

export type CopStatus = typeof CopStatus[keyof typeof CopStatus]

export const CopLayerCategory = {
  ENTITIES: 'entities',
  EXTERNAL: 'external',
  ANALYSIS: 'analysis',
  TACTICAL: 'tactical',
} as const

export type CopLayerCategory = typeof CopLayerCategory[keyof typeof CopLayerCategory]

export interface CopSession {
  id: string
  name: string
  description: string | null
  template_type: CopTemplateType
  status: CopStatus

  bbox_min_lat: number | null
  bbox_min_lon: number | null
  bbox_max_lat: number | null
  bbox_max_lon: number | null
  center_lat: number | null
  center_lon: number | null
  zoom_level: number

  time_window_start: string | null
  time_window_end: string | null
  rolling_hours: number | null

  active_layers: string[]
  layer_config: Record<string, LayerOverride>
  linked_frameworks: string[]
  key_questions: string[]

  workspace_id: string
  created_by: number
  is_public: number

  created_at: string
  updated_at: string
}

export interface LayerOverride {
  opacity?: number
  color?: string
  visible?: boolean
  filters?: Record<string, string>
}

export interface CopMarker {
  id: string
  cop_session_id: string
  uid: string
  cot_type: string
  callsign: string | null
  lat: number
  lon: number
  hae: number

  label: string | null
  description: string | null
  icon: string | null
  color: string | null
  detail: Record<string, unknown>

  event_time: string
  stale_time: string | null

  source_type: 'MANUAL' | 'ENTITY' | 'ACLED' | 'GDELT' | 'FRAMEWORK'
  source_id: string | null

  workspace_id: string
  created_by: number
  created_at: string
}

export interface CopLayerDef {
  id: string
  name: string
  description: string
  category: CopLayerCategory
  icon: string

  source: {
    type: 'api' | 'geojson-url' | 'static'
    endpoint: string
    refreshSeconds?: number
    params?: Record<string, string>
  }

  render: {
    type: 'point' | 'cluster' | 'heatmap' | 'line' | 'polygon'
    color: string
    iconMapping?: Record<string, string>
    clusterRadius?: number
    minZoom?: number
    maxZoom?: number
  }

  defaultFor: CopTemplateType[]
  filterable: boolean
  filterFields?: string[]
}

export interface CopGeoJsonFeature {
  type: 'Feature'
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon'
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, unknown>
}

export interface CopFeatureCollection {
  type: 'FeatureCollection'
  features: CopGeoJsonFeature[]
}

export interface CopWizardInput {
  purpose: CopTemplateType
  location: {
    search?: string
    bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number }
    center?: { lat: number; lon: number }
    zoom?: number
  }
  timeWindow: {
    type: 'snapshot' | 'rolling' | 'fixed' | 'ongoing'
    rollingHours?: number
    start?: string
    end?: string
  }
  questions: string[]
}

export interface CopWizardOutput {
  name: string
  description: string
  recommended_layers: string[]
  suggested_frameworks: string[]
  additional_questions: string[]
}
