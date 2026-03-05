import type { CopLayerDef, CopTemplateType } from '@/types/cop'

export const COP_LAYERS: CopLayerDef[] = [
  // ── Entity Layers ────────────────────────────────────────
  {
    id: 'places',
    name: 'Places',
    description: 'Facilities, cities, installations, and strategic locations',
    category: 'entities',
    icon: 'MapPin',
    source: { type: 'api', endpoint: '/layers/places' },
    render: {
      type: 'cluster',
      color: '#3b82f6',
      clusterRadius: 50,
      iconMapping: {
        FACILITY: 'building',
        CITY: 'landmark',
        REGION: 'map',
        COUNTRY: 'flag',
        INSTALLATION: 'shield',
      },
    },
    defaultFor: ['quick_brief', 'event_monitor', 'area_study', 'crisis_response', 'custom'],
    filterable: true,
    filterFields: ['place_type', 'country', 'strategic_importance'],
  },
  {
    id: 'events',
    name: 'Events',
    description: 'Operations, incidents, meetings, and activities',
    category: 'entities',
    icon: 'Calendar',
    source: { type: 'api', endpoint: '/layers/events' },
    render: {
      type: 'cluster',
      color: '#ef4444',
      clusterRadius: 40,
      iconMapping: {
        OPERATION: 'swords',
        INCIDENT: 'alert-triangle',
        MEETING: 'users',
        ACTIVITY: 'activity',
      },
    },
    defaultFor: ['quick_brief', 'event_monitor', 'area_study', 'crisis_response', 'custom'],
    filterable: true,
    filterFields: ['event_type', 'significance', 'confidence'],
  },
  {
    id: 'actors',
    name: 'Actors',
    description: 'People, organizations, and groups with known locations',
    category: 'entities',
    icon: 'Users',
    source: { type: 'api', endpoint: '/layers/actors' },
    render: {
      type: 'point',
      color: '#8b5cf6',
      iconMapping: {
        PERSON: 'user',
        ORGANIZATION: 'building-2',
        GROUP: 'users',
        GOVERNMENT: 'landmark',
        UNIT: 'shield',
      },
    },
    defaultFor: ['event_monitor', 'area_study', 'crisis_response', 'custom'],
    filterable: true,
    filterFields: ['actor_type', 'category', 'affiliation'],
  },
  {
    id: 'relationships',
    name: 'Relationships',
    description: 'Lines connecting related entities',
    category: 'entities',
    icon: 'GitBranch',
    source: { type: 'api', endpoint: '/layers/relationships' },
    render: { type: 'line', color: '#6b7280' },
    defaultFor: ['area_study', 'crisis_response'],
    filterable: true,
    filterFields: ['relationship_type', 'confidence'],
  },

  // ── External Layers ──────────────────────────────────────
  {
    id: 'acled',
    name: 'ACLED Conflicts',
    description: 'Armed conflict events from ACLED (battles, protests, riots, violence)',
    category: 'external',
    icon: 'Flame',
    source: { type: 'api', endpoint: '/layers/acled', refreshSeconds: 3600 },
    render: {
      type: 'cluster',
      color: '#dc2626',
      clusterRadius: 60,
      iconMapping: {
        Battles: 'swords',
        'Violence against civilians': 'alert-circle',
        Protests: 'megaphone',
        Riots: 'flame',
        'Strategic developments': 'target',
        Explosions: 'zap',
      },
    },
    defaultFor: ['event_monitor', 'crisis_response'],
    filterable: true,
    filterFields: ['event_type', 'sub_event_type', 'actor1'],
  },
  {
    id: 'gdelt',
    name: 'GDELT News',
    description: 'Geolocated news events from GDELT',
    category: 'external',
    icon: 'Newspaper',
    source: { type: 'api', endpoint: '/layers/gdelt', refreshSeconds: 900 },
    render: { type: 'heatmap', color: '#f59e0b' },
    defaultFor: ['event_monitor'],
    filterable: false,
  },

  // ── Analysis Layers ──────────────────────────────────────
  {
    id: 'deception-risk',
    name: 'Deception Risk',
    description: 'Deception risk heatmap from intelligence synthesis',
    category: 'analysis',
    icon: 'Eye',
    source: { type: 'api', endpoint: '/layers/analysis?type=deception' },
    render: { type: 'heatmap', color: '#7c3aed' },
    defaultFor: ['area_study'],
    filterable: false,
  },
  {
    id: 'framework-overlay',
    name: 'Framework Analysis',
    description: 'Overlay data from linked analytical frameworks',
    category: 'analysis',
    icon: 'Brain',
    source: { type: 'api', endpoint: '/layers/analysis?type=framework' },
    render: { type: 'point', color: '#059669' },
    defaultFor: ['area_study'],
    filterable: false,
  },

  // ── Tactical Layers ──────────────────────────────────────
  {
    id: 'cop-markers',
    name: 'Tactical Markers',
    description: 'User-placed markers (CoT-compatible)',
    category: 'tactical',
    icon: 'Crosshair',
    source: { type: 'api', endpoint: '/layers/markers', refreshSeconds: 30 },
    render: { type: 'point', color: '#eab308' },
    defaultFor: ['crisis_response'],
    filterable: false,
  },
  {
    id: 'user-drawings',
    name: 'Drawings',
    description: 'Freehand lines, polygons, and annotations (client-side only)',
    category: 'tactical',
    icon: 'Pencil',
    source: { type: 'static', endpoint: '' },
    render: { type: 'polygon', color: '#f97316' },
    defaultFor: ['crisis_response'],
    filterable: false,
  },
]

export function getLayersForTemplate(templateType: CopTemplateType): CopLayerDef[] {
  return COP_LAYERS.filter(l => l.defaultFor.includes(templateType))
}

export function getLayerById(id: string): CopLayerDef | undefined {
  return COP_LAYERS.find(l => l.id === id)
}
