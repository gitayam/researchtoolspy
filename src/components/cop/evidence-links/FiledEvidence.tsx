/**
 * The evidence filed under one question (RFI, key question) or task, and "Add
 * evidence": attach something already in the COP, paste a link, or upload a file.
 *
 * Filing evidence never answers or closes the question — it collects what bears on
 * it, marked as supporting, contradicting or context. Answering stays a separate,
 * optional step. Writes are refused by the server for viewers; the message says so.
 */
import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { ExternalLink, FileUp, Link2, Loader2, Paperclip, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopItemTags } from '@/components/cop/CopItemTags'
import { RelationChip, RelationPicker } from '@/components/cop/evidence-links/RelationChip'
import { useCopEvidenceIndex, useCopEvidenceLinks } from '@/hooks/useCopEvidenceLinks'
import {
  addEvidenceToQuestion, addEvidenceToTask, cleanLinkInput, fileEvidence, groupByTarget, linkErrorMessage, NOTE_MAX,
  RELATION_OPTIONS, targetKey, unfileEvidence,
} from '@/lib/cop-evidence-links'
import { UPLOAD_ACCEPT, uploadProblem, uploadToCop } from '@/lib/cop-upload'
import type { CopEvidenceLinkTarget, CopEvidenceRelation } from '@/types/cop'

type Mode = 'attach' | 'link' | 'file'

const httpUrl = (value: string | null): string | null => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

export function FiledEvidence({ sessionId, targetType, targetId, label, className, startOpen = false }: {
  sessionId: string
  targetType: CopEvidenceLinkTarget
  targetId: string
  /** "question" or "task", for the wording and accessible names. */
  label: 'question' | 'task'
  className?: string
  /** Open "Add evidence" straight away (e.g. after tracking a key question to file under it). */
  startOpen?: boolean
}) {
  const { links, loaded, available } = useCopEvidenceLinks(sessionId)
  const { items } = useCopEvidenceIndex(sessionId)
  const filed = useMemo(() => groupByTarget(links).get(targetKey(targetType, targetId)) ?? [], [links, targetType, targetId])
  const byId = useMemo(() => new Map(items.map((e) => [e.id, e])), [items])
  const [adding, setAdding] = useState(startOpen)
  const [message, setMessage] = useState<string | null>(null)

  if (loaded && !available) {
    return (
      <p className={cn('text-[11px] text-gray-500 dark:text-gray-400', className)}>
        Filing evidence under a {label} isn’t available on this server yet.
      </p>
    )
  }

  const changeRelation = async (evidenceId: string, relation: CopEvidenceRelation, note: string | null) => {
    setMessage(null)
    const res = await fileEvidence(sessionId, { evidenceId, targetType, targetId, relation, note })
    if (res.ok === false) setMessage(linkErrorMessage(res))
  }

  return (
    <section className={cn('space-y-1.5', className)} aria-label={`Evidence filed under this ${label}`}>
      <div className="flex items-center gap-2">
        <h4 className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          Evidence <span className="font-normal text-gray-500 dark:text-gray-400">({filed.length})</span>
        </h4>
        {targetType === 'rfi' && (
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Filing evidence doesn’t answer or close the question.</span>
        )}
      </div>

      {filed.length > 0 ? (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {filed.map((link) => {
            const item = byId.get(link.evidence_id)
            const url = httpUrl(item?.source_url ?? null)
            return (
              <li key={link.id} className="py-1.5">
                <div className="flex items-start gap-1.5">
                  {/* On phones the select below already names the relation; the chip would crowd the title. */}
                  <RelationChip relation={link.relation} className="mt-px hidden shrink-0 sm:inline-flex" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-xs text-gray-800 dark:text-gray-200">
                      {item?.title ?? `Evidence #${link.evidence_id}`}
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="ml-1 inline-flex items-center align-middle text-blue-600 hover:text-blue-500 dark:text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
                          aria-label={`Open ${item?.title ?? 'the source'} in a new tab`}
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      )}
                    </p>
                    {link.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] text-gray-600 dark:text-gray-400">{link.note}</p>}
                    <CopItemTags targetType="evidence" targetId={link.evidence_id} label="evidence item" max={3} />
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <select
                      value={link.relation}
                      onChange={(e) => void changeRelation(link.evidence_id, e.target.value as CopEvidenceRelation, link.note)}
                      aria-label="How it bears on this"
                      className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                    >
                      {RELATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        setMessage(null)
                        const res = await unfileEvidence(sessionId, link)
                        if (res.ok === false) setMessage(linkErrorMessage(res))
                      }}
                      className="relative rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 after:absolute after:-inset-2 after:content-[''] pointer-coarse:after:-inset-3"
                      aria-label={`Unfile “${item?.title ?? 'this evidence'}” from this ${label}`}
                      title="Unfile (the evidence stays in the COP)"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        !adding && <p className="text-[11px] italic text-gray-500 dark:text-gray-400">Nothing filed under this {label} yet.</p>
      )}

      {message && <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">{message}</p>}

      {adding ? (
        <AddEvidenceForm
          sessionId={sessionId}
          targetType={targetType}
          targetId={targetId}
          label={label}
          alreadyFiled={new Set(filed.map((l) => l.evidence_id))}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setMessage(null); setAdding(true) }}
          className="inline-flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-400 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add evidence
        </button>
      )}
    </section>
  )
}

function AddEvidenceForm({ sessionId, targetType, targetId, label, alreadyFiled, onDone }: {
  sessionId: string
  targetType: CopEvidenceLinkTarget
  targetId: string
  label: 'question' | 'task'
  alreadyFiled: Set<string>
  onDone: () => void
}) {
  const uid = useId()
  const { items } = useCopEvidenceIndex(sessionId)
  const [mode, setMode] = useState<Mode>('attach')
  const [relation, setRelation] = useState<CopEvidenceRelation>('supports')
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((e) => !alreadyFiled.has(e.id))
      .filter((e) => !q || e.title.toLowerCase().includes(q) || (e.source_url ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [items, alreadyFiled, query])

  const noteValue = note.trim() ? note.trim().slice(0, NOTE_MAX) : null

  const finish = (text: string) => {
    setDone(text)
    setLink('')
    setTitle('')
    setFile(null)
    setNote('')
    if (fileInput.current) fileInput.current.value = ''
  }

  const attach = async (evidenceId: string, evidenceTitle: string) => {
    setBusy(true); setError(null); setDone(null)
    const res = await fileEvidence(sessionId, { evidenceId, targetType, targetId, relation, note: noteValue })
    setBusy(false)
    if (res.ok === false) setError(linkErrorMessage(res))
    else finish(`Filed “${evidenceTitle}”.`)
  }

  const submitLink = async (e: FormEvent) => {
    e.preventDefault()
    const url = link.trim() ? cleanLinkInput(link) : null
    if (link.trim() && !url) { setError('Paste a web link (http or https).'); return }
    if (!url && !title.trim() && !noteValue) { setError('Paste a link, or give a title or a note.'); return }
    setBusy(true); setError(null); setDone(null)
    const input = { url: url ?? undefined, title: title.trim() || undefined, note: noteValue ?? undefined, relation }
    const res = targetType === 'rfi'
      ? await addEvidenceToQuestion(sessionId, targetId, input)
      : await addEvidenceToTask(sessionId, targetId, input)
    setBusy(false)
    if (res.ok === false) { setError(linkErrorMessage(res)); return }
    const duplicate = targetType === 'rfi' && (res.data as { duplicate?: boolean }).duplicate
    finish(duplicate ? 'That link was already in this COP — filed it here too.' : 'Added and filed.')
  }

  const submitFile = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Choose a photo or PDF.'); return }
    const problem = uploadProblem(file)
    if (problem) { setError(problem); return }
    setBusy(true); setError(null); setDone(null)
    const uploaded = await uploadToCop(sessionId, file, { evidence: true, title: title.trim() || undefined })
    if (uploaded.ok === false) { setBusy(false); setError(linkErrorMessage(uploaded)); return }
    const evidenceId = uploaded.data.evidenceId
    if (!evidenceId) { setBusy(false); setError('The file was stored, but no evidence item came back to file.'); return }
    const res = await fileEvidence(sessionId, { evidenceId, targetType, targetId, relation, note: noteValue })
    setBusy(false)
    if (res.ok === false) setError(linkErrorMessage(res))
    else finish(`Uploaded and filed “${file.name}”.`)
  }

  const tab = (value: Mode, Icon: typeof Search, text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => { setMode(value); setError(null); setDone(null) }}
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
        mode === value ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {text}
    </button>
  )

  const inputClass = 'w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

  return (
    <div
      className="space-y-2 rounded bg-blue-50/70 p-2 dark:bg-blue-950/30"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onDone() } }}
    >
      <div className="flex items-center justify-between gap-1">
        <div role="tablist" aria-label="Where the evidence comes from" className="flex flex-wrap gap-0.5">
          {tab('attach', Paperclip, 'In this COP')}
          {tab('link', Link2, 'Link')}
          {tab('file', FileUp, 'File')}
        </div>
        <button
          type="button"
          onClick={onDone}
          className="rounded px-1.5 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          Done
        </button>
      </div>

      <RelationPicker value={relation} onChange={setRelation} name={`${uid}-relation`} />
      <label className="block">
        <span className="sr-only">Note (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          placeholder="Note (optional): why it matters, time seen…"
          className={inputClass}
        />
      </label>

      {mode === 'attach' && (
        <div className="space-y-1">
          <label className="relative block">
            <span className="sr-only">Search this COP’s evidence</span>
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this COP’s evidence"
              autoFocus
              className={cn(inputClass, 'pl-6')}
            />
          </label>
          {candidates.length > 0 ? (
            <ul className="max-h-48 space-y-0.5 overflow-y-auto">
              {candidates.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void attach(e.id, e.title)}
                    className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-gray-800 hover:bg-white disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    <Plus className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                    {e.source_url && <span className="hidden max-w-[40%] truncate text-[10px] text-gray-500 sm:inline">{safeHost(e.source_url)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {items.length === 0 ? 'This COP has no evidence yet — paste a link or upload a file.' : query ? 'No evidence matches.' : `Everything in this COP is already filed under this ${label}.`}
            </p>
          )}
        </div>
      )}

      {mode === 'link' && (
        <form onSubmit={submitLink} className="space-y-1">
          <label className="block">
            <span className="sr-only">Link</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" autoFocus placeholder="https://…" className={inputClass} />
          </label>
          <label className="block">
            <span className="sr-only">Title (optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Title (optional)" className={inputClass} />
          </label>
          <SubmitRow busy={busy} text="Add and file" />
        </form>
      )}

      {mode === 'file' && (
        <form onSubmit={submitFile} className="space-y-1">
          <input
            ref={fileInput}
            type="file"
            accept={UPLOAD_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-gray-700 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs dark:text-gray-200 dark:file:bg-gray-700 pointer-coarse:file:min-h-11"
            aria-label="Photo or PDF"
          />
          <label className="block">
            <span className="sr-only">Title (optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Title (optional)" className={inputClass} />
          </label>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Photos and PDFs up to 10 MB. Location data is removed from photos.</p>
          <SubmitRow busy={busy} text="Upload and file" />
        </form>
      )}

      {error && <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">{error}</p>}
      {done && <p className="text-[11px] text-emerald-700 dark:text-emerald-400" role="status">{done}</p>}
    </div>
  )
}

function SubmitRow({ busy, text }: { busy: boolean; text: string }) {
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-60 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
      >
        {busy && <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden="true" />}
        {text}
      </button>
    </div>
  )
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
