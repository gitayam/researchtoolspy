import { useRef, useEffect, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { CopSession, CopFeatureCollection } from '@/types/cop'
import { convertPooLayerData } from '@/components/cop/poo-geometry'

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
  'poo-estimates': '#ef4444',
  'user-drawings': '#f97316',
}

function getLayerColor(layerId: string): string {
  return LAYER_COLORS[layerId] ?? '#94a3b8'
}

// ── Line layers are identified by id ────────────────────────────
const LINE_LAYER_IDS = new Set(['relationships'])

function isLineLayer(layerId: string): boolean {
  return LINE_LAYER_IDS.has(layerId)
}

// ── Polygon layers (POO estimates, user drawings) ───────────────
const POLYGON_LAYER_IDS = new Set(['poo-estimates', 'user-drawings'])

function isPolygonLayer(layerId: string): boolean {
  return POLYGON_LAYER_IDS.has(layerId)
}

// ── Layers that need data transformation before rendering ───────
const POO_LAYER_ID = 'poo-estimates'

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
  const hasFittedRef = useRef(false)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Wait for the style to be loaded before touching sources/layers
    const applyLayers = () => {
      let newSourceAdded = false

      for (const [layerId, fc] of Object.entries(layers)) {
        const sourceId = `cop-${layerId}`

        // Transform POO layer data from points to polygons before rendering
        let resolvedData: GeoJSON.FeatureCollection = fc as unknown as GeoJSON.FeatureCollection
        if (layerId === POO_LAYER_ID) {
          resolvedData = convertPooLayerData(resolvedData)
        }

        // If the source already exists, update its data
        const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
        if (existingSource) {
          existingSource.setData(resolvedData)
          continue
        }

        // Otherwise, add a new source + layer(s)
        const isLine = isLineLayer(layerId)
        const isPolygon = isPolygonLayer(layerId)
        const color = getLayerColor(layerId)

        map.addSource(sourceId, {
          type: 'geojson',
          data: resolvedData,
          ...(isLine || isPolygon
            ? {}
            : { cluster: true, clusterMaxZoom: 14, clusterRadius: 50 }),
        })

        addedSourcesRef.current.add(sourceId)
        newSourceAdded = true

        if (isPolygon) {
          addPolygonLayers(map, sourceId, layerId, color, popupRef)
        } else if (isLine) {
          addLineLayer(map, sourceId, layerId, color)
        } else {
          addPointLayers(map, sourceId, layerId, color, popupRef, onMarkerOpenInFeedRef)
        }
      }

      // Auto-zoom to fit all features on first data load
      if (newSourceAdded && !hasFittedRef.current) {
        const bounds = new maplibregl.LngLatBounds()
        let hasCoords = false

        for (const fc of Object.values(layers)) {
          for (const f of fc.features ?? []) {
            const geom = f.geometry
            if (geom.type === 'Point') {
              bounds.extend(geom.coordinates as [number, number])
              hasCoords = true
            } else if (geom.type === 'LineString') {
              for (const c of geom.coordinates) {
                bounds.extend(c as [number, number])
                hasCoords = true
              }
            } else if (geom.type === 'Polygon') {
              for (const ring of geom.coordinates as number[][][]) {
                for (const c of ring as number[][]) {
                  bounds.extend(c as [number, number])
                  hasCoords = true
                }
              }
            }
          }
        }

        if (hasCoords) {
          hasFittedRef.current = true
          map.fitBounds(bounds, { padding: 50, maxZoom: 12 })
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
        className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900"
      >
        <span className="text-sm text-gray-500 dark:text-gray-400">{mapError}</span>
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

    // Wire backlink button click (use onclick to avoid listener accumulation)
    if (hasBacklink && backlinkBtnId) {
      const btn = document.getElementById(backlinkBtnId)
      if (btn) {
        btn.onclick = () => {
          onMarkerOpenInFeedRef?.current?.(sourceType, sourceId)
          popup.remove()
        }
      }
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

// ── Confidence color helper ──────────────────────────────────────
const CONFIDENCE_POPUP_COLORS: Record<string, string> = {
  CONFIRMED: '#22c55e',
  PROBABLE: '#3b82f6',
  POSSIBLE: '#eab308',
  DOUBTFUL: '#ef4444',
}

// ── Polygon layers (POO estimates, drawings) ────────────────────

function addPolygonLayers(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
  color: string,
  popupRef: React.MutableRefObject<maplibregl.Popup | null>,
) {
  const fillId = `cop-fill-${layerId}`
  const outlineId = `cop-outline-${layerId}`
  const vectorId = `cop-vector-${layerId}`
  const impactId = `cop-impact-${layerId}`
  const labelId = `cop-label-${layerId}`

  // 1. Fill layer for polygons (circles, sectors) — skip range-ring (outline-only)
  map.addLayer({
    id: fillId,
    type: 'fill',
    source: sourceId,
    filter: ['all',
      ['==', ['geometry-type'], 'Polygon'],
      ['!=', ['get', 'layer_type'], 'range-ring'],
    ],
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], color],
      'fill-opacity': ['coalesce', ['get', 'opacity'], 0.15],
    },
  })

  // 2. Outline layer — solid for sectors, dashed for range circles
  map.addLayer({
    id: outlineId,
    type: 'line',
    source: sourceId,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'line-color': ['coalesce', ['get', 'stroke_color'], color],
      'line-opacity': ['coalesce', ['get', 'stroke_opacity'], 0.6],
      'line-width': ['coalesce', ['get', 'stroke_width'], 2],
      'line-dasharray': ['match', ['get', 'layer_type'],
        'probability-sector', ['literal', [1]],
        'max-range', ['literal', [6, 3]],
        'min-range', ['literal', [3, 2]],
        ['literal', [2, 2]],
      ],
    },
  })

  // 3. Approach vector line (bearing centerline from impact outward)
  map.addLayer({
    id: vectorId,
    type: 'line',
    source: sourceId,
    filter: ['all',
      ['==', ['geometry-type'], 'LineString'],
      ['==', ['get', 'layer_type'], 'approach-vector'],
    ],
    paint: {
      'line-color': ['coalesce', ['get', 'color'], color],
      'line-opacity': ['coalesce', ['get', 'stroke_opacity'], 0.7],
      'line-width': 2,
      'line-dasharray': [8, 4],
    },
  })

  // 4. Impact point marker (crosshair style)
  map.addLayer({
    id: impactId,
    type: 'circle',
    source: sourceId,
    filter: ['all',
      ['==', ['geometry-type'], 'Point'],
      ['==', ['get', 'layer_type'], 'impact-point'],
    ],
    paint: {
      'circle-radius': 9,
      'circle-color': 'rgba(0,0,0,0.6)',
      'circle-stroke-width': 3,
      'circle-stroke-color': ['coalesce', ['get', 'color'], color],
      'circle-opacity': 1,
    },
  })

  // 5. Range label text along bearing line
  map.addLayer({
    id: labelId,
    type: 'symbol',
    source: sourceId,
    filter: ['all',
      ['==', ['geometry-type'], 'Point'],
      ['==', ['get', 'layer_type'], 'range-label'],
    ],
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-offset': [0, -1.2],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#e2e8f0',
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 1.5,
    },
  })

  // Hover cursor on polygons and impact
  for (const lid of [fillId, impactId]) {
    map.on('mouseenter', lid, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = '' })
  }

  // Click popup for polygon features (circles, sectors)
  map.on('click', fillId, (e) => {
    const feature = e.features?.[0]
    if (!feature) return

    const props = feature.properties ?? {}
    const name = String(props.poo_name ?? props.name ?? 'Untitled')
    const layerType = String(props.layer_type ?? '')
    const confidence = props.confidence ? String(props.confidence) : ''
    const confColor = CONFIDENCE_POPUP_COLORS[confidence] ?? '#94a3b8'
    const rangeBasis = props.range_basis ? String(props.range_basis) : ''
    const maxRange = props.max_range_km ? `${props.max_range_km}km` : ''
    const bearing = props.bearing != null ? `${props.bearing}°` : ''
    const bearingCardinal = props.bearing_cardinal ? String(props.bearing_cardinal) : ''
    const bearingBasis = props.bearing_basis ? String(props.bearing_basis) : ''
    const sectorWidth = props.sector_width_deg ? `${props.sector_width_deg}°` : ''

    let typeLabel = ''
    let typeColor = color
    if (layerType === 'max-range') { typeLabel = 'Max Range Circle'; typeColor = color }
    else if (layerType === 'probability-sector') { typeLabel = 'Probability Sector'; typeColor = confColor }
    else if (layerType === 'min-range') { typeLabel = 'Min Range Exclusion' }
    else if (layerType === 'range-ring') { typeLabel = `${props.range_km ?? ''}km Ring` }

    const html = `
      <div style="max-width: 280px; font-family: system-ui, sans-serif; line-height: 1.4;">
        <strong style="font-size: 13px; color: #e2e8f0;">${escapeHtml(name)}</strong>
        <div style="font-size: 11px; color: ${sanitizeColor(typeColor)}; margin-top: 2px; font-weight: 600;">${escapeHtml(typeLabel)}</div>
        ${confidence ? `<div style="font-size: 11px; margin-top: 4px;"><span style="background: ${sanitizeColor(confColor)}22; color: ${sanitizeColor(confColor)}; padding: 1px 6px; border-radius: 3px; font-weight: 600;">${escapeHtml(confidence)}</span></div>` : ''}
        ${maxRange ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Range: <strong>${escapeHtml(maxRange)}</strong>${rangeBasis ? ` — ${escapeHtml(rangeBasis)}` : ''}</div>` : ''}
        ${bearing ? `<div style="font-size: 11px; color: #94a3b8;">Bearing: <strong>${escapeHtml(bearing)} ${escapeHtml(bearingCardinal)}</strong>${bearingBasis ? ` — ${escapeHtml(bearingBasis)}` : ''}</div>` : ''}
        ${sectorWidth ? `<div style="font-size: 11px; color: #94a3b8;">Sector: ${escapeHtml(sectorWidth)} cone</div>` : ''}
      </div>
    `

    popupRef.current?.remove()
    popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map)
  })

  // Click popup for impact points — rich detail
  map.on('click', impactId, (e) => {
    const feature = e.features?.[0]
    if (!feature || feature.geometry.type !== 'Point') return

    const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number]
    const props = feature.properties ?? {}
    const name = String(props.name ?? props.poo_name ?? 'Impact Point')
    const description = props.description ? String(props.description) : ''
    const confidence = props.confidence ? String(props.confidence) : ''
    const confColor = CONFIDENCE_POPUP_COLORS[confidence] ?? '#94a3b8'
    const maxRange = props.max_range_km ? `${props.max_range_km}km` : ''
    const minRange = props.min_range_km ? `${props.min_range_km}km` : ''
    const bearing = props.approach_bearing != null ? `${props.approach_bearing}°` : ''
    const bearingCardinal = props.bearing_cardinal ? String(props.bearing_cardinal) : ''
    const sectorWidth = props.sector_width_deg ? `${props.sector_width_deg}°` : ''
    const rangeBasis = props.range_basis ? String(props.range_basis) : ''
    const bearingBasis = props.bearing_basis ? String(props.bearing_basis) : ''

    const html = `
      <div style="max-width: 300px; font-family: system-ui, sans-serif; line-height: 1.5;">
        <strong style="font-size: 14px; color: #e2e8f0;">${escapeHtml(name)}</strong>
        <div style="font-size: 11px; color: ${sanitizeColor(color)}; margin-top: 2px;">POO Impact Point</div>
        ${confidence ? `<div style="font-size: 11px; margin-top: 4px;"><span style="background: ${sanitizeColor(confColor)}22; color: ${sanitizeColor(confColor)}; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${escapeHtml(confidence)}</span></div>` : ''}
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(148,163,184,0.2);">
          ${maxRange ? `<div style="font-size: 11px; color: #cbd5e1;">Max Range: <strong>${escapeHtml(maxRange)}</strong>${rangeBasis ? ` <span style="color: #64748b;">(${escapeHtml(rangeBasis)})</span>` : ''}</div>` : ''}
          ${minRange ? `<div style="font-size: 11px; color: #cbd5e1;">Min Range: <strong>${escapeHtml(minRange)}</strong></div>` : ''}
          ${bearing ? `<div style="font-size: 11px; color: #cbd5e1;">Approach: <strong>${escapeHtml(bearing)} ${escapeHtml(bearingCardinal)}</strong>${bearingBasis ? ` <span style="color: #64748b;">(${escapeHtml(bearingBasis)})</span>` : ''}</div>` : ''}
          ${sectorWidth ? `<div style="font-size: 11px; color: #cbd5e1;">Sector: <strong>${escapeHtml(sectorWidth)} cone</strong></div>` : ''}
        </div>
        ${description ? `<div style="font-size: 11px; color: #64748b; margin-top: 6px; padding-top: 4px; border-top: 1px solid rgba(148,163,184,0.15);">${escapeHtml(description.length > 200 ? description.slice(0, 200) + '...' : description)}</div>` : ''}
        <div style="font-size: 10px; color: #475569; margin-top: 4px;">${coords[1].toFixed(6)}°N, ${coords[0].toFixed(6)}°E</div>
      </div>
    `

    while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
      coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
    }

    popupRef.current?.remove()
    popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map)
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
