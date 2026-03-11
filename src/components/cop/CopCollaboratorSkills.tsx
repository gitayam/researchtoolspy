import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save, Wrench, Clock, Wifi, WifiOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ──────────────────────────────────────────────────────

interface Collaborator {
  id: string
  email?: string
  user_id?: string
  role: 'viewer' | 'editor'
  skills: string
  max_concurrent: number
  timezone: string | null
  availability: string
}

interface CopCollaboratorSkillsProps {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Constants ──────────────────────────────────────────────────

const SKILL_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'osint', label: 'OSINT' },
  { value: 'pimeyes', label: 'PimEyes' },
  { value: 'geoguessr', label: 'GeoGuessr' },
  { value: 'forensic', label: 'Forensic' },
  { value: 'reverse_image', label: 'Reverse Image' },
  { value: 'social_media', label: 'Social Media' },
]

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available', icon: Wifi, color: 'text-green-400' },
  { value: 'busy', label: 'Busy', icon: Clock, color: 'text-yellow-400' },
  { value: 'offline', label: 'Offline', icon: WifiOff, color: 'text-gray-500' },
]

const TIMEZONE_OPTIONS = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland',
]

// ── Component ──────────────────────────────────────────────────

export default function CopCollaboratorSkills({
  sessionId,
  open,
  onOpenChange,
}: CopCollaboratorSkillsProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<Collaborator>>>({})

  // ── Fetch collaborators ────────────────────────────────────

  const fetchCollaborators = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/collaborators`, {
        headers: getCopHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setCollaborators(data.collaborators ?? [])
      setLocalEdits({})
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (open) fetchCollaborators()
  }, [open, fetchCollaborators])

  // ── Get editable values ────────────────────────────────────

  const getSkills = (c: Collaborator): string[] => {
    const edit = localEdits[c.id]
    const raw = edit?.skills ?? c.skills ?? '[]'
    try { return JSON.parse(raw) } catch { return [] }
  }

  const getMaxConcurrent = (c: Collaborator): number => {
    return localEdits[c.id]?.max_concurrent ?? c.max_concurrent ?? 5
  }

  const getAvailability = (c: Collaborator): string => {
    return localEdits[c.id]?.availability ?? c.availability ?? 'available'
  }

  const getTimezone = (c: Collaborator): string => {
    return localEdits[c.id]?.timezone ?? c.timezone ?? ''
  }

  // ── Update local edits ─────────────────────────────────────

  const updateLocal = (id: string, field: string, value: unknown) => {
    setLocalEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const toggleSkill = (c: Collaborator, skill: string) => {
    const current = getSkills(c)
    const updated = current.includes(skill)
      ? current.filter(s => s !== skill)
      : [...current, skill]
    updateLocal(c.id, 'skills', JSON.stringify(updated))
  }

  // ── Save collaborator skills ───────────────────────────────

  const handleSave = useCallback(async (collaborator: Collaborator) => {
    const edits = localEdits[collaborator.id]
    if (!edits) return

    setSaving(collaborator.id)
    try {
      const res = await fetch(`/api/cop/${sessionId}/collaborators`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({
          collaborator_id: collaborator.id,
          ...edits,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')

      // Clear edits for this collaborator and refresh
      setLocalEdits(prev => {
        const updated = { ...prev }
        delete updated[collaborator.id]
        return updated
      })
      await fetchCollaborators()
    } catch {
      // ignore
    } finally {
      setSaving(null)
    }
  }, [sessionId, localEdits, fetchCollaborators])

  // ── Render ─────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 text-gray-200 sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-100 flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Collaborator Skills & Availability
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure skills, workload limits, and availability for auto-assignment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
              <span className="text-xs text-gray-500">Loading collaborators...</span>
            </div>
          ) : collaborators.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-4 text-center">
              No collaborators yet. Invite someone first.
            </p>
          ) : (
            collaborators.map(c => {
              const skills = getSkills(c)
              const hasEdits = !!localEdits[c.id]
              const isSaving = saving === c.id

              return (
                <div
                  key={c.id}
                  className="rounded border border-gray-700 bg-gray-800/40 p-3 space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {c.email ?? `User ${c.user_id}`}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase">{c.role}</p>
                    </div>
                    {hasEdits && (
                      <Button
                        size="sm"
                        onClick={() => handleSave(c)}
                        disabled={isSaving}
                        className="h-7 text-xs px-3"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Skills */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide block mb-1.5">
                      Skills
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {SKILL_OPTIONS.map(opt => {
                        const active = skills.includes(opt.value)
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleSkill(c, opt.value)}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded border cursor-pointer transition-colors duration-200 ${
                              active
                                ? 'border-blue-500/50 bg-blue-500/20 text-blue-400'
                                : 'border-gray-600 text-gray-500 hover:border-gray-500 hover:text-gray-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Max concurrent */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide block mb-1.5">
                      Max Concurrent Tasks: {getMaxConcurrent(c)}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={getMaxConcurrent(c)}
                      onChange={e => updateLocal(c.id, 'max_concurrent', parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                      <span>1</span>
                      <span>10</span>
                      <span>20</span>
                    </div>
                  </div>

                  {/* Availability */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide block mb-1.5">
                      Availability
                    </label>
                    <div className="flex gap-2">
                      {AVAILABILITY_OPTIONS.map(opt => {
                        const Icon = opt.icon
                        const active = getAvailability(c) === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateLocal(c.id, 'availability', opt.value)}
                            className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded border cursor-pointer transition-colors duration-200 ${
                              active
                                ? `border-current ${opt.color} bg-current/10`
                                : 'border-gray-600 text-gray-500 hover:border-gray-500'
                            }`}
                          >
                            <Icon className="h-3 w-3" />
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Timezone */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide block mb-1.5">
                      Timezone
                    </label>
                    <select
                      value={getTimezone(c)}
                      onChange={e => updateLocal(c.id, 'timezone', e.target.value || null)}
                      className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Not set</option>
                      {TIMEZONE_OPTIONS.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
