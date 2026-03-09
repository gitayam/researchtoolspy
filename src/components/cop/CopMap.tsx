import { useRef, useEffect, useCallback, useState } from 'react'
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
  /** When true, the map enters pin-placement mode with a crosshair cursor */
  pinPlacementMode?: boolean
  /** Called when user clicks to place a pin in placement mode */
  onPinPlaced?: (lat: number, lon: number) => void
  /** Called when user clicks "Open in Feed" on a marker with a backlink */
  onMarkerOpenInFeed?: (sourceType: string, sourceId: string) => void
}

// ── Component ───────────────────────────────────────────────────
export default function CopMap({
  session,
  layers,
  onMapClick,
  onBboxChange,
  pinPlacementMode = false,
  onPinPlaced,
  onMarkerOpenInFeed,
}: CopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const addedSourcesRef = useRef<Set<string>>(new Set())
  const [mapError, setMapError] = useState<string | null>(null)

  // Stable callback refs so we don't re-register listeners on every render
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick
  const onBboxChangeRef = useRef(onBboxChange)
  onBboxChangeRef.current = onBboxChange
  const pinPlacementModeRef = useRef(pinPlacementMode)
  pinPlacementModeRef.current = pinPlacementMode
  const onPinPlacedRef = useRef(onPinPlaced)
  onPinPlacedRef.current = onPinPlaced
  const onMarkerOpenInFeedRef = useRef(onMarkerOpenInFeed)
  onMarkerOpenInFeedRef.current = onMarkerOpenInFeed

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
    const el = containerRef.current
    if (!el) return

    let map: maplibregl.Map | null = null
    let ro: ResizeObserver | null = null

    function initMap() {
      if (map || !el) return
      // Guard: don't init if container has no dimensions yet
      if (el.clientWidth === 0 || el.clientHeight === 0) return

      try {
        map = new maplibregl.Map({
          container: el,
          style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
          center: [session.center_lon ?? 0, session.center_lat ?? 0],
          zoom: session.zoom_level ?? 5,
        })

        map.addControl(new maplibregl.NavigationControl(), 'top-right')
        map.addControl(new maplibregl.ScaleControl(), 'bottom-right')

        map.on('click', (e) => {
          if (pinPlacementModeRef.current && onPinPlacedRef.current) {
            onPinPlacedRef.current(e.lngLat.lat, e.lngLat.lng)
            return
          }
          onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat })
        })
        map.on('moveend', () => { if (map) emitBbox(map) })
        map.on('load', () => { if (map) emitBbox(map) })

        mapRef.current = map
      } catch (err) {
        console.warn('[CopMap] Failed to initialize map:', err)
        setMapError('Map could not be loaded')
      }
    }

    // Use ResizeObserver to wait for the container to get real dimensions,
    // then init the map and keep it resized on layout changes.
    ro = new ResizeObserver(() => {
      if (!map) {
        initMap()
      } else {
        map.resize()
      }
    })
    ro.observe(el)

    // Also try immediately in case layout is already calculated
    initMap()

    return () => {
      ro?.disconnect()
      popupRef.current?.remove()
      popupRef.current = null
      if (map) {
        map.remove()
        map = null
      }
      mapRef.current = null
      addedSourcesRef.current.clear()
    }
    // Only initialize once; session props are read at mount time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Pin placement mode cursor ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const canvas = map.getCanvas()
    if (pinPlacementMode) {
      canvas.style.cursor = 'crosshair'
    } else {
      canvas.style.cursor = ''
    }
    return () => {
      canvas.style.cursor = ''
    }
  }, [pinPlacementMode])

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
          addPointLayers(map, sourceId, layerId, color, popupRef, onMarkerOpenInFeedRef)
        }
      }
    }

    if (map.isStyleLoaded()) {
      applyLayers()
    } else {
      let cancelled = false
      const guardedApply = () => { if (!cancelled) applyLayers() }
      map.once('load', guardedApply)
      return () => {
        cancelled = true
        map.off('load', guardedApply)
      }
    }
  }, [layers])

  if (mapError) {
    return (
      <div
        data-testid="cop-map-fallback"
        className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-[#1a1a2e]"
      >
        <span className="text-sm text-gray-500 dark:text-gray-500">{mapError}</span>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={containerRef}
        data-testid="cop-map"
        style={{ width: '100%', height: '100%' }}
      />
      {/* Pin placement mode banner */}
      {pinPlacementMode && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}
          className="px-4 py-2 rounded-lg bg-blue-600/90 text-white text-xs font-medium shadow-lg backdrop-blur-sm flex items-center gap-2"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" />
          Click on the map to place pin
        </div>
      )}
    </div>
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
  popupRef: React.MutableRefObject<maplibregl.Popup | null>,
  onMarkerOpenInFeedRef?: React.MutableRefObject<((sourceType: string, sourceId: string) => void) | undefined>,
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

    const sourceType = String(props.source_type ?? '')
    const sourceId = String(props.source_id ?? '')
    const hasBacklink = sourceId && (sourceType === 'EVIDENCE' || sourceType === 'HYPOTHESIS')

    const backlinkLabel = sourceType === 'EVIDENCE' ? 'View Evidence' : sourceType === 'HYPOTHESIS' ? 'View Hypothesis' : ''
    const backlinkBtnId = hasBacklink ? `cop-backlink-${Date.now()}` : ''

    const html = `
      <div style="max-width: 240px; font-family: system-ui, sans-serif;">
        <strong style="font-size: 13px; color: #e2e8f0;">${escapeHtml(name)}</strong>
        ${entityType ? `<div style="font-size: 11px; color: ${sanitizeColor(color)}; margin-top: 2px;">${escapeHtml(entityType)}</div>` : ''}
        ${description ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${escapeHtml(description)}</div>` : ''}
        ${hasBacklink ? `<button id="${backlinkBtnId}" style="margin-top: 6px; padding: 3px 8px; font-size: 11px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; cursor: pointer;">${backlinkLabel}</button>` : ''}
      </div>
    `

    // Ensure that if the map is zoomed out such that multiple copies of the
    // feature are visible, the popup appears over the copy being pointed at.
    while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
      coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
    }

    popupRef.current?.remove()
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map)
    popupRef.current = popup

    // Wire backlink button click
    if (hasBacklink && backlinkBtnId) {
      const btn = document.getElementById(backlinkBtnId)
      btn?.addEventListener('click', () => {
        onMarkerOpenInFeedRef?.current?.(sourceType, sourceId)
        popup.remove()
      })
    }
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

function sanitizeColor(value: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value
  if (/^(rgb|hsl)a?\([^)]+\)$/.test(value)) return value
  if (/^[a-zA-Z]+$/.test(value)) return value
  return '#94a3b8'
}
