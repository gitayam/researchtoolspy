/** Stateless, quote-grounded analysis of caller-supplied source excerpts. */
export const EVIDENCE_ANALYSIS_VERSION = 'evidence-analysis.v1' as const
export const EVIDENCE_LIMITS = {
  requestBytes: 64 * 1024,
  excerptChars: 36_000,
  excerpts: 200,
  questions: 12,
  questionChars: 500,
  corrections: 12,
  correctionChars: 1_000,
} as const

export type EvidenceTask = 'questions' | 'claims' | 'entities' | 'framework_questions'
export interface EvidenceExcerpt { id: string; text: string; section?: string; questionId?: string }
export interface EvidenceQuestion { id: string; question: string }
export interface EvidenceQuote { evidenceId: string; text: string }
export interface EvidenceAnswer {
  id: string
  status: 'answered' | 'partial' | 'open' | 'conflicted'
  answer: string
  quotes: EvidenceQuote[]
}
export interface EvidenceFinding { text: string; quotes: EvidenceQuote[] }
export interface EvidenceEntity extends EvidenceFinding { name: string; kind: 'person' | 'organization' | 'place' | 'program' | 'other' }
export interface EvidenceFrameworkQuestion extends EvidenceFinding { framework: 'ACH' | 'starbursting' }
export interface EvidenceRequest {
  schemaVersion: typeof EVIDENCE_ANALYSIS_VERSION
  tasks: EvidenceTask[]
  excerpts: EvidenceExcerpt[]
  questions?: EvidenceQuestion[]
  corrections?: string[]
}

const taskSet = new Set<EvidenceTask>(['questions', 'claims', 'entities', 'framework_questions'])
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export function parseEvidenceRequest(value: unknown): EvidenceRequest | null {
  if (!isObject(value) || value.schemaVersion !== EVIDENCE_ANALYSIS_VERSION || !Array.isArray(value.tasks)
    || value.tasks.length < 1 || value.tasks.length > 4 || !value.tasks.every(task => taskSet.has(task))
    || new Set(value.tasks).size !== value.tasks.length || !Array.isArray(value.excerpts)
    || value.excerpts.length < 1 || value.excerpts.length > EVIDENCE_LIMITS.excerpts) return null
  const excerpts = value.excerpts as unknown[]
  if (!excerpts.every(row => isObject(row) && typeof row.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(row.id)
    && typeof row.text === 'string' && row.text.trim().length >= 20 && row.text.length <= 1_500
    && (row.section === undefined || typeof row.section === 'string' && row.section.length <= 120)
    && (row.questionId === undefined || typeof row.questionId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(row.questionId)))) return null
  if (new Set(excerpts.map(row => (row as EvidenceExcerpt).id)).size !== excerpts.length
    || excerpts.reduce<number>((sum, row) => sum + (row as EvidenceExcerpt).text.length, 0) > EVIDENCE_LIMITS.excerptChars) return null
  const questions = value.questions === undefined ? [] : value.questions
  if (!Array.isArray(questions) || questions.length > EVIDENCE_LIMITS.questions
    || (value.tasks.includes('questions') && questions.length < 1)
    || !questions.every(row => isObject(row) && typeof row.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(row.id)
      && typeof row.question === 'string' && row.question.trim().length >= 5 && row.question.length <= EVIDENCE_LIMITS.questionChars)
    || new Set(questions.map(row => (row as EvidenceQuestion).id)).size !== questions.length) return null
  const corrections = value.corrections === undefined ? [] : value.corrections
  if (!Array.isArray(corrections) || corrections.length > EVIDENCE_LIMITS.corrections
    || !corrections.every(row => typeof row === 'string' && row.length <= EVIDENCE_LIMITS.correctionChars)) return null
  return { schemaVersion: EVIDENCE_ANALYSIS_VERSION, tasks: value.tasks as EvidenceTask[],
    excerpts: excerpts as EvidenceExcerpt[], questions: questions as EvidenceQuestion[], corrections: corrections as string[] }
}

export function validateEvidenceResult(request: EvidenceRequest, value: unknown): {
  answers: EvidenceAnswer[]; claims: EvidenceFinding[]; entities: EvidenceEntity[]; frameworkQuestions: EvidenceFrameworkQuestion[]
} | null {
  if (!isObject(value)) return null
  if ((request.tasks.includes('claims') && !Array.isArray(value.claims))
    || (request.tasks.includes('entities') && !Array.isArray(value.entities))
    || (request.tasks.includes('framework_questions') && !Array.isArray(value.frameworkQuestions))) return null
  const source = new Map(request.excerpts.map(row => [row.id, row.text]))
  const quotesFor = (candidate: unknown): EvidenceQuote[] => {
    if (!Array.isArray(candidate)) return []
    return candidate.filter((quote): quote is EvidenceQuote => isObject(quote)
      && typeof quote.evidenceId === 'string' && typeof quote.text === 'string'
      && quote.text.trim().length >= 20 && quote.text.length <= 500
      && source.has(quote.evidenceId)
      && normalize(source.get(quote.evidenceId)!).includes(normalize(quote.text))).slice(0, 3)
  }
  const answers: EvidenceAnswer[] = []
  if (request.tasks.includes('questions')) {
    if (!Array.isArray(value.answers)) return null
    for (const question of request.questions ?? []) {
      const row = value.answers.find((candidate: unknown) => isObject(candidate) && candidate.id === question.id)
      if (!isObject(row) || !['answered', 'partial', 'open', 'conflicted'].includes(String(row.status))
        || typeof row.answer !== 'string') return null
      const quotes = quotesFor(row.quotes)
      // A claim of an answer without an exact source excerpt is unusable.
      const status = (row.status === 'answered' || row.status === 'partial') && !quotes.length ? 'conflicted' : row.status
      answers.push({ id: question.id, status: status as EvidenceAnswer['status'],
        answer: status === 'conflicted' && !quotes.length ? 'No matching source evidence was returned.' : row.answer.slice(0, 900), quotes })
    }
  }
  const findings = (candidate: unknown, limit: number): EvidenceFinding[] => Array.isArray(candidate)
    ? candidate.slice(0, limit).flatMap((row: unknown) => {
      if (!isObject(row) || typeof row.text !== 'string' || !row.text.trim()) return []
      const quotes = quotesFor(row.quotes)
      return quotes.length ? [{ text: row.text.trim().slice(0, 500), quotes }] : []
    }) : []
  const claims = request.tasks.includes('claims') ? findings(value.claims, 20) : []
  const entities = request.tasks.includes('entities') && Array.isArray(value.entities)
    ? value.entities.slice(0, 30).flatMap((row: unknown) => {
      if (!isObject(row) || typeof row.name !== 'string' || !row.name.trim()
        || !['person', 'organization', 'place', 'program', 'other'].includes(String(row.kind))) return []
      const quotes = quotesFor(row.quotes)
      if (!quotes.length || !quotes.some(quote => normalize(quote.text).includes(normalize(row.name as string)))) return []
      return [{ name: row.name.trim().slice(0, 120), kind: row.kind as EvidenceEntity['kind'],
        text: typeof row.text === 'string' ? row.text.trim().slice(0, 500) : '', quotes }]
    }) : []
  const frameworkQuestions = request.tasks.includes('framework_questions') && Array.isArray(value.frameworkQuestions)
    ? value.frameworkQuestions.slice(0, 12).flatMap((row: unknown) => {
      if (!isObject(row) || !['ACH', 'starbursting'].includes(String(row.framework))
        || typeof row.text !== 'string' || !row.text.trim().endsWith('?')) return []
      const quotes = quotesFor(row.quotes)
      return quotes.length ? [{ framework: row.framework as EvidenceFrameworkQuestion['framework'],
        text: row.text.trim().slice(0, 500), quotes }] : []
    }) : []
  return { answers, claims, entities, frameworkQuestions }
}
