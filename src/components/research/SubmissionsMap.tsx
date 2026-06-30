/**
 * SubmissionsMap — MapLibre GL map tab for the reviewer (E-9b).
 *
 * Renders geolocated submissions as clustered circle markers on a dark basemap.
 * Clicking a marker opens a popup with the submission label and an OSM link.
 *
 * Uses the same `maplibre-gl` version already in the bundle (no new dep).
 */

import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapPin } from 'lucide-react'
import type { GeoSearchableSubmission, GeoPoint } from '@/lib/submission-geo'
import { filterGeoSubmissions } from '@/lib/submission-geo'

export interface SubmissionsMapProps {
  /** All loaded submissions (the map will extract the geolocated ones). */
  submissions: GeoSearchableSubmission[]
}

// ── Color for submission pins ─────────────────────────────────────────────────
const PIN_COLOR = '#8b5cf6'

// ── OSM deep-link helper ──────────────────────────────────────────────────────
function osmUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`
}

// ── Escape for HTML popup content ─────────────────────────────────────────────
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Convert geo submissions to GeoJSON ────────────────────────────────────────
function toGeoJSON(
  items: Array<{ submission: GeoSearchableSubmission; point: GeoPoint }>,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: items.map(({ point }) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [point.lng, point.lat],
      },
      properties: {
        label: point.label,
        lat: point.lat,
        lng: point.lng,
      },
    })),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubmissionsMap({ submissions }: SubmissionsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  const geoItems = filterGeoSubmissions(submissions)
  const geojson = toGeoJSON(geoItems)

  // ── Initialize map ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let map: maplibregl.Map | null = null
    let ro: ResizeObserver | null = null

    function initMap() {
      if (map || !el) return
      if (el.clientWidth === 0 || el.clientHeight === 0) return

      try {
        map = new maplibregl.Map({
          container: el,
          style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
          center: [0, 20],
          zoom: 1.5,
        })

        map.addControl(new maplibregl.NavigationControl(), 'top-right')

        map.on('load', () => {
          if (!map) return

          map.addSource('submissions', {
            type: 'geojson',
            data: geojson,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50,
          })

          // Cluster circles
          map.addLayer({
            id: 'sub-clusters',
            type: 'circle',
            source: 'submissions',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': PIN_COLOR,
              'circle-opacity': 0.85,
              'circle-radius': [
                'step', ['get', 'point_count'],
                14, 5, 18, 20, 22,
              ],
            },
          })

          // Cluster count labels
          map.addLayer({
            id: 'sub-cluster-count',
            type: 'symbol',
            source: 'submissions',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': '{point_count_abbreviated}',
              'text-size': 11,
            },
            paint: { 'text-color': '#ffffff' },
          })

          // Individual pins
          map.addLayer({
            id: 'sub-pins',
            type: 'circle',
            source: 'submissions',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': PIN_COLOR,
              'circle-radius': 8,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          })

          // Hover cursors
          for (const layerId of ['sub-clusters', 'sub-pins']) {
            map.on('mouseenter', layerId, () => { map!.getCanvas().style.cursor = 'pointer' })
            map.on('mouseleave', layerId, () => { map!.getCanvas().style.cursor = '' })
          }

          // Popup on individual pin click
          map.on('click', 'sub-pins', (e) => {
            const feature = e.features?.[0]
            if (!feature || feature.geometry.type !== 'Point') return

            const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number]
            const props = feature.properties ?? {}
            const label = String(props.label ?? '')
            const lat = Number(props.lat)
            const lng = Number(props.lng)

            while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
              coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
            }

            const html = `
              <div style="max-width:260px;font-family:system-ui,sans-serif;line-height:1.4;">
                <strong style="font-size:13px;color:#e2e8f0;">${escapeHtml(label)}</strong>
                <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                <a href="${osmUrl(lat, lng)}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-block;margin-top:6px;font-size:11px;color:#8b5cf6;text-decoration:underline;">
                  View on OpenStreetMap
                </a>
              </div>`

            popupRef.current?.remove()
            popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
              .setLngLat(coords)
              .setHTML(html)
              .addTo(map!)
          })

          // Zoom in on cluster click
          map.on('click', 'sub-clusters', (e) => {
            const feature = e.features?.[0]
            if (!feature || feature.geometry.type !== 'Point') return
            const src = map!.getSource('submissions') as maplibregl.GeoJSONSource
            const clusterId = feature.properties?.cluster_id as number | undefined
            if (clusterId == null) return
            src.getClusterExpansionZoom(clusterId).then((zoom) => {
              map!.easeTo({
                center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
                zoom,
              })
            })
          })

          // Auto-fit to data if any pins exist
          if (geoItems.length > 0) {
            const bounds = new maplibregl.LngLatBounds()
            for (const { point } of geoItems) {
              bounds.extend([point.lng, point.lat])
            }
            map.fitBounds(bounds, { padding: 60, maxZoom: 12, animate: false })
          }
        })

        mapRef.current = map
      } catch (err) {
        console.warn('[SubmissionsMap] Failed to initialize map:', err)
        setMapError('Map could not be loaded')
      }
    }

    ro = new ResizeObserver(() => {
      if (!map) { initMap() } else { map.resize() }
    })
    ro.observe(el)
    initMap()

    return () => {
      ro?.disconnect()
      popupRef.current?.remove()
      popupRef.current = null
      if (map) { map.remove(); map = null }
      mapRef.current = null
    }
    // Intentionally run once — data updates handled in the layer-sync effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync data when submissions change ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyData = () => {
      const src = map.getSource('submissions') as maplibregl.GeoJSONSource | undefined
      if (src) src.setData(geojson)
    }

    if (map.isStyleLoaded()) {
      applyData()
    } else {
      let cancelled = false
      map.once('load', () => { if (!cancelled) applyData() })
      return () => { cancelled = true }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions])

  // ── Empty state ────────────────────────────────────────────────────────────
  if (geoItems.length === 0) {
    return (
      <div
        data-testid="submissions-map-empty"
        className="flex flex-col items-center justify-center py-20 text-center px-4"
      >
        <MapPin className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
          No submissions with location data yet
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
          Add a <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">latitude</code> /
          <code className="ml-1 px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">longitude</code> field
          to your form to see submissions plotted here.
        </p>
      </div>
    )
  }

  if (mapError) {
    return (
      <div
        data-testid="submissions-map-error"
        className="flex items-center justify-center py-20 text-sm text-gray-500 dark:text-gray-400"
      >
        {mapError}
      </div>
    )
  }

  return (
    <div data-testid="submissions-map-container" className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Pin count badge */}
      <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
        {geoItems.length} geolocated submission{geoItems.length !== 1 ? 's' : ''}
      </div>
      <div
        ref={containerRef}
        data-testid="submissions-map"
        style={{ width: '100%', height: '520px' }}
      />
    </div>
  )
}
