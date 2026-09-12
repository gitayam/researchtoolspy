import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type Auth = { headers: Record<string, string>; stamp: string }
type Candidate = { analysisId: number; title: string }
interface Props { workspaceId: string; context: string; disabled: boolean; identity: () => Auth | null; onSelect: (id: number) => void }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => record(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key))
async function candidates(response: Response, workspaceId: string): Promise<Candidate[]> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json') || !response.body) { void response.body?.cancel().catch(() => {}); throw new Error('The stored source list was unreadable.') }
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, text = ''
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 65536) throw new Error('The stored source list exceeded its limit.'); text += decoder.decode(part.value, { stream: true }) }
    const value: unknown = JSON.parse(text + decoder.decode())
    if (!exact(value, ['schemaVersion', 'workspaceId', 'items']) || value.schemaVersion !== 'timeline-source-candidates.v1' || value.workspaceId !== workspaceId || !Array.isArray(value.items) || value.items.length > 20) throw new Error('The stored source list did not match this workspace.')
    let previous = Number.MAX_SAFE_INTEGER + 1
    for (const item of value.items) {
      if (!exact(item, ['analysisId', 'title']) || !Number.isSafeInteger(item.analysisId) || Number(item.analysisId) <= 0 || Number(item.analysisId) >= previous || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 400 || /[\u0000-\u001f\u007f-\u009f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(item.title)) throw new Error('The stored source list was invalid.')
      previous = Number(item.analysisId)
    }
    return value.items as Candidate[]
  } catch (error) { void reader.cancel().catch(() => {}); throw error } finally { reader.releaseLock() }
}

export function TimelineSourcePicker(props: Props) {
  const [items, setItems] = useState<Candidate[]>([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const operation = useRef<AbortController | null>(null), version = useRef(0), loaded = useRef<{ context: string; stamp: string } | null>(null)
  const latest = useRef(props); latest.current = props
  function clear() { version.current++; operation.current?.abort(); operation.current = null; loaded.current = null; setItems([]); setMessage(''); setError(false); setBusy(false) }
  useEffect(() => { clear(); return () => { version.current++; operation.current?.abort() } }, [props.context, props.workspaceId, props.disabled])
  useEffect(() => { window.addEventListener('storage', clear); return () => window.removeEventListener('storage', clear) }, [])
  async function load() {
    clear()
    const auth = props.identity(), context = props.context, workspace = props.workspaceId, generation = version.current
    if (!auth || props.disabled || !workspace || workspace === '1') { setError(true); setMessage('Sign in and reopen a writable private timeline to list stored sources.'); return }
    const controller = new AbortController(); operation.current = controller; setBusy(true)
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    const current = () => !controller.signal.aborted && version.current === generation && latest.current.context === context && latest.current.workspaceId === workspace && !latest.current.disabled && latest.current.identity()?.stamp === auth.stamp
    try {
      const response = await fetch(`/api/timeline-source-candidates?workspaceId=${encodeURIComponent(workspace)}`, { credentials: 'same-origin', redirect: 'error', signal: controller.signal, headers: { ...auth.headers, 'X-Workspace-ID': workspace } })
      if (!response.ok) { void response.body?.cancel().catch(() => {}); throw new Error(response.status === 401 || response.status === 403 ? 'Sign in again before listing private sources.' : response.status === 404 ? 'This private workspace is no longer available for import.' : 'Stored sources could not be listed. Try again.') }
      const result = await candidates(response, workspace)
      if (!current()) return
      loaded.current = { context, stamp: auth.stamp }; setItems(result)
      setMessage(result.length ? 'Choose a source, then enter and check an exact quote.' : 'No recent complete stored sources are available in this workspace.')
    } catch (failure) {
      if (version.current === generation && latest.current.context === context) { setError(true); setMessage(controller.signal.aborted ? 'Source listing stopped. Try again.' : failure instanceof Error ? failure.message : 'Stored sources could not be listed.') }
    } finally { window.clearTimeout(timeout); if (operation.current === controller) { operation.current = null; setBusy(false) } }
  }
  function select(id: number) {
    if (props.disabled || loaded.current?.context !== props.context || loaded.current?.stamp !== props.identity()?.stamp) { clear(); return }
    clear(); props.onSelect(id)
  }
  return <div aria-label="Recent stored sources" role="region" className="space-y-2 rounded border p-3">
    <p className="text-sm">List up to 20 recent complete records you own in this workspace, newest stored ID first. Titles may be shortened. Listing does not verify extraction integrity.</p>
    <Button variant="outline" className="h-auto w-full whitespace-normal sm:w-auto" disabled={busy || props.disabled} onClick={() => void load()}>Load recent stored sources</Button>
    {items.length > 0 && <ul className="space-y-2">{items.map(item => <li key={item.analysisId}><Button variant="outline" className="h-auto w-full justify-start whitespace-normal text-left break-words" disabled={props.disabled} onClick={() => select(item.analysisId)}>Use analysis {item.analysisId}: {item.title}</Button></li>)}</ul>}
    {message && <p role={error ? 'alert' : 'status'}>{message}</p>}
  </div>
}
