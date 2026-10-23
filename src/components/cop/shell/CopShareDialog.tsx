/**
 * CopShareDialog — who can see this COP, and how.
 *
 *   - Collaborator link: the workspace URL (needs access to the session).
 *   - Public view links: read-only `/public/cop/<token>` links that show the map
 *     plus the panels chosen here, optionally letting viewers answer questions
 *     and submit evidence (when the session has an evidence form linked), with an
 *     expiry. Existing links can be copied or revoked.
 *   - Link a Signal room: a one-time code (24 hours) the room's organizer sends as
 *     `!cop link <code>`; the room then gets this COP's updates and its posts come here.
 *     The owner or an admin makes codes, and can revoke every open one at once.
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Link2, Loader2, MessageSquare, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getCopHeaders } from '@/lib/cop-auth'
import { cn } from '@/lib/utils'

interface ShareRow {
  share_token: string
  /** Worked out when the list loads. */
  expired?: boolean
  visible_panels: string[]
  allow_rfi_answers?: number | boolean
  allow_evidence?: number | boolean
  created_at?: string
  expires_at?: string | null
  view_count?: number
}

interface CopShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  /** Whether an evidence form (drop) is linked to this session. */
  hasEvidenceForm: boolean
}

const EXPIRY_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '365', label: '1 year' },
] as const

const PANEL_NAMES: Record<string, string> = { event: 'Brief', rfi: 'Questions', questions: 'Questions', cams: 'Cams' }

function panelSummary(panels: string[]): string {
  const names = Array.from(new Set(panels.map((p) => PANEL_NAMES[p]).filter(Boolean)))
  return ['Map', ...names].join(' · ')
}

const shareUrl = (token: string) => `${window.location.origin}/public/cop/${token}`

export default function CopShareDialog({ open, onOpenChange, sessionId, hasEvidenceForm }: CopShareDialogProps) {
  const [shares, setShares] = useState<ShareRow[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((n) => n + 1), [])
  const [copied, setCopied] = useState<string | null>(null)
  const [manualCopy, setManualCopy] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)

  const [showBrief, setShowBrief] = useState(true)
  const [showQuestions, setShowQuestions] = useState(true)
  const [showCams, setShowCams] = useState(true)
  const [allowAnswers, setAllowAnswers] = useState(false)
  const [allowEvidence, setAllowEvidence] = useState(false)
  const [expiryDays, setExpiryDays] = useState<string>('7')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [roomCode, setRoomCode] = useState<{ command: string; expires_at: string } | null>(null)
  const [makingCode, setMakingCode] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [confirmRevokeCodes, setConfirmRevokeCodes] = useState(false)
  const [revokingCodes, setRevokingCodes] = useState(false)
  const [codesNotice, setCodesNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetch(`/api/cop/${sessionId}/shares`, { headers: getCopHeaders(), signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'You need access to this COP to see its links.' : `Couldn't load links (HTTP ${res.status}).`)
        const data = await res.json()
        const now = Date.now()
        const rows: ShareRow[] = Array.isArray(data.shares) ? data.shares : []
        setShares(rows.map((row) => ({ ...row, expired: !!row.expires_at && Date.parse(row.expires_at) <= now })))
        setListError(null)
      })
      .catch((error) => {
        if ((error as Error)?.name === 'AbortError') return
        setListError(error instanceof Error ? error.message : "Couldn't load links.")
        setShares([])
      })
    return () => controller.abort()
  }, [open, sessionId, reloadKey])

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setManualCopy(null)
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000)
    } catch {
      setManualCopy(text)
    }
  }, [])

  const create = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const visible_panels = [
        'map',
        ...(showBrief ? ['event'] : []),
        ...(showQuestions ? ['rfi', 'questions'] : []),
        ...(showCams ? ['cams'] : []),
      ]
      const expires_at = new Date(Date.now() + Number(expiryDays) * 86_400_000 - 60_000).toISOString()
      const res = await fetch(`/api/cop/${sessionId}/shares`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          visible_panels,
          allow_rfi_answers: showQuestions && allowAnswers,
          allow_evidence: hasEvidenceForm && allowEvidence,
          expires_at,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? 'Only the session owner or an editor can create public links.'
            : data?.error ?? `Couldn't create the link (HTTP ${res.status}).`,
        )
      }
      if (data?.share_token) await copy(data.share_token, shareUrl(data.share_token))
      reload()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Couldn't create the link.")
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (token: string) => {
    setConfirmRevoke(null)
    try {
      const res = await fetch(`/api/cop/${sessionId}/shares?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
        headers: getCopHeaders(),
      })
      if (!res.ok) throw new Error(res.status === 403 ? 'Only the session owner or an editor can revoke links.' : `Couldn't revoke (HTTP ${res.status}).`)
      reload()
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Couldn't revoke the link.")
    }
  }

  const makeRoomCode = async () => {
    setMakingCode(true)
    setCodeError(null)
    setCodesNotice(null)
    setConfirmRevokeCodes(false)
    try {
      const res = await fetch(`/api/cop/${sessionId}/room-link-codes`, { method: 'POST', headers: getCopHeaders() })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.command !== 'string') {
        throw new Error(
          res.status === 403
            ? 'Only the COP owner or an admin can link a Signal room.'
            : res.status === 503
              ? 'Linking Signal rooms isn’t available on this server yet.'
              : data?.error ?? `Couldn't make a code (HTTP ${res.status}).`,
        )
      }
      setRoomCode({ command: data.command, expires_at: data.expires_at })
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : "Couldn't make a code.")
    } finally {
      setMakingCode(false)
    }
  }

  const revokeRoomCodes = async () => {
    setConfirmRevokeCodes(false)
    setRevokingCodes(true)
    setCodeError(null)
    setCodesNotice(null)
    try {
      const res = await fetch(`/api/cop/${sessionId}/room-link-codes`, { method: 'DELETE', headers: getCopHeaders() })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.revoked !== 'number') {
        throw new Error(
          res.status === 403
            ? 'Only the COP owner or an admin can revoke room link codes.'
            : res.status === 503
              ? 'Linking Signal rooms isn’t available on this server yet.'
              : data?.error ?? `Couldn't revoke the codes (HTTP ${res.status}).`,
        )
      }
      setRoomCode(null)
      setCodesNotice(
        data.revoked === 0
          ? 'There were no open codes to revoke.'
          : `Revoked ${data.revoked} open code${data.revoked === 1 ? '' : 's'}. Rooms already linked stay linked.`,
      )
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : "Couldn't revoke the codes.")
    } finally {
      setRevokingCodes(false)
    }
  }

  const collaboratorUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/cop/${sessionId}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* One shrinkable column: a long link truncates instead of widening the dialog.
          The shared dialog's close button is 16 px; here it gets a 44 px hit area. */}
      <DialogContent className="grid-cols-[minmax(0,1fr)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto p-5 sm:p-6 [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center">
        <DialogHeader>
          <DialogTitle>Share this COP</DialogTitle>
          <DialogDescription>
            Collaborators open the workspace. Anyone with a public link sees a read-only view of what you choose.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2" aria-labelledby="share-collab-heading">
          <h3 id="share-collab-heading" className="text-sm font-semibold">Collaborator link</h3>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-slate-100 px-2 py-2 text-xs dark:bg-slate-800">{collaboratorUrl}</code>
            <CopyButton copied={copied === 'collab'} onClick={() => copy('collab', collaboratorUrl)} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Only people with access to this session can open it.</p>
        </section>

        <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800" aria-labelledby="share-new-heading">
          <h3 id="share-new-heading" className="text-sm font-semibold">New public view link</h3>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs text-slate-500 dark:text-slate-400">The map is always shown. Also show:</legend>
            <CheckRow checked={showBrief} onChange={setShowBrief} label="Brief" hint="Event type, description and key facts" />
            <CheckRow checked={showQuestions} onChange={setShowQuestions} label="Questions" hint="Key questions and RFIs" />
            <CheckRow checked={showCams} onChange={setShowCams} label="Cams" hint="Pinned public webcams" />
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs text-slate-500 dark:text-slate-400">Viewers may:</legend>
            <CheckRow
              checked={showQuestions && allowAnswers}
              onChange={setAllowAnswers}
              disabled={!showQuestions}
              label="Answer questions"
              hint={showQuestions ? 'Answers arrive for review' : 'Needs the Questions panel'}
            />
            <CheckRow
              checked={hasEvidenceForm && allowEvidence}
              onChange={setAllowEvidence}
              disabled={!hasEvidenceForm}
              label="Submit evidence"
              hint={hasEvidenceForm ? 'Opens this COP’s evidence form from the shared view' : 'Link an evidence form to this COP first'}
            />
          </fieldset>
          <label className="flex items-center gap-3 text-sm">
            <span>Expires after</span>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="min-h-11 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {createError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{createError}</p>}
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
            Create and copy link
          </button>
        </section>

        <section className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800" aria-labelledby="share-list-heading">
          <h3 id="share-list-heading" className="text-sm font-semibold">Public links</h3>
          {listError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{listError}</p>}
          {shares === null ? (
            <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…</p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No public links yet.</p>
          ) : (
            <ul className="space-y-2">
              {shares.map((share) => {
                const expired = !!share.expired
                return (
                  <li key={share.share_token} className={cn('rounded-lg border border-slate-200 p-3 dark:border-slate-800', expired && 'opacity-60')}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{panelSummary(share.visible_panels ?? [])}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {expired
                            ? 'Expired'
                            : share.expires_at
                              ? `Expires ${new Date(share.expires_at).toLocaleDateString()}`
                              : 'No expiry'}
                          {typeof share.view_count === 'number' && ` · ${share.view_count} view${share.view_count === 1 ? '' : 's'}`}
                          {!!share.allow_rfi_answers && ' · answers'}
                          {!!share.allow_evidence && ' · evidence'}
                        </p>
                      </div>
                      {!expired && <CopyButton copied={copied === share.share_token} onClick={() => copy(share.share_token, shareUrl(share.share_token))} />}
                      {confirmRevoke === share.share_token ? (
                        <button
                          type="button"
                          onClick={() => revoke(share.share_token)}
                          className="min-h-11 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRevoke(share.share_token)}
                          aria-label="Revoke this link"
                          className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {manualCopy && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Copying isn’t allowed here. Select the link and copy it:</p>
              <input
                readOnly
                value={manualCopy}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          )}
        </section>

        <section className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800" aria-labelledby="share-room-heading">
          <h3 id="share-room-heading" className="text-sm font-semibold">Link a Signal room</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The room’s organizer sends the command in the room. What happens in this COP then appears in the room’s digest, and what the room posts comes here. The code works once, for 24 hours.
          </p>
          {roomCode ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-slate-100 px-2 py-2 text-sm font-semibold tracking-wide dark:bg-slate-800">{roomCode.command}</code>
                <CopyButton copied={copied === 'room-code'} onClick={() => copy('room-code', roomCode.command)} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Works once, until {new Date(roomCode.expires_at).toLocaleString()}. It won’t be shown again.
              </p>
            </div>
          ) : null}
          {codeError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{codeError}</p>}
          <button
            type="button"
            onClick={makeRoomCode}
            disabled={makingCode}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {makingCode ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MessageSquare className="h-4 w-4" aria-hidden="true" />}
            {roomCode ? 'Make another code' : 'Make a room link code'}
          </button>
          {confirmRevokeCodes ? (
            <div className="space-y-2 rounded-lg border border-red-200 p-3 dark:border-red-900/60">
              <p className="text-sm">Revoke every unused code for this COP? Nobody can link a room with them afterwards. Rooms already linked stay linked.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={revokeRoomCodes}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Revoke open codes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRevokeCodes(false)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setCodesNotice(null); setConfirmRevokeCodes(true) }}
              disabled={revokingCodes}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {revokingCodes ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              Revoke open codes
            </button>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite">{codesNotice}</p>
        </section>
      </DialogContent>
    </Dialog>
  )
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1', disabled && 'cursor-not-allowed opacity-60')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 rounded border-slate-400 accent-blue-600"
      />
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
    </label>
  )
}
