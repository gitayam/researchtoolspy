import { useState, useEffect, useCallback } from 'react'
import { Download, Loader2, FileDown, Clock, CheckCircle, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { getCopHeaders } from '@/lib/cop-auth'
import type { ExportFormat, ExportScope, CopExport } from '@/types/cop'
import { EXPORT_FORMAT_CONFIG } from '@/types/cop'

// ── Props ──────────────────────────────────────────────────────

interface CopExportDialogProps {
  sessionId: string
  sessionName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Scope options ──────────────────────────────────────────────

const SCOPE_OPTIONS: { value: ExportScope; label: string; description: string }[] = [
  { value: 'full', label: 'Full Export', description: 'All layers, entities, evidence, and tasks' },
  { value: 'layers', label: 'Map Layers Only', description: 'Places, events, actors, and markers' },
  { value: 'entities', label: 'Entities Only', description: 'Actors, events, places, and relationships' },
  { value: 'evidence', label: 'Evidence Only', description: 'Evidence items and tags' },
  { value: 'tasks', label: 'Tasks Only', description: 'Task board items' },
]

// ── Format icon colors ─────────────────────────────────────────

const FORMAT_COLORS: Record<ExportFormat, string> = {
  geojson: 'text-green-400',
  kml: 'text-blue-400',
  cot: 'text-orange-400',
  stix: 'text-purple-400',
  csv: 'text-gray-400',
}

// ── Component ──────────────────────────────────────────────────

export default function CopExportDialog({
  sessionId,
  sessionName,
  open,
  onOpenChange,
}: CopExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('geojson')
  const [scope, setScope] = useState<ExportScope>('full')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [pastExports, setPastExports] = useState<CopExport[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // ── Fetch past exports ────────────────────────────────────

  const fetchPastExports = useCallback(async (signal?: AbortSignal) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/exports?limit=10`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) throw new Error('Failed to fetch export history')
      const data = await res.json()
      setPastExports(data.exports ?? [])
    } catch (e: any) {
      if (e?.name === 'AbortError') return
    } finally {
      setLoadingHistory(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetchPastExports(controller.signal)
    return () => controller.abort()
  }, [open, fetchPastExports])

  // ── Trigger export ────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true)
    setExportError('')

    try {
      const res = await fetch(`/api/cop/${sessionId}/export`, {
        method: 'POST',
        headers: {
          ...getCopHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format, scope }),
      })

      if (!res.ok) {
        const data = await res.json().catch((e) => { console.error('[CopExportDialog] JSON parse error:', e); return {} })
        throw new Error(data.error || `Export failed (${res.status})`)
      }

      // Trigger browser download from the response blob
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="(.+?)"/)
      const config = EXPORT_FORMAT_CONFIG[format]
      const filename = filenameMatch?.[1] || `${sessionName}${config.ext}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Refresh history
      await fetchPastExports()
    } catch (err: any) {
      setExportError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  // ── Status badge ──────────────────────────────────────────

  function statusBadge(status: string) {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Done</Badge>
      case 'failed':
        return <Badge variant="outline" className="text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'generating':
        return <Badge variant="outline" className="text-yellow-400 border-yellow-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>
      default:
        return <Badge variant="outline" className="text-gray-400 border-gray-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export COP Data
          </DialogTitle>
          <DialogDescription>
            Export &ldquo;{sessionName}&rdquo; in your preferred format.
          </DialogDescription>
        </DialogHeader>

        {/* Format Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Format</label>
          <RadioGroup
            value={format}
            onValueChange={(v) => setFormat(v as ExportFormat)}
            className="grid gap-2"
          >
            {(Object.entries(EXPORT_FORMAT_CONFIG) as [ExportFormat, typeof EXPORT_FORMAT_CONFIG[ExportFormat]][]).map(
              ([key, config]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-md border border-border/50 p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[data-state=checked]:border-primary/50 has-[data-state=checked]:bg-primary/5"
                >
                  <RadioGroupItem value={key} id={`format-${key}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileDown className={`w-4 h-4 ${FORMAT_COLORS[key]}`} />
                      <span className="font-medium text-sm">{config.label}</span>
                      <span className="text-xs text-muted-foreground">{config.ext}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                  </div>
                </label>
              )
            )}
          </RadioGroup>
        </div>

        {/* Scope Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Scope</label>
          <RadioGroup
            value={scope}
            onValueChange={(v) => setScope(v as ExportScope)}
            className="grid grid-cols-2 gap-2"
          >
            {SCOPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-2 rounded-md border border-border/50 p-2 cursor-pointer hover:bg-muted/50 transition-colors has-[data-state=checked]:border-primary/50 has-[data-state=checked]:bg-primary/5"
              >
                <RadioGroupItem value={opt.value} id={`scope-${opt.value}`} className="mt-0.5" />
                <div>
                  <span className="text-sm font-medium">{opt.label}</span>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Error */}
        {exportError && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {exportError}
          </div>
        )}

        {/* Past Exports */}
        {pastExports.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Recent Exports</label>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {pastExports.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between text-xs p-2 rounded bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">{exp.format.toUpperCase()}</span>
                    <span className="text-muted-foreground">{exp.scope}</span>
                    {exp.file_size_bytes && (
                      <span className="text-muted-foreground">
                        {(exp.file_size_bytes / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(exp.status)}
                    <span className="text-muted-foreground">
                      {new Date(exp.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
