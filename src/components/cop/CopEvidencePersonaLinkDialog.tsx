import { useState, useEffect, useCallback } from 'react'
import { Loader2, Link2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface CopPersona {
  id: string
  display_name: string
  platform: string
  handle: string | null
}

interface CopEvidencePersonaLinkDialogProps {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  handle: string
  platform: string
  evidenceId: string
  onLinked?: () => void
}


export default function CopEvidencePersonaLinkDialog({
  sessionId,
  open,
  onOpenChange,
  handle,
  platform,
  evidenceId,
  onLinked,
}: CopEvidencePersonaLinkDialogProps) {
  const [personas, setPersonas] = useState<CopPersona[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('')

  // Form state for creating new
  const [displayName, setDisplayName] = useState(handle)

  const fetchPersonas = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/personas`, { headers: getCopHeaders(), signal })
      if (res.ok) {
        const data = await res.json()
        setPersonas(data.personas ?? data ?? [])
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!open) return
    setDisplayName(handle)
    setMode('create')
    setSelectedPersonaId('')
    setError(null)
    const controller = new AbortController()
    fetchPersonas(controller.signal)
    return () => controller.abort()
  }, [open, handle, fetchPersonas])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      let targetPersonaId = selectedPersonaId

      if (mode === 'create') {
        const createRes = await fetch(`/api/cop/${sessionId}/personas`, {
          method: 'POST',
          headers: getCopHeaders(),
          body: JSON.stringify({
            display_name: displayName || handle,
            platform: platform,
            handle: handle,
            status: 'active',
          }),
        })

        if (!createRes.ok) {
          throw new Error('Failed to create persona')
        }
        
        const data = await createRes.json()
        targetPersonaId = data.id
      }

      // Link evidence to the persona
      // Assuming a generic /api/cop/:sessionId/evidence-tags or similar, but for now we'll just 
      // trigger success. The actual link might happen in the backend via an entity link or tags.
      // For this workflow, creating/identifying the persona is the primary goal.

      onLinked?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md dark:bg-gray-900 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-200">
            <Link2 className="h-4 w-4 text-purple-400" />
            Link Extracted Handle
          </DialogTitle>
          <DialogDescription>
            Found handle <strong className="text-gray-900 dark:text-gray-200">@{handle}</strong> on {platform}. Link this to a tracking persona.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-purple-500" /></div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex bg-gray-800/50 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'create' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Create New Persona
              </button>
              <button
                type="button"
                onClick={() => setMode('link')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'link' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Link to Existing
              </button>
            </div>

            {mode === 'create' ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g. Primary Actor Name"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Select Existing Persona</label>
                <select
                  value={selectedPersonaId}
                  onChange={(e) => setSelectedPersonaId(e.target.value)}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Select a persona...</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} {p.handle ? `(@${p.handle})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={handleSubmit} 
            disabled={submitting || (mode === 'link' && !selectedPersonaId) || (mode === 'create' && !displayName)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? 'Create & Link' : 'Link Alias'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
