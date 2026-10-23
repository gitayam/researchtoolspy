/**
 * EvidenceSubmitSheet — the COP's evidence form, opened in place from the top bar.
 *
 * Renders the existing drop form (PublicIntakeForm in drop mode) inside a CopSheet:
 * a bottom sheet on phones, a right-side sheet on wider screens. The form stays
 * mounted while the sheet is closed, so a draft survives an accidental dismiss.
 * "Open in new window" pops the same form out to /drop/<token>.
 *
 * "Which questions does this help answer?" lists the questions the host may offer
 * (`questionContext`: a share link, or the workspace's question ticket); "+ Add
 * evidence" on a question opens the sheet with it ticked (`initialQuestionId`, applied
 * again each time `preselectNonce` changes; others can be added). After a submission
 * the sheet says which questions it was filed under.
 */
import { useCallback, useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import PublicIntakeForm, { type IntakeIngested, type IntakeQuestionChoice, type IntakeQuestionContext } from '../PublicIntakeForm'
import CopSheet from './CopSheet'
import { filedUnderLabel } from '@/lib/cop-evidence-links'

interface EvidenceSubmitSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The linked drop's share token. */
  dropToken: string
  /** The drop's title, shown under the sheet title. */
  formTitle?: string | null
  /** Called after each successful submission, with the questions it was filed under. */
  onSubmitted?: (ingested: IntakeIngested | null, questions: IntakeQuestionChoice[]) => void
  rootClassName?: string
  questionContext?: IntakeQuestionContext
  initialQuestionId?: string | null
  preselectNonce?: number
}

export default function EvidenceSubmitSheet({
  open,
  onOpenChange,
  dropToken,
  formTitle,
  onSubmitted,
  rootClassName,
  questionContext,
  initialQuestionId = null,
  preselectNonce = 0,
}: EvidenceSubmitSheetProps) {
  const [received, setReceived] = useState(false)
  // Whether the server put it straight into the COP, or it waits in the review inbox.
  const [ingestedNow, setIngestedNow] = useState(false)
  const [filedUnder, setFiledUnder] = useState<IntakeQuestionChoice[]>([])

  const handleSubmitted = useCallback(
    ({ ingested, questions }: { ingested: IntakeIngested | null; questions: IntakeQuestionChoice[] }) => {
      setReceived(true)
      setIngestedNow(!!ingested?.evidence_id)
      setFiledUnder(questions)
      onSubmitted?.(ingested, questions)
    },
    [onSubmitted],
  )

  const popOut = () => {
    window.open(`/drop/${encodeURIComponent(dropToken)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <CopSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        // A closed sheet opens on the form again next time.
        if (!next) setReceived(false)
      }}
      title="Submit evidence"
      description={formTitle ? `${formTitle} · anonymous` : 'Anonymous · reviewed before it is trusted'}
      rootClassName={rootClassName}
      headerActions={
        <button
          type="button"
          onClick={popOut}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium text-blue-600 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500 dark:text-blue-400 dark:hover:bg-blue-500/10"
          aria-label="Open the evidence form in a new window"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">New window</span>
        </button>
      }
    >
      {received && (
        <div role="status" className="mx-4 mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Received</p>
              {filedUnder.length === 1 && (
                <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-100">
                  <span className="font-medium">{filedUnderLabel(1)}</span> <span className="break-words">{filedUnder[0].question}</span>
                </p>
              )}
              {filedUnder.length > 1 && (
                <div className="mt-1 text-sm text-emerald-900 dark:text-emerald-100">
                  <p className="font-medium">{filedUnderLabel(filedUnder.length)}</p>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                    {filedUnder.map((q) => <li key={q.id} className="break-words">{q.question}</li>)}
                  </ul>
                </div>
              )}
              <p className="mt-0.5 text-sm text-emerald-800 dark:text-emerald-300">
                {ingestedNow
                  ? filedUnder.length > 0
                    ? `It's listed under ${filedUnder.length === 1 ? 'that question' : 'those questions'} now, marked unverified until someone reviews it.`
                    : "It's in the COP feed now, marked unverified until someone reviews it."
                  : filedUnder.length > 0
                    ? `It appears under ${filedUnder.length === 1 ? 'that question' : 'those questions'}, marked unverified, once the team has reviewed it.`
                    : 'It appears in the COP feed as unverified once the team has reviewed it.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReceived(false)}
                  className="min-h-11 rounded-lg border border-emerald-400 px-4 text-sm font-medium text-emerald-900 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                >
                  Submit another
                </button>
                <button
                  type="button"
                  onClick={() => { setReceived(false); onOpenChange(false) }}
                  className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Kept mounted (hidden after a submission) so the next one starts from a fresh form, not a reload. */}
      <div hidden={received}>
        <PublicIntakeForm
          token={dropToken}
          isDropMode
          embedded
          onSubmitted={handleSubmitted}
          questionContext={questionContext}
          initialQuestionId={initialQuestionId}
          preselectNonce={preselectNonce}
        />
      </div>
    </CopSheet>
  )
}
