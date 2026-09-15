import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { redeemTimelineHandoff, seedTimelineHandoffWorkspace, type SeededTimelineHandoff, type TimelineHandoffFailure } from '@/lib/timeline-handoff'
import type { TimelineWorkspaceExport } from '@/types/timeline-workspace'

const wording: Record<TimelineHandoffFailure, string> = {
  handoff_expired: 'This handoff link expired. Handoff links last 30 minutes.',
  handoff_already_redeemed: 'This link was already opened. Ask for a fresh handoff link.',
  handoff_revoked: 'This handoff link was withdrawn.',
  handoff_audience_denied: 'This link was prepared for a different account. Sign in as that account to open it.',
  handoff_not_found: 'This handoff link is not recognised.',
  authentication_required: 'Sign in to ResearchTools and open this link again. Nothing has been used.',
  human_identity_required: 'Handoff links open in a full ResearchTools account. A guest or service sign-in cannot open one.',
  datastore_unavailable: 'Try again in a moment — your link has not been used.',
  unreadable: 'The handed-off material could not be read, and nothing was added. Ask for a fresh handoff link.',
}
type Phase = { idle: true } | { busy: true } | { failure: TimelineHandoffFailure; originReturnUrl?: string } | { opened: SeededTimelineHandoff }
interface Props { token: string; onSeeded: (snapshot: TimelineWorkspaceExport) => void; onDismiss: () => void }

/** Redeems only on an explicit press: an automatic redemption would be spent by an unfurl or a prefetch. */
export function TimelineHandoffPanel({ token, onSeeded, onDismiss }: Props) {
  const user = useAuthStore(state => state.user)
  const signedIn = useAuthStore(state => state.isAuthenticated)
  const role = (user?.role || '').trim().toLowerCase()
  const eligible = signedIn && Boolean(user) && Boolean(role) && !['guest', 'service'].includes(role)
  const [phase, setPhase] = useState<Phase>({ idle: true })
  // `in` narrowing, not a discriminant: this project compiles with strict mode off.
  const busy = 'busy' in phase
  const redeem = async () => {
    setPhase({ busy: true })
    const result = await redeemTimelineHandoff(token)
    if (!('document' in result)) { setPhase({ failure: result.failure, ...(result.originReturnUrl !== undefined ? { originReturnUrl: result.originReturnUrl } : {}) }); return }
    try {
      const opened = seedTimelineHandoffWorkspace(result.document)
      onSeeded(opened.snapshot)
      setPhase({ opened })
    } catch { setPhase({ failure: 'unreadable' }) }
  }
  const origin = 'opened' in phase ? phase.opened.snapshot.analystWorkspace.evidence!.sources[0] : null
  const carried = 'opened' in phase ? phase.opened.snapshot.analystWorkspace : null
  return <section aria-label="Handed-off material" className="timeline-handoff min-w-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/40">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Link2 aria-hidden="true" className="h-4 w-4" />Material handed to this timeline</h2>
    {'opened' in phase && origin && carried ? <>
      <p className="text-sm">Opened {carried.events.length} {carried.events.length === 1 ? 'event' : 'events'} and {carried.evidence!.sources.length} {carried.evidence!.sources.length === 1 ? 'source' : 'sources'} into a local draft below. This link is now used and cannot be opened again. Nothing is stored in a workspace until you save it.</p>
      {(phase.opened.omitted.sources > 0 || phase.opened.omitted.assertions > 0) && <p className="text-sm">The originating page held more than a handoff carries: {phase.opened.omitted.sources} further sources and {phase.opened.omitted.assertions} further source-to-event links are not in this draft.</p>}
      <p className="text-sm">Came from <a className="font-medium underline underline-offset-4" href={origin.url} target="_blank" rel="noopener noreferrer">{origin.title}</a>. That link is recorded as a source in this timeline, so it survives every save.</p>
    </> : 'failure' in phase ? <Alert variant="destructive">
      <AlertDescription className="space-y-2">
        <p>{wording[phase.failure]}</p>
        {phase.originReturnUrl !== undefined && <p><a className="font-medium underline underline-offset-4" href={phase.originReturnUrl} target="_blank" rel="noopener noreferrer">Open the original story</a> and choose Continue in ResearchTools again.</p>}
      </AlertDescription>
    </Alert> : !eligible ? <p className="text-sm">Sign in to ResearchTools to open this material. Nothing has been opened yet, so the link is still unused — it expires 30 minutes after it was made.</p>
      : <>
        <p className="text-sm">Nothing has been opened yet. Opening uses this link once; it expires 30 minutes after it was made and cannot be reopened.</p>
        <Button type="button" className="min-h-11" disabled={busy} onClick={() => void redeem()}>{busy ? 'Opening…' : 'Open handed-off material'}</Button>
      </>}
    <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onDismiss}>Dismiss this handoff</Button>
  </section>
}
