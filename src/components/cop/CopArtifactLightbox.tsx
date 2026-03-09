/**
 * CopArtifactLightbox -- Full-screen image viewer for evidence artifacts.
 *
 * Shows the image large with a side panel for tags, personas, and a "Pin to Map" action.
 * Keyboard navigable: Escape to close, arrow keys for prev/next.
 * Includes Zoom/Pan and OSINT Taxonomy tagging.
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { X, MapPin, ChevronLeft, ChevronRight, ExternalLink, Tag, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import CopTagSelector from '@/components/cop/CopTagSelector'

// ── Types ────────────────────────────────────────────────────────

interface FeedItem {
  id: string
  type: string
  title: string
  description?: string
  url?: string
  created_at: string
}

interface CopArtifactLightboxProps {
  item: FeedItem
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPinToMap?: (item: FeedItem) => void
  onPrev?: () => void
  onNext?: () => void
  tags?: Array<{ tag_category: string; tag_value: string }>
  onTagUpdate?: () => void
}

// ── Helpers ──────────────────────────────────────────────────────

function isImageUrl(url?: string): boolean {
  if (!url) return false
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(url)
}

const CATEGORY_COLORS: Record<string, string> = {
  architecture: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  infrastructure: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  flora_fauna: 'bg-green-500/20 text-green-400 border-green-500/30',
  logos_brands: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  language_text: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  geography: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  transport: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  people_culture: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  custom: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// ── Component ────────────────────────────────────────────────────

export default function CopArtifactLightbox({
  item,
  sessionId,
  open,
  onOpenChange,
  onPinToMap,
  onPrev,
  onNext,
  tags = [],
  onTagUpdate,
}: CopArtifactLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [isMaximized, setIsMaximized] = useState(false)

  // Reset zoom on item change
  useEffect(() => {
    setZoom(1)
    setIsMaximized(false)
  }, [item.id])

  // Focus trap: focus the container on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => containerRef.current?.focus())
    }
  }, [open])

  // Prevent body scroll while open
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
      }
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault()
        onPrev()
      }
      if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault()
        onNext()
      }
      if (e.key === '=' || e.key === '+') {
        setZoom(prev => Math.min(prev + 0.25, 3))
      }
      if (e.key === '-') {
        setZoom(prev => Math.max(prev - 0.25, 0.5))
      }
      if (e.key === '0') {
        setZoom(1)
      }
    },
    [onOpenChange, onPrev, onNext],
  )

  if (!open) return null

  const imageUrl = item.url
  const hasImage = isImageUrl(imageUrl)

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[70] flex bg-black/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing artifact: ${item.title}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Top controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-gray-900/80 border-gray-700 text-gray-400">
            {hasImage ? 'Image Artifact' : 'Note'}
          </Badge>
          {tags.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {tags.slice(0, 3).map((t, i) => (
                <Badge key={i} variant="outline" className={cn("text-[9px] px-1.5 py-0", CATEGORY_COLORS[t.tag_category] ?? CATEGORY_COLORS.custom)}>
                  {t.tag_value}
                </Badge>
              ))}
              {tags.length > 3 && <span className="text-[10px] text-gray-500">+{tags.length - 3}</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasImage && (
            <div className="flex items-center bg-gray-900/80 border border-gray-700 rounded-md p-0.5">
              <button onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"><ZoomOut className="h-4 w-4" /></button>
              <span className="text-[10px] font-mono w-10 text-center text-gray-300">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"><ZoomIn className="h-4 w-4" /></button>
              <div className="w-px h-4 bg-gray-700 mx-1" />
              <button 
                onClick={() => {
                  if (zoom === 1) setIsMaximized(!isMaximized)
                  else { setZoom(1); setIsMaximized(false); }
                }} 
                className={cn("p-1 hover:bg-gray-800 rounded transition-colors cursor-pointer", isMaximized ? "text-blue-400" : "text-gray-400 hover:text-white")}
              >
                <Maximize className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-full bg-gray-800/80 text-gray-300 hover:text-white hover:bg-red-500/80 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="absolute right-80 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer hidden lg:block"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      )}

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center p-4 min-w-0 overflow-hidden">
        {hasImage ? (
          <div 
            className={cn(
              "transition-all duration-200 ease-out cursor-grab active:cursor-grabbing",
              isMaximized ? "w-full h-full" : "max-w-full max-h-full"
            )}
            style={{ 
              transform: `scale(${zoom})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={imageUrl}
              alt={item.title}
              className={cn(
                "rounded shadow-2xl",
                isMaximized ? "w-full h-full object-cover" : "max-w-full max-h-[90vh] object-contain"
              )}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="max-w-lg text-center space-y-4 bg-gray-900/50 p-10 rounded-xl border border-gray-800">
            <Tag className="h-10 w-10 text-gray-600 mx-auto opacity-50" />
            <div>
              <p className="text-xl font-semibold text-gray-100">{item.title}</p>
              {item.description && (
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">{item.description}</p>
              )}
            </div>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors font-medium text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                Explore Source
              </a>
            )}
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="w-72 lg:w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 hidden md:flex">
        {/* Title */}
        <div className="px-5 py-6 border-b border-gray-800 bg-gray-900/50">
          <h3 className="text-sm font-bold text-gray-100 leading-tight">{item.title}</h3>
          <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1.5 uppercase font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString()}
          </p>
        </div>

        {/* Visual Clue Tagging */}
        <div className="px-5 py-5 border-b border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Visual Clues
              </span>
            </div>
            <Badge variant="outline" className="text-[9px] border-blue-500/20 text-blue-400">OSINT Taxonomy</Badge>
          </div>
          
          <div className="bg-gray-800/30 rounded-lg p-2.5 border border-gray-800">
            <CopTagSelector 
              evidenceId={item.id}
              sessionId={sessionId}
              existingTags={tags}
              onTagAdded={onTagUpdate}
            />
          </div>
          
          <p className="text-[10px] text-gray-500 leading-tight">
            Tag specific artifacts like <span className="text-gray-400">Power Outlets</span>, <span className="text-gray-400">Street Signs</span>, or <span className="text-gray-400">Building Styles</span> to help cross-reference locations.
          </p>
        </div>

        {/* Notes */}
        {item.description && (
          <div className="px-5 py-5 border-b border-gray-800">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
              Context
            </span>
            <p className="text-[11px] text-gray-400 leading-relaxed italic border-l-2 border-gray-700 pl-3">
              {item.description}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex-1" />
        <div className="px-5 py-6 bg-gray-900/80 space-y-2.5">
          {onPinToMap && (
            <Button
              size="sm"
              onClick={() => onPinToMap(item)}
              className="w-full justify-center gap-2 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-tighter text-[11px]"
            >
              <MapPin className="h-4 w-4" />
              Pin to Geo Intel Map
            </Button>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md border border-gray-700 text-[11px] font-bold text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-all uppercase tracking-tighter"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Original source
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
