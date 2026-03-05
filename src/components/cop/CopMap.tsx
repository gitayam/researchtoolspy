import { useRef, useEffect, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { CopSession, CopFeatureCollection } from '@/types/cop'

// ── Color mapping per layer id ──────────────────────────────────
const LAYER_COLORS: Record<string, string> = {
  places: '#3b82f6',
  events: '#ef4444',
  actors: '#8b5cf6',
  relationships: '#6b7280',
  acled: '#dc2626',
  gdelt: '#f59e0b',
  'deception-risk': '#7c3aed',
  'framework-overlay': '#059669',
  'cop-markers': '#eab308',
}

function getLayerColor(layerId: string): string {
  return LAYER_COLORS[layerId] ?? '#94a3b8'
}

// ── Line layers are identified by id ────────────────────────────
const LINE_LAYER_IDS = new Set(['relationships'])

function isLineLayer(layerId: string): boolean {
  return LINE_LAYER_IDS.has(layerId)
}

// ── Props ───────────────────────────────────────────────────────
export interface CopMapProps {
  session: CopSession
  layers: Record<string, CopFeatureCollection>
  onMapClick?: (lngLat: { lng: number; lat: number }) => void
  onBboxChange?: (bbox: [number, number, number, number]) => void
}

// ── Component ───────────────────────────────────────────────────
export default function CopMap({
  session,
  layers,
  onMapClick,
  onBboxChange,
}: CopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const addedSourcesRef = useRef<Set<string>>(new Set())

  // Stable callback refs so we don't re-register listeners on every render
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick
  const onBboxChangeRef = useRef(onBboxChange)
  onBboxChangeRef.current = onBboxChange

  // ── Fire bbox on current bounds ─────────────────────────────
  const emitBbox = useCallback((map: maplibregl.Map) => {
    const bounds = map.getBounds()
    onBboxChangeRef.current?.([
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ])
  }, [])

  // ── Initialize map ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [session.center_lon ?? 0, session.center_lat ?? 0],
      zoom: session.zoom_level ?? 3,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right')

    // Map click handler
    map.on('click', (e) => {
      onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    })

    // Bbox change on moveend
    map.on('moveend', () => {
      emitBbox(map)
    })

    // Emit initial bbox once the map is loaded
    map.on('load', () => {
      emitBbox(map)
    })

    mapRef.current = map

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
      addedSourcesRef.current.clear()
    }
    // Only initialize once; session props are read at mount time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync layers with the map ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Wait for the style to be loaded before touching sources/layers
    const applyLayers = () => {
      for (const [layerId, fc] of Object.entries(layers)) {
        const sourceId = `cop-${layerId}`

        // If the source already exists, update its data
        const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
        if (existingSource) {
          existingSource.setData(fc as unknown as GeoJSON.FeatureCollection)
          continue
        }

        // Otherwise, add a new source + layer(s)
        const isLine = isLineLayer(layerId)
        const color = getLayerColor(layerId)

        map.addSource(sourceId, {
          type: 'geojson',
          data: fc as unknown as GeoJSON.FeatureCollection,
          ...(isLine
            ? {}
            : { cluster: true, clusterMaxZoom: 14, clusterRadius: 50 }),
        })

        addedSourcesRef.current.add(sourceId)

        if (isLine) {
          addLineLayer(map, sourceId, layerId, color)
        } else {
          addPointLayers(map, sourceId, layerId, color)
        }
      }
    }

    if (map.isStyleLoaded()) {
      applyLayers()
    } else {
      map.once('load', applyLayers)
    }
  }, [layers])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: 400 }}
    />
  )
}

// ── Line layer ──────────────────────────────────────────────────
function addLineLayer(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
  color: string,
) {
  const mlLayerId = `cop-layer-${layerId}`

  map.addLayer({
    id: mlLayerId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': color,
      'line-width': 2,
      'line-opacity': 0.7,
    },
  })

  // Pointer cursor on hover
  map.on('mouseenter', mlLayerId, () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', mlLayerId, () => {
    map.getCanvas().style.cursor = ''
  })
}

// ── Point + cluster layers ──────────────────────────────────────
function addPointLayers(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
  color: string,
) {
  const clusterId = `cop-cluster-${layerId}`
  const clusterCountId = `cop-cluster-count-${layerId}`
  const unclusteredId = `cop-unclustered-${layerId}`

  // 1. Cluster circles with step-based radius
  map.addLayer({
    id: clusterId,
    type: 'circle',
    source: sourceId,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': color,
      'circle-opacity': 0.75,
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        15,   // default radius
        10, 20,   // >= 10 points
        50, 25,   // >= 50 points
        100, 30,  // >= 100 points
      ],
    },
  })

  // 2. Cluster count labels
  map.addLayer({
    id: clusterCountId,
    type: 'symbol',
    source: sourceId,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-size': 12,
    },
    paint: {
      'text-color': '#ffffff',
    },
  })

  // 3. Individual (unclustered) points
  map.addLayer({
    id: unclusteredId,
    type: 'circle',
    source: sourceId,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': color,
      'circle-radius': 7,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  })

  // Pointer cursor on hover for unclustered points
  map.on('mouseenter', unclusteredId, () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', unclusteredId, () => {
    map.getCanvas().style.cursor = ''
  })

  // Popup on click for individual points
  map.on('click', unclusteredId, (e) => {
    const feature = e.features?.[0]
    if (!feature || feature.geometry.type !== 'Point') return

    const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number]
    const props = feature.properties ?? {}

    const name = String(props.name ?? props.callsign ?? props.label ?? 'Untitled')
    const description = String(props.description ?? '')
    const entityType = String(props.entity_type ?? props.event_type ?? props.source_type ?? '')

    const html = `
      <div style="max-width: 220px; font-family: system-ui, sans-serif;">
        <strong style="font-size: 13px; color: #e2e8f0;">${escapeHtml(name)}</strong>
        ${entityType ? `<div style="font-size: 11px; color: ${color}; margin-top: 2px;">${escapeHtml(entityType)}</div>` : ''}
        ${description ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${escapeHtml(description)}</div>` : ''}
      </div>
    `

    // Ensure that if the map is zoomed out such that multiple copies of the
    // feature are visible, the popup appears over the copy being pointed at.
    while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
      coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
    }

    new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map)
  })

  // Click on a cluster: zoom in
  map.on('click', clusterId, (e) => {
    const feature = e.features?.[0]
    if (!feature || feature.geometry.type !== 'Point') return

    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
    const clusterId2 = feature.properties?.cluster_id as number | undefined
    if (clusterId2 == null) return

    source.getClusterExpansionZoom(clusterId2).then((zoom) => {
      map.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom,
      })
    })
  })

  // Pointer cursor on cluster hover
  map.on('mouseenter', clusterId, () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', clusterId, () => {
    map.getCanvas().style.cursor = ''
  })
}

// ── Utility ─────────────────────────────────────────────────────
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
