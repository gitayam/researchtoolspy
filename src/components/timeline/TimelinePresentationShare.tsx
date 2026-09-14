import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { decodeTimelinePresentation, presentationPlainText } from '@/lib/timeline-presentation-contract'
import { listPresentations, preparePresentation, presentationLinkUrl, publishPresentation, revokePresentation, type ListedPresentation, type PresentationAttempt } from '@/lib/timeline-presentation-client'
import type { buildTimelineJSExport } from '@/lib/timeline-timelinejs'

type Props = { timeline: ReturnType<typeof buildTimelineJSExport>['timeline']; disabled: boolean }
export function TimelinePresentationShare(props: Props) {
  const user = useAuthStore(state => state.user), authenticated = useAuthStore(state => state.isAuthenticated)
  const role = user?.role?.trim().toLowerCase()
  const active = user?.is_active === undefined || user.is_active === true || Number(user.is_active) === 1
  const eligible = authenticated && !!user && active && !!role && !['guest', 'service'].includes(role)
  // Remounting discards in-memory publication state synchronously on identity,
  // eligibility or preview changes. No payload/key/link is persisted.
  return <ShareReview key={`${eligible ? user!.id : 'anonymous'}:${props.disabled}:${JSON.stringify(props.timeline)}`} {...props} eligible={eligible} />
}
function ShareReview({ timeline, disabled, eligible }: Props & { eligible: boolean }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(''), [error, setError] = useState(false)
  const [token, setToken] = useState(''), [links, setLinks] = useState<ListedPresentation[] | null>(null)
  const attempt = useRef<PresentationAttempt | null>(null), controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  let valid = true
  try { decodeTimelinePresentation({ schemaVersion: 'timeline-presentation.v1', timeline }) } catch { valid = false }
  const run = async (work: (signal: AbortSignal) => Promise<void>) => {
    if (busy || !eligible) return
    const abort = new AbortController(); controller.current = abort; setBusy(true); setMessage(''); setError(false)
    try { await work(abort.signal) } catch (cause) { if (!abort.signal.aborted) { setError(true); setMessage(cause instanceof Error ? cause.message : 'The request could not be confirmed.') } }
    finally { if (!abort.signal.aborted) setBusy(false) }
  }
  const publish = () => run(async signal => {
    if (disabled || !valid) throw new Error('Review a valid current presentation before publishing.')
    attempt.current ||= preparePresentation(timeline)
    const result = await publishPresentation(attempt.current, signal)
    if (signal.aborted) return
    setToken(result.token); setMessage('Presentation published. Anyone with the link can read it until revoked.')
  })
  const revoke = (value: string) => run(async signal => {
    await revokePresentation(value, signal)
    if (signal.aborted) return
    if (token === value) { setToken(''); attempt.current = null }
    setLinks(current => current?.filter(link => link.token !== value) ?? null)
    setMessage('Link revoked. Previously downloaded copies cannot be recalled.')
  })
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(presentationLinkUrl(value)); setError(false); setMessage('Link copied.') }
    catch { setError(false); setMessage('Copy is unavailable. Select the link text below and copy it.') }
  }
  return <section className="min-w-0 space-y-2 text-sm">
    <Button type="button" variant="outline" onClick={() => setOpen(value => !value)} aria-expanded={open}>Share presentation</Button>
    {open && <section aria-label="Share presentation review" className="max-h-[60dvh] min-w-0 max-w-xl space-y-3 overflow-y-auto rounded-lg border p-3">
      <h3 className="break-words font-semibold">{presentationPlainText(timeline.title.text.headline)}</h3>
      <p>{timeline.events.length} selected presentation events</p>
      <p>Anyone with the link can read everything in this frozen presentation, including framing, assessments and presentation schedules. The full workspace, evidence records, source and complete backup are excluded. Publish only what you intend to share.</p>
      <p>Revocation prevents future reads. Copies already downloaded cannot be recalled.</p>
      {!eligible && <p role="status">Sign in with an active account to publish or manage links.</p>}
      {(disabled || !valid) && <p role="alert">This preview is stale, empty, too large or invalid. Review the current presentation before publishing.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!eligible || disabled || !valid || busy || !!token} onClick={publish}>{attempt.current && !token ? 'Retry publication' : 'Publish presentation'}</Button>
        <Button type="button" variant="outline" disabled={!eligible || busy} onClick={() => run(async signal => { const result = await listPresentations(signal); if (!signal.aborted) setLinks(result) })}>Manage links</Button>
      </div>
      {message && <p role={error ? 'alert' : 'status'}>{message}</p>}
      {token && <div className="min-w-0 space-y-2">
        <label className="block">Presentation link<input aria-label="Presentation link" readOnly value={presentationLinkUrl(token)} onFocus={event => event.currentTarget.select()} className="mt-1 w-full min-w-0 rounded border bg-background p-2" /></label>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => copy(token)}>Copy link</Button><Button type="button" variant="outline" disabled={busy} onClick={() => revoke(token)}>Revoke link</Button></div>
      </div>}
      {links && <section aria-label="Your active presentation links"><h4 className="font-semibold">Your active links</h4>{!links.length && <p>No active links.</p>}<ul className="space-y-3">{links.map(link => <li key={link.token} className="min-w-0 space-y-1 rounded border p-2">
        <p className="break-words">{link.title}</p><p className="text-xs">Created {link.createdAt}</p>
        <input aria-label={`Link for ${link.title}`} readOnly value={presentationLinkUrl(link.token)} onFocus={event => event.currentTarget.select()} className="w-full min-w-0 rounded border bg-background p-2" />
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => copy(link.token)}>Copy link</Button><Button type="button" variant="outline" disabled={busy} onClick={() => revoke(link.token)}>Revoke link</Button></div>
      </li>)}</ul></section>}
    </section>}
  </section>
}
