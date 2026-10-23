/**
 * On an evidence card: the questions it is filed under (as chips) and "File under
 * question" — tick any number of the COP's questions (key questions first) and say
 * how the item bears on each. Filing never answers or closes a question.
 */
import { useId, useMemo, useState } from 'react'
import { FolderInput, Loader2, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RelationChip } from '@/components/cop/evidence-links/RelationChip'
import { useCopEvidenceLinks, useCopQuestions } from '@/hooks/useCopEvidenceLinks'
import {
  fileEvidence, groupByEvidence, linkErrorMessage, planFiling, RELATION_OPTIONS, unfileEvidence, type FilingChoice,
} from '@/lib/cop-evidence-links'
import type { CopEvidenceRelation } from '@/types/cop'

const shorten = (text: string, max = 48) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

export function FileUnderQuestions({ sessionId, evidenceId, className }: {
  sessionId: string
  evidenceId: string
  className?: string
}) {
  const uid = useId()
  const { links, loaded, available } = useCopEvidenceLinks(sessionId)
  const { questions } = useCopQuestions(sessionId)
  const filed = useMemo(
    () => (groupByEvidence(links).get(evidenceId) ?? []).filter((l) => l.target_type === 'rfi'),
    [links, evidenceId],
  )
  const questionText = useMemo(() => new Map(questions.map((q) => [q.id, q.question])), [questions])
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<FilingChoice>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!loaded || !available) return null

  const start = () => {
    setChoice(Object.fromEntries(filed.map((l) => [l.target_id, l.relation])))
    setMessage(null)
    setOpen(true)
  }

  const toggle = (id: string) => setChoice((prev) => {
    const next = { ...prev }
    if (id in next) delete next[id]
    else next[id] = 'supports'
    return next
  })

  const save = async () => {
    const plan = planFiling(filed, choice)
    setBusy(true)
    setMessage(null)
    let failed: string | null = null
    for (const { targetId, relation } of [...plan.add, ...plan.update]) {
      const existing = filed.find((l) => l.target_id === targetId)
      const res = await fileEvidence(sessionId, { evidenceId, targetType: 'rfi', targetId, relation, note: existing?.note ?? null })
      if (res.ok === false) failed = linkErrorMessage(res)
    }
    for (const link of plan.remove) {
      const res = await unfileEvidence(sessionId, link)
      if (res.ok === false) failed = linkErrorMessage(res)
    }
    setBusy(false)
    if (failed) setMessage(failed)
    else setOpen(false)
  }

  return (
    <div className={cn('mt-1', className)}>
      {!open && (
        <div className="flex flex-wrap items-center gap-1">
          {filed.map((link) => (
            <span
              key={link.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 py-px pl-1 pr-0.5 text-[10px] text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
            >
              <RelationChip relation={link.relation} className="border-0 bg-transparent px-0.5" />
              <span className="truncate" title={questionText.get(link.target_id)}>{shorten(questionText.get(link.target_id) ?? 'Question')}</span>
              <button
                type="button"
                onClick={async () => {
                  setMessage(null)
                  const res = await unfileEvidence(sessionId, link)
                  if (res.ok === false) setMessage(linkErrorMessage(res))
                }}
                className="relative rounded-full p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 after:absolute after:-inset-2 after:content-[''] pointer-coarse:after:-inset-3"
                aria-label={`Unfile from “${questionText.get(link.target_id) ?? 'this question'}”`}
              >
                <X className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={start}
            className="relative inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 after:absolute after:-inset-y-3 after:-inset-x-1 after:content-['']"
          >
            <FolderInput className="h-3 w-3" aria-hidden="true" />
            {filed.length === 0 ? 'File under question' : 'Edit questions'}
          </button>
        </div>
      )}

      {open && (
        <div
          className="space-y-1.5 rounded bg-blue-50/70 p-2 dark:bg-blue-950/30"
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
        >
          <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200">File under questions</p>
          {questions.length === 0 ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">This COP has no questions yet. Ask one in the Questions tab.</p>
          ) : (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto" aria-label="Questions">
              {questions.map((q) => {
                const checked = q.id in choice
                const inputId = `${uid}-${q.id}`
                return (
                  <li key={q.id} className="flex flex-wrap items-center gap-1.5 rounded px-1 py-0.5 hover:bg-white dark:hover:bg-gray-800">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(q.id)}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600"
                    />
                    <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer py-1 text-xs text-gray-800 dark:text-gray-200 pointer-coarse:min-h-11 pointer-coarse:py-3">
                      {q.is_key && <Star className="mr-1 inline h-3 w-3 -mt-0.5 fill-amber-400 text-amber-500" aria-label="Key question" />}
                      {q.question}
                      {q.status === 'closed' && <span className="ml-1 text-[10px] text-gray-500">(closed)</span>}
                    </label>
                    {checked && (
                      <select
                        value={choice[q.id]}
                        onChange={(e) => setChoice((prev) => ({ ...prev, [q.id]: e.target.value as CopEvidenceRelation }))}
                        aria-label={`How it bears on “${shorten(q.question, 80)}”`}
                        className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                      >
                        {RELATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || questions.length === 0}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-60 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
            >
              {busy && <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden="true" />}
              Save
            </button>
          </div>
        </div>
      )}
      {message && <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400" role="alert">{message}</p>}
    </div>
  )
}

/** The feed's "Evidence for: <question>" filter. */
export function QuestionFilterSelect({ sessionId, value, onChange, className }: {
  sessionId: string
  value: string
  onChange: (questionId: string) => void
  className?: string
}) {
  const { questions } = useCopQuestions(sessionId)
  const { loaded, available } = useCopEvidenceLinks(sessionId)
  if (!loaded || !available || questions.length === 0) return null
  return (
    <label className={cn('flex min-w-0 items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400', className)}>
      <span className="shrink-0">Evidence for</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 max-w-[14rem] truncate rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <option value="">any question</option>
        {questions.map((q) => (
          <option key={q.id} value={q.id}>{q.is_key ? 'Key · ' : ''}{shorten(q.question, 60)} ({q.evidence_count})</option>
        ))}
      </select>
    </label>
  )
}
