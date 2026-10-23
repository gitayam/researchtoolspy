/**
 * AnswerSheet — answer one question on a public COP share, in a CopSheet (a bottom
 * sheet on phones, a right-side sheet on wider screens; Back, Escape or Close dismiss it).
 *
 * The question sits at the top. A yes/no question ("Is …", "Did …") offers quick
 * choices — Yes, No, Partly, Not sure — whose pick becomes the answer's first word, so
 * the details are optional; any other question asks for the answer itself (and focuses
 * the field). The source link and the visitor's name are optional and folded away
 * (answers are anonymous by default). Send stays in view above the keyboard.
 *
 * Each question keeps its own draft in sessionStorage, so closing the sheet, or
 * switching questions, loses nothing; a sent answer clears it. After sending, the
 * sheet says so and offers the next question (open ones first, key questions first,
 * fewest answers). A refused or failed send keeps the text and says what failed.
 *
 * References (2026-10-23): GOV.UK radios (no preselected choice, a "not sure" option,
 * error text that names the fix) and details (only optional fields folded away);
 * the bottom-card flow of BulletinBoard (MIT, iOS; idea only, no code) for "answer,
 * then the next one" in the same sheet instead of stacking sheets; the repo's own
 * EvidenceSubmitSheet for the success state and PublicIntakeForm for the chips.
 */
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { CheckCircle2, Link2, Loader2, Send, Star, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import CopSheet from './CopSheet'
import {
  DETAILS_MAX,
  NAME_MAX,
  QUICK_CHOICES,
  SOURCE_MAX,
  answerErrorMessage,
  clearAnswerDraft,
  composeAnswerText,
  isValidSourceLink,
  isYesNoQuestion,
  readAnswerDraft,
  readAnswerName,
  sessionStore,
  writeAnswerDraft,
  writeAnswerName,
  type QuickChoice,
} from './share-answers'

export interface AnswerTarget {
  id: string
  question: string
  isKey: boolean
  answerCount: number
  status: string
}

interface AnswerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The share link's token. */
  token: string
  /** The question being answered. */
  question: AnswerTarget | null
  /** The question to offer once this one is sent; null when none is left. */
  next: AnswerTarget | null
  /** After the server stored the answer (refresh the counts). */
  onSent: (rfiId: string) => void
  /** "Answer the next open question": the host switches `question` to it. */
  onAnswerNext: (next: AnswerTarget) => void
  /** True when the link lists answers, with names, to everyone who opens it. */
  answersArePublic: boolean
  rootClassName?: string
}

// scroll-mb: a focused field scrolls clear of the sticky Send footer.
const FIELD = 'mt-1.5 w-full scroll-mb-32 rounded-lg border bg-gray-800 px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
const LINK_BUTTON = 'inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-medium text-blue-300 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500'

export default function AnswerSheet({
  open,
  onOpenChange,
  token,
  question,
  next,
  onSent,
  onAnswerNext,
  answersArePublic,
  rootClassName,
}: AnswerSheetProps) {
  // The question whose answer was just sent (its success state shows until the sheet closes).
  const [sentFor, setSentFor] = useState<string | null>(null)
  // Arrived through "Answer the next open question": the form takes focus itself.
  const [arrivedByNext, setArrivedByNext] = useState(false)
  const focusRef = useRef<HTMLElement | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setSentFor(null)
      setArrivedByNext(false)
    }
  }

  const sent = !!question && sentFor === question.id

  return (
    <CopSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Answer a question"
      rootClassName={rootClassName}
      initialFocusRef={focusRef}
    >
      {question && sent && (
        <SentState
          next={next}
          answersArePublic={answersArePublic}
          onNext={(target) => {
            setSentFor(null)
            setArrivedByNext(true)
            onAnswerNext(target)
          }}
          onDone={() => handleOpenChange(false)}
        />
      )}
      {question && !sent && (
        <AnswerForm
          key={question.id}
          token={token}
          question={question}
          focusRef={focusRef}
          focusOnMount={arrivedByNext}
          answersArePublic={answersArePublic}
          onSent={() => {
            setSentFor(question.id)
            onSent(question.id)
          }}
        />
      )}
    </CopSheet>
  )
}

// ── The form ─────────────────────────────────────────────────────

interface AnswerFormProps {
  token: string
  question: AnswerTarget
  focusRef: RefObject<HTMLElement | null>
  focusOnMount: boolean
  answersArePublic: boolean
  onSent: () => void
}

type FieldError = { field: 'details' | 'source'; message: string } | null

function AnswerForm({ token, question, focusRef, focusOnMount, answersArePublic, onSent }: AnswerFormProps) {
  const id = useId()
  const hasChoices = isYesNoQuestion(question.question)
  const [initial] = useState(() => readAnswerDraft(sessionStore(), question.id))
  const [savedName] = useState(() => readAnswerName(sessionStore()))
  const [choice, setChoice] = useState<QuickChoice | null>(hasChoices ? initial.choice : null)
  const [details, setDetails] = useState(initial.details)
  const [source, setSource] = useState(initial.source)
  const [name, setName] = useState(savedName)
  const [showSource, setShowSource] = useState(!!initial.source)
  const [showName, setShowName] = useState(!!savedName)
  const [fieldError, setFieldError] = useState<FieldError>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const detailsRef = useRef<HTMLTextAreaElement | null>(null)
  const sourceRef = useRef<HTMLInputElement | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)
  const questionRef = useRef<HTMLParagraphElement | null>(null)
  const revealed = useRef<'source' | 'name' | null>(null)

  // The draft follows every change; the name is kept for this tab's next answer.
  useEffect(() => {
    writeAnswerDraft(sessionStore(), question.id, { choice, details, source })
  }, [question.id, choice, details, source])
  useEffect(() => {
    writeAnswerName(sessionStore(), name)
  }, [name])

  // Opening the sheet focuses the answer field when there are no quick choices
  // (CopSheet reads focusRef); "next question" moves focus here itself.
  const setDetailsEl = useCallback((el: HTMLTextAreaElement | null) => {
    detailsRef.current = el
    focusRef.current = hasChoices ? null : el
  }, [focusRef, hasChoices])
  useEffect(() => {
    if (!focusOnMount) return
    const frame = requestAnimationFrame(() => {
      const target = hasChoices ? questionRef.current : detailsRef.current
      target?.focus({ preventScroll: true })
      questionRef.current?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusOnMount, hasChoices])

  // A revealed optional field takes focus once it's there, scrolled clear of the footer.
  useEffect(() => {
    const field = revealed.current === 'source' && showSource ? sourceRef.current
      : revealed.current === 'name' && showName ? nameRef.current
        : null
    revealed.current = null
    field?.focus({ preventScroll: true })
    field?.scrollIntoView({ block: 'nearest' })
  }, [showSource, showName])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (sending) return
    const answerText = composeAnswerText(choice, details)
    if (!answerText) {
      setFieldError({ field: 'details', message: hasChoices ? 'Choose an answer above or write one.' : 'Write your answer.' })
      detailsRef.current?.focus()
      return
    }
    if (!isValidSourceLink(source)) {
      setFieldError({ field: 'source', message: 'Enter a link that starts with https:// or http://, or leave it empty.' })
      sourceRef.current?.focus()
      return
    }
    setFieldError(null)
    setSendError(null)
    setSending(true)
    let response: Response
    try {
      response = await fetch(`/api/cop/public/${encodeURIComponent(token)}/rfis/${encodeURIComponent(question.id)}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer_text: answerText,
          source_url: source.trim() || undefined,
          responder_name: name.trim() || undefined,
        }),
      })
    } catch {
      setSendError(answerErrorMessage(null))
      setSending(false)
      return
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null
      setSendError(answerErrorMessage(response.status, typeof body?.error === 'string' ? body.error : null))
      setSending(false)
      return
    }
    clearAnswerDraft(sessionStore(), question.id)
    setSending(false)
    onSent()
  }

  const questionId = `${id}-question`
  const choicesLabelId = `${id}-choices`
  const detailsId = `${id}-details`
  const detailsErrorId = `${id}-details-error`
  const sourceId = `${id}-source`
  const sourceErrorId = `${id}-source-error`
  const nameId = `${id}-name`
  const nameHintId = `${id}-name-hint`
  const detailsError = fieldError?.field === 'details' ? fieldError.message : null
  const sourceError = fieldError?.field === 'source' ? fieldError.message : null

  return (
    <form onSubmit={submit} noValidate className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-4 pb-5 pt-4">
        <div>
          <p
            ref={questionRef}
            id={questionId}
            tabIndex={-1}
            className="break-words text-[17px] font-semibold leading-snug text-gray-50 outline-none"
          >
            {question.isKey && (
              <Star className="mr-1.5 inline h-4 w-4 -translate-y-px fill-amber-400 text-amber-400" aria-label="Key question" />
            )}
            {question.question}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {question.answerCount > 0
              ? `${question.answerCount} answer${question.answerCount !== 1 ? 's' : ''} so far`
              : 'No answers yet'}
          </p>
        </div>

        {hasChoices && (
          <div>
            <p id={choicesLabelId} className="text-sm font-medium text-gray-200">Your answer</p>
            <div
              role="radiogroup"
              aria-labelledby={choicesLabelId}
              className="mt-2 grid grid-cols-2 gap-2 min-[360px]:grid-cols-4"
            >
              {QUICK_CHOICES.map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-[15px] font-medium transition-colors',
                    'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-400',
                    choice === option
                      ? 'border-blue-400 bg-blue-600 text-white'
                      : 'border-gray-600 bg-gray-800 text-gray-200 hover:border-gray-500 hover:bg-gray-700',
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-choice`}
                    value={option}
                    checked={choice === option}
                    onChange={() => {
                      setChoice(option)
                      if (detailsError) setFieldError(null)
                    }}
                    className="sr-only"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor={detailsId} className="block text-sm font-medium text-gray-200">
            {hasChoices ? <>Details <span className="font-normal text-gray-400">(optional)</span></> : 'Your answer'}
          </label>
          <textarea
            ref={setDetailsEl}
            id={detailsId}
            value={details}
            onChange={(e) => {
              setDetails(e.target.value)
              if (detailsError) setFieldError(null)
            }}
            rows={hasChoices ? 3 : 4}
            maxLength={DETAILS_MAX}
            placeholder={hasChoices ? 'What you saw or know, and when' : 'What you know, and how you know it'}
            aria-invalid={detailsError ? true : undefined}
            aria-describedby={detailsError ? detailsErrorId : undefined}
            className={cn(FIELD, 'resize-y', detailsError ? 'border-red-400' : 'border-gray-600')}
          />
          {detailsError && <p id={detailsErrorId} className="mt-1.5 text-sm text-red-300">{detailsError}</p>}
        </div>

        <div className="space-y-1">
          {showSource ? (
            <div>
              <label htmlFor={sourceId} className="block text-sm font-medium text-gray-200">
                Source link <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                ref={sourceRef}
                id={sourceId}
                type="url"
                inputMode="url"
                autoComplete="off"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value)
                  if (sourceError) setFieldError(null)
                }}
                maxLength={SOURCE_MAX}
                placeholder="https://"
                aria-invalid={sourceError ? true : undefined}
                aria-describedby={sourceError ? sourceErrorId : undefined}
                className={cn(FIELD, sourceError ? 'border-red-400' : 'border-gray-600')}
              />
              {sourceError && <p id={sourceErrorId} className="mt-1.5 text-sm text-red-300">{sourceError}</p>}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { revealed.current = 'source'; setShowSource(true) }}
              className={LINK_BUTTON}
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Add a source link
            </button>
          )}

          {showName ? (
            <div className={cn(showSource && 'pt-4')}>
              <label htmlFor={nameId} className="block text-sm font-medium text-gray-200">
                Your name <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                ref={nameRef}
                id={nameId}
                type="text"
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={NAME_MAX}
                placeholder="Anonymous"
                aria-describedby={nameHintId}
                className={cn(FIELD, 'border-gray-600')}
              />
              <p id={nameHintId} className="mt-1.5 text-xs text-gray-400">
                {answersArePublic
                  ? 'Shown with your answer to the team and to everyone with this link.'
                  : 'Shown with your answer to the team.'}
              </p>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => { revealed.current = 'name'; setShowName(true) }}
                className={LINK_BUTTON}
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Add your name (optional)
              </button>
              <p className="text-xs text-gray-400">Sent as Anonymous unless you add a name.</p>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-gray-800 bg-slate-900 px-4 pb-3 pt-3">
        {sendError && (
          <p role="alert" className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{sendError}</p>
        )}
        <p className="mb-2 text-xs text-gray-400">The team reviews answers before accepting them.</p>
        <button
          type="submit"
          aria-disabled={sending || undefined}
          className={cn(
            'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white hover:bg-blue-500',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
            sending && 'cursor-progress opacity-70',
          )}
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className="h-5 w-5" aria-hidden="true" />}
          {sending ? 'Sending…' : 'Send answer'}
        </button>
      </div>
    </form>
  )
}

// ── After sending ────────────────────────────────────────────────

function SentState({ next, answersArePublic, onNext, onDone }: {
  next: AnswerTarget | null
  answersArePublic: boolean
  onNext: (next: AnswerTarget) => void
  onDone: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // The form (and its Send button) is gone: put focus, and the screen reader, on the result.
  useEffect(() => {
    const frame = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="space-y-4 px-4 py-4">
      <div
        ref={ref}
        role="status"
        tabIndex={-1}
        className="flex items-start gap-3 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-base font-semibold text-emerald-200">Sent. The team will review it.</p>
          {answersArePublic && (
            <p className="mt-0.5 text-sm text-emerald-100/80">It's listed under the question now; a tick marks it once the team accepts it.</p>
          )}
        </div>
      </div>

      {next && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Next open question</p>
          <p className="break-words text-[15px] leading-snug text-gray-100">
            {next.isKey && <Star className="mr-1 inline h-3.5 w-3.5 -translate-y-px fill-amber-400 text-amber-400" aria-label="Key question" />}
            {next.question}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {next && (
          <button
            type="button"
            onClick={() => onNext(next)}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-base font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            Answer the next open question
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className={cn(
            'flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
            next ? 'border border-gray-600 text-gray-100 hover:bg-gray-800' : 'bg-blue-600 text-white hover:bg-blue-500',
          )}
        >
          Done
        </button>
      </div>
    </div>
  )
}
