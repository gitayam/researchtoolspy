import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TimelineWorkspaceExport } from '@/types/timeline-workspace'
import { DurableTimelineError, openSavedTimeline, parseSavedTimelineLink, prepareTimelineSave, saveTimelineAttempt, savedTimelineLink, snapshotIdentity, type DurableDocument, type SaveAttempt } from '@/lib/timeline-durable'

interface Props {
  snapshot: TimelineWorkspaceExport | null
  onOpen: (snapshot: TimelineWorkspaceExport) => void
  onForgetRemote: () => void
}
function humanHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  try {
    const hash = localStorage.getItem('omnicore_user_hash')
    if (hash) headers['X-User-Hash'] = hash
    const token = JSON.parse(localStorage.getItem('omnicore_tokens') || 'null')?.access_token
    if (typeof token === 'string' && token) headers.Authorization = `Bearer ${token}`
  } catch { /* Missing/malformed credentials fail closed in the client/API. */ }
  return headers
}
export function TimelineDurablePanel(props: Props) {
  const user = useAuthStore(state => state.user)
  const signedIn = useAuthStore(state => state.isAuthenticated)
  const { workspaces, currentWorkspaceId } = useWorkspace()
  const available = workspaces.filter(w => w.id !== '1' && !w.is_public && (w.owner_id === user?.id || ['VIEWER', 'EDITOR', 'ADMIN'].includes(w.role || '')))
  const linkedWorkspace = new URLSearchParams(window.location.search).get('workspace')
  const [choice, setChoice] = useState(linkedWorkspace || currentWorkspaceId)
  const selected = available.find(w => w.id === choice)
  const role = (user?.role || '').trim().toLowerCase()
  const eligible = signedIn && Boolean(user) && (user?.is_active === undefined || user?.is_active === true || Number(user?.is_active) === 1) && Boolean(role) && !['guest', 'service'].includes(role)
  const scope = `${eligible ? user?.id : 'guest'}:${selected?.id || ''}`
  useEffect(() => () => props.onForgetRemote(), [scope, props.onForgetRemote])
  if (!eligible || !user) return <section aria-label="Workspace saving" className="rounded-lg border p-4 text-sm">Sign in to save complete timelines to a private workspace. Local drafts and JSON export remain available.</section>
  return <section aria-label="Workspace saving" className="space-y-3 rounded-lg border p-4">
    <h2 className="font-semibold">Save to a private workspace</h2>
    <Label htmlFor="timeline-save-workspace">Saving workspace</Label>
    <select id="timeline-save-workspace" className="w-full rounded-md border bg-background p-2" value={selected?.id || ''} onChange={event => setChoice(event.target.value)}>
      <option value="">Choose a private workspace</option>
      {available.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select>
    {!available.length && <p className="text-sm text-muted-foreground">Create or join a private workspace before saving. You can keep working locally.</p>}
    {selected && <WorkspaceSaving key={scope} {...props} workspaceId={selected.id} principalId={user.id} canWrite={selected.owner_id === user.id || ['EDITOR', 'ADMIN'].includes(selected.role || '')} />}
  </section>
}
function WorkspaceSaving({ snapshot, onOpen, workspaceId, principalId, canWrite }: Props & { workspaceId: string; principalId: number; canWrite: boolean }) {
  const [artifact, setArtifact] = useState<DurableDocument | undefined>()
  const [savedIdentity, setSavedIdentity] = useState('')
  const [pending, setPending] = useState<SaveAttempt | null>(null)
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [message, setMessage] = useState('')
  const [linkInput, setLinkInput] = useState(() => new URLSearchParams(window.location.search).has('saved') ? window.location.href : '')
  const controller = useRef<AbortController | null>(null)
  const currentIdentity = snapshot ? snapshotIdentity(snapshot) : ''
  const dirty = Boolean(snapshot && currentIdentity !== savedIdentity)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (pending || (artifact && dirty)) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pending, artifact, dirty])
  const save = async (copy = false) => {
    if (!snapshot || busy || !canWrite) return
    let attempt: SaveAttempt
    try { attempt = pending || prepareTimelineSave(snapshot, copy ? undefined : artifact) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to prepare this save.'); return }
    setPending(attempt); setBusy(true); setMessage('Saving the complete timeline…')
    const abort = new AbortController(); controller.current = abort
    try {
      const saved = await saveTimelineAttempt(attempt, { principalId, workspaceId, headers: humanHeaders() }, abort.signal)
      if (abort.signal.aborted) return
      setArtifact(saved); setSavedIdentity(snapshotIdentity(attempt.snapshot)); setPending(null); setConflict(false)
      const link = savedTimelineLink(saved)
      setLinkInput(link)
      window.history.replaceState(window.history.state, '', link)
      setMessage('Saved to your private workspace. Keep the saved link to reopen it on another device.')
    } catch (error) {
      if (abort.signal.aborted) return
      if (error instanceof DurableTimelineError && [409, 412].includes(error.status)) { setConflict(true); setPending(null) }
      setMessage(error instanceof DurableTimelineError ? error.message : 'The save response was lost or unreadable. Retry the previous save to recover its result. Your edits are still open.')
    } finally { if (!abort.signal.aborted) setBusy(false) }
  }
  const open = async () => {
    if (busy) return
    try {
      const target = parseSavedTimelineLink(linkInput)
      if (target.workspaceId && target.workspaceId !== workspaceId) throw new DurableTimelineError('Choose the private workspace named in the saved link before opening it.')
      if (snapshot && !window.confirm('Replace the open timeline with its saved version? Export JSON first if you need to keep your current work.')) return
      const abort = new AbortController(); controller.current = abort
      setBusy(true); setMessage('Opening the saved timeline…')
      try {
        const loaded = await openSavedTimeline(target.artifactId, { principalId, workspaceId, headers: humanHeaders() }, abort.signal)
        if (abort.signal.aborted) return
        onOpen(loaded.snapshot)
        setArtifact(loaded.artifact); setSavedIdentity(snapshotIdentity(loaded.snapshot)); setPending(null); setConflict(false)
        const link = savedTimelineLink(loaded.artifact); setLinkInput(link)
        window.history.replaceState(window.history.state, '', link)
        setMessage('Opened the saved timeline. Changes are saved only when you choose Save changes.')
      } finally { if (!abort.signal.aborted) setBusy(false) }
    } catch (error) { if (!controller.current?.signal.aborted) setMessage(error instanceof Error ? error.message : 'Unable to open this timeline. Your current timeline is unchanged.') }
  }
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Saves include the narrative, notes, source extraction and event IDs. Each save supports up to 60 KiB. Opened private timelines are kept in memory; export JSON to keep an offline copy.</p>
    <div className="flex flex-wrap gap-2">
      <Button disabled={!snapshot || !canWrite || busy || conflict || Boolean(artifact && !dirty && !pending)} onClick={() => void save()}>{pending ? 'Retry previous save' : artifact ? 'Save changes' : 'Save timeline'}</Button>
      {artifact && !pending && <Button variant="outline" disabled={!snapshot || !canWrite || busy} onClick={() => void save(true)}>Save a separate copy</Button>}
      {artifact && <span className="self-center text-sm" data-testid="timeline-save-state">{dirty ? 'Unsaved changes' : 'Saved'}</span>}
    </div>
    {!canWrite && <p className="text-sm">You have read-only access to this workspace.</p>}
    <div className="space-y-2">
      <Label htmlFor="timeline-saved-link">Saved timeline link</Label>
      <Input id="timeline-saved-link" value={linkInput} onChange={event => setLinkInput(event.target.value)} placeholder="Paste a saved timeline link" />
      <Button variant="outline" disabled={busy || Boolean(pending) || !linkInput.trim()} onClick={() => void open()}>Open saved timeline</Button>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>
}
