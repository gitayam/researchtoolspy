/**
 * CopPersonaLinkDialog -- Dialog for linking two personas together.
 *
 * Select two personas, choose a link type, set confidence, and submit.
 */

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// ── Local types (TODO: import from @/types/cop when backend merges types) ─

interface CopPersona {
  id: string
  display_name: string
  platform: string
  handle: string | null
}

type LinkType = 'alias' | 'operator' | 'affiliated' | 'unknown'

// ── Props ────────────────────────────────────────────────────────

interface CopPersonaLinkDialogProps {
  sessionId: string
  personas: CopPersona[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onLinked?: () => void
}

// ── Helpers ──────────────────────────────────────────────────────


const LINK_TYPES: { value: LinkType; label: string; description: string }[] = [
  { value: 'alias', label: 'Alias', description: 'Same person, different handle' },
  { value: 'operator', label: 'Operator', description: 'One controls the other' },
  { value: 'affiliated', label: 'Affiliated', description: 'Related but separate identities' },
  { value: 'unknown', label: 'Unknown', description: 'Link exists but type unclear' },
]

// ── Component ────────────────────────────────────────────────────

export default function CopPersonaLinkDialog({
  sessionId,
  personas,
  open,
  onOpenChange,
  onLinked,
}: CopPersonaLinkDialogProps) {
  const [personaA, setPersonaA] = useState('')
  const [personaB, setPersonaB] = useState('')
  const [linkType, setLinkType] = useState<LinkType>('alias')
  const [confidence, setConfidence] = useState(50)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setPersonaA('')
      setPersonaB('')
      setLinkType('alias')
      setConfidence(50)
      setError(null)
    }
  }, [open])

  const canSubmit = personaA && personaB && personaA !== personaB && !submitting

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/cop/${sessionId}/personas/link`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          persona_a_id: personaA,
          persona_b_id: personaB,
          link_type: linkType,
          confidence,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error ?? `Failed (${res.status})`)
      }

      onLinked?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link personas')
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, sessionId, personaA, personaB, linkType, confidence, onLinked, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md dark:bg-gray-900 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-200">
            <Link2 className="h-4 w-4 text-purple-400" />
            Link Personas
          </DialogTitle>
          <DialogDescription>
            Create a relationship between two tracked personas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Persona A */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Persona A</label>
            <select
              value={personaA}
              onChange={(e) => setPersonaA(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">Select persona...</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === personaB}>
                  {p.display_name} {p.handle ? `(@${p.handle})` : ''} - {p.platform}
                </option>
              ))}
            </select>
          </div>

          {/* Persona B */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Persona B</label>
            <select
              value={personaB}
              onChange={(e) => setPersonaB(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">Select persona...</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === personaA}>
                  {p.display_name} {p.handle ? `(@${p.handle})` : ''} - {p.platform}
                </option>
              ))}
            </select>
          </div>

          {/* Link type */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Link Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {LINK_TYPES.map((lt) => (
                <button
                  key={lt.value}
                  type="button"
                  onClick={() => setLinkType(lt.value)}
                  className={`rounded border px-2 py-1.5 text-left transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    linkType === lt.value
                      ? 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                      : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
                  }`}
                >
                  <span className="text-xs font-medium block">{lt.label}</span>
                  <span className="text-[10px] text-gray-500 block">{lt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Confidence slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Confidence</label>
              <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{confidence}%</span>
            </div>
            <Slider
              value={[confidence]}
              onValueChange={(v) => setConfidence(v[0])}
              min={0}
              max={100}
              step={5}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-purple-600 hover:bg-purple-700 cursor-pointer"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Link Personas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
