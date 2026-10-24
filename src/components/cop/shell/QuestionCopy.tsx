/**
 * Copying questions on a public COP share, so visitors can paste them into a search.
 *
 *   - CopyableQuestion: the question as plain, selectable text (a long-press selects
 *     the question and nothing else) with a Copy button beside it.
 *   - CopyAllQuestions: "Copy all" at the top of a question list: the open questions,
 *     numbered, under a header line.
 *   - CopyNotice: one polite live region per list that says what happened (useCopyNotice).
 *
 * A copy that fails (no clipboard permission, an insecure context) never fails
 * silently: the text is selected in place (a question) or in a read-only text box
 * (Copy all), and the visitor is told how to copy it by hand.
 */
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { Check, Copy, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COPY_FAILED, copyHint, copyNotice, copyText, formatOpenQuestions, questionCopyText, type ClipboardEnv } from './copy-questions'
import type { CopyNoticeState } from './useCopyNotice'

const COPIED_MS = 2000
const HINT_MS = 10_000

type Announce = (text: string) => void

// ── Browser glue ─────────────────────────────────────────────────

function hint(): string {
  let coarsePointer = false
  try {
    coarsePointer = window.matchMedia('(pointer: coarse)').matches
  } catch {
    // No matchMedia: assume a mouse.
  }
  const platform = typeof navigator !== 'undefined' ? `${navigator.platform} ${navigator.userAgent}` : ''
  return copyHint({ coarsePointer, apple: /Mac|iPhone|iPad|iPod/.test(platform) })
}

/**
 * execCommand('copy') from an off-screen text box, for browsers without the Clipboard
 * API or that refuse it. The box goes inside the open dialog (if any) so the dialog's
 * focus handling isn't disturbed; focus and the visitor's selection are put back.
 */
function legacyCopy(text: string, anchor: Element | null): boolean {
  if (typeof document === 'undefined') return false
  const host = anchor?.closest('[role="dialog"]') ?? document.body
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const selection = document.getSelection()
  const saved = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  const area = document.createElement('textarea')
  area.value = text
  area.readOnly = true
  area.tabIndex = -1
  area.setAttribute('aria-hidden', 'true')
  // 16px: iOS doesn't zoom in on it.
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;'
  host.appendChild(area)
  try {
    area.focus({ preventScroll: true })
    area.select()
    area.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
    if (saved && selection) {
      selection.removeAllRanges()
      selection.addRange(saved)
    }
    previous?.focus({ preventScroll: true })
  }
}

function browserClipboard(anchor: Element | null): ClipboardEnv {
  return {
    clipboard: typeof navigator !== 'undefined' ? navigator.clipboard ?? null : null,
    legacyCopy: (text) => legacyCopy(text, anchor),
  }
}

function selectContents(el: Element | null) {
  const selection = el ? window.getSelection() : null
  if (!el || !selection) return
  const range = document.createRange()
  range.selectNodeContents(el)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** 'copied' or 'failed' for a while, then back to idle. */
function useCopyState() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const show = useCallback((next: 'copied' | 'failed') => {
    clearTimeout(timer.current)
    setState(next)
    timer.current = setTimeout(() => setState('idle'), next === 'copied' ? COPIED_MS : HINT_MS)
  }, [])
  const reset = useCallback(() => {
    clearTimeout(timer.current)
    setState('idle')
  }, [])
  return { state, show, reset }
}

// ── Announcements ────────────────────────────────────────────────

/**
 * The list's polite live region. It sits inside the list, not at the page root, because
 * an open sheet makes the rest of the page inert.
 */
export function CopyNotice({ notice }: { notice: CopyNoticeState }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {notice.text}
      {notice.n % 2 === 1 ? ' ' : ''}
    </p>
  )
}

// ── One question ─────────────────────────────────────────────────

/**
 * The question text and its Copy button. The text is outside every button, so a
 * long-press selects it (and a tap does nothing); the star is an icon, never copied.
 */
export function CopyableQuestion({
  question,
  starred,
  textId,
  onAnnounce,
}: {
  question: string
  starred: boolean
  /** Id of the question paragraph, for aria-describedby on the card's other controls. */
  textId: string
  onAnnounce: Announce
}) {
  const textRef = useRef<HTMLSpanElement>(null)
  const { state, show } = useCopyState()
  const [failHint, setFailHint] = useState('')
  const text = questionCopyText(question)

  const onCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget
    if (await copyText(text, browserClipboard(button))) {
      show('copied')
      onAnnounce(copyNotice({ what: 'question', ok: true, hint: '' }))
      return
    }
    const how = hint()
    selectContents(textRef.current)
    setFailHint(how)
    show('failed')
    onAnnounce(copyNotice({ what: 'question', ok: false, hint: how }))
  }

  const copied = state === 'copied'
  return (
    <div>
      <div className="flex items-start">
        <p id={textId} className="min-w-0 flex-1 select-text break-words pb-1 pl-3 pt-3 text-sm leading-snug text-gray-100">
          {starred && (
            <Star className="-mt-0.5 mr-1 inline h-3.5 w-3.5 select-none fill-amber-400 text-amber-400" aria-label="Key question" />
          )}
          <span ref={textRef} data-question-text>{question}</span>
        </p>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy question: ${text}`}
          className={cn(
            'm-0.5 flex h-11 w-12 shrink-0 select-none flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium leading-none',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500',
            copied ? 'text-emerald-300' : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-100',
          )}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      {state === 'failed' && (
        <p className="select-none px-3 pb-1 text-xs text-amber-200">
          {COPY_FAILED} {failHint}
        </p>
      )}
    </div>
  )
}

// ── Copy all ─────────────────────────────────────────────────────

/**
 * The list header: how many questions are open and "Copy all". When copying fails, the
 * text appears in a read-only box, selected, to copy by hand.
 */
export function CopyAllQuestions({
  copName,
  lines,
  onAnnounce,
}: {
  copName: string
  /** The open questions, one per line (openQuestionLines). */
  lines: readonly string[]
  onAnnounce: Announce
}) {
  const { state, show, reset } = useCopyState()
  const [fallback, setFallback] = useState<{ text: string; hint: string } | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const areaId = useId()
  const text = formatOpenQuestions(copName, lines)
  const count = lines.length
  const countLabel = `${count} open question${count === 1 ? '' : 's'}`

  // The box shows what Copy all would have copied, selected.
  useEffect(() => {
    const area = areaRef.current
    if (!fallback || !area) return
    area.focus({ preventScroll: true })
    area.select()
    area.setSelectionRange(0, area.value.length)
  }, [fallback])

  if (count === 0) return null

  const onCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget
    if (await copyText(text, browserClipboard(button))) {
      setFallback(null)
      show('copied')
      onAnnounce(copyNotice({ what: 'all', ok: true, count, hint: '' }))
      return
    }
    const how = hint()
    reset()
    setFallback({ text, hint: how })
    onAnnounce(copyNotice({ what: 'all', ok: false, count, hint: how }))
  }

  const copied = state === 'copied'
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-gray-400">{countLabel}</p>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy all ${countLabel}`}
          className={cn(
            'inline-flex min-h-11 min-w-[6.5rem] shrink-0 select-none items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
            copied ? 'border-emerald-500/40 text-emerald-300' : 'border-gray-600 text-gray-200 hover:bg-gray-700/60',
          )}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy all'}
        </button>
      </div>
      {fallback && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-1">
            <label htmlFor={areaId} className="min-w-0 flex-1 py-1 text-xs text-amber-200">
              {COPY_FAILED} {fallback.hint}
            </label>
            <button
              type="button"
              onClick={() => setFallback(null)}
              aria-label="Hide the copy box"
              className="-mr-1 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-700/60 hover:text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <textarea
            ref={areaRef}
            id={areaId}
            readOnly
            value={fallback.text}
            rows={Math.min(count + 1, 6)}
            className="block w-full resize-none rounded-lg border border-gray-600 bg-gray-900 p-2 text-base leading-snug text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          />
        </div>
      )}
    </div>
  )
}
