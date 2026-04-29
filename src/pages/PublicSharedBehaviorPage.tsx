/**
 * PublicSharedBehaviorPage
 *
 * Renders a behavior analysis stored via the signal-bot's `!bcw` round-trip
 * (POST /api/frameworks/behavior/intake). Public, no auth — the UUID in
 * the URL is the access token.
 *
 * Route: /shared/behavior/:id
 *
 * Fetches /api/frameworks/behavior/shared/<id> and renders the JSON
 * payload as readable HTML. Supports the four payload kinds:
 *   - 'l1': L1 Behavior Analysis (8 wiki sections)
 *   - 'frame': Operational Frame (direction + measurement plan)
 *   - 'l2': COM-B Diagnosis (audience-specific)
 *   - 'pipeline': L1 + Frame combined
 *
 * Closes the C-6 round-trip path: signal-bot's analysis URL now points
 * at a human-readable view instead of raw JSON.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

interface SharedAnalysisResponse {
  id: string
  source: 'signal-bot' | 'bcw-mcp' | 'mcp-other'
  payload_kind: 'l1' | 'frame' | 'l2' | 'pipeline'
  payload: any
  source_user_hint?: string
  created_at: number
  expires_at: number
  view_count: number
}

const COMB_LABELS: Record<string, string> = {
  physical_capability: 'Physical Capability',
  psychological_capability: 'Psychological Capability',
  physical_opportunity: 'Physical Opportunity',
  social_opportunity: 'Social Opportunity',
  reflective_motivation: 'Reflective Motivation',
  automatic_motivation: 'Automatic Motivation',
}

const DECISION_TYPE_ICONS: Record<string, string> = {
  goal_formation: '🎯',
  intention: '✅',
  action_plan: '📋',
  coping_plan: '🛡',
  initiation: '🚀',
  persistence: '🔄',
  identity: '🪪',
  maintenance: '⚙',
  disengagement: '🚪',
  administrative_gate: '📄',
}

function formatExpiry(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function PublicSharedBehaviorPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SharedAnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setError('No analysis ID in URL')
      setLoading(false)
      return
    }
    fetch(`/api/frameworks/behavior/shared/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error('Analysis not found. The link may be wrong.')
        if (r.status === 410) throw new Error('Analysis expired. Run a fresh `!bcw` to recreate.')
        if (!r.ok) throw new Error(`Server error (${r.status})`)
        return r.json()
      })
      .then((j: SharedAnalysisResponse) => {
        setData(j)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="text-slate-500">Loading analysis…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-red-600">Could not load analysis</h1>
        <p className="mt-2 text-slate-700">{error ?? 'Unknown error'}</p>
        <p className="mt-4 text-sm text-slate-500">
          Analyses are stored via the Signal bot's <code className="rounded bg-slate-100 px-1 py-0.5">!bcw</code> command and expire after 30 days by default.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900">
            {data.payload_kind === 'l1' && 'Behavior Analysis (L1)'}
            {data.payload_kind === 'frame' && 'Operational Frame'}
            {data.payload_kind === 'l2' && 'COM-B Diagnosis (L2)'}
            {data.payload_kind === 'pipeline' && 'Behavior Analysis + Operational Frame'}
          </h1>
          <span className="text-xs text-slate-500">
            from {data.source}
            {data.source_user_hint ? ` · ${data.source_user_hint}` : ''}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
          <span>Saved {formatExpiry(data.created_at)}</span>
          <span>•</span>
          <span>Expires {formatExpiry(data.expires_at)}</span>
          <span>•</span>
          <span>{data.view_count} {data.view_count === 1 ? 'view' : 'views'}</span>
        </div>
      </header>

      {/* Render based on payload_kind */}
      {data.payload_kind === 'l1' && data.payload?.l1 && (
        <L1View l1={data.payload.l1} behavior={data.payload.behavior} />
      )}
      {data.payload_kind === 'pipeline' && data.payload?.l1 && data.payload?.frame && (
        <>
          <FrameView
            frame={data.payload.frame}
            behavior={data.payload.behavior}
            objective={data.payload.objective}
            l1Title={data.payload.l1?.title}
          />
          <details className="mt-8 rounded border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Full L1 Behavior Analysis (audience-agnostic reference)
            </summary>
            <div className="mt-4">
              <L1View l1={data.payload.l1} behavior={data.payload.behavior} />
            </div>
          </details>
        </>
      )}
      {data.payload_kind === 'frame' && data.payload?.frame && (
        <FrameView
          frame={data.payload.frame}
          behavior={data.payload.behavior}
          objective={data.payload.objective}
          l1Title={data.payload.l1?.title}
        />
      )}
      {data.payload_kind === 'l2' && data.payload?.l2 && (
        <L2View
          diagnosis={data.payload.l2}
          recommendations={data.payload.recommendations}
          behavior={data.payload.behavior}
          audience={data.payload.audience}
          objective={data.payload.objective}
        />
      )}

      <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-slate-500">
        <p>
          Source: Michie, Atkins &amp; West (2014). The Behaviour Change Wheel — A Guide to Designing
          Interventions. Silverback Publishing. + TM 3-53.11 + JP 5-0.
        </p>
        <p className="mt-1">
          Wiki:{' '}
          <a
            href="https://irregularpedia.org/general/behavior-analysis"
            className="text-blue-600 hover:underline"
          >
            irregularpedia.org/general/behavior-analysis
          </a>
        </p>
      </footer>
    </div>
  )
}

// ─── Section views ─────────────────────────────────────────────────────────

function L1View({ l1, behavior }: { l1: any; behavior?: string }) {
  return (
    <div className="space-y-6">
      <Section title={l1.title || behavior || 'Untitled Behavior'}>
        {l1.description && <p className="text-slate-700">{l1.description}</p>}
      </Section>

      <Section title="§1 Basic Information">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {l1.specificLocations?.length > 0 && (
            <Field label="Locations">
              {l1.specificLocations.join(' · ')}{' '}
              <span className="text-slate-500">({l1.geographicScope})</span>
            </Field>
          )}
          {l1.behaviorSettings?.length > 0 && (
            <Field label="Settings">{l1.behaviorSettings.join(' · ')}</Field>
          )}
          {l1.frequency && <Field label="Frequency">{l1.frequency}</Field>}
          {l1.typicalDuration && <Field label="Duration">{l1.typicalDuration}</Field>}
          {l1.complexity && (
            <Field label="Complexity">{String(l1.complexity).replace(/_/g, ' ')}</Field>
          )}
        </dl>
        {l1.eligibility?.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Eligibility
            </div>
            <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
              {l1.eligibility.map((e: any, i: number) => (
                <li key={i}>
                  <span className="font-medium">{e.type}:</span> {e.requirement}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {l1.timeline?.length > 0 && (
        <Section title="§2 Behavior Timeline (goal-oriented decisions)">
          <ol className="space-y-3">
            {l1.timeline.map((t: any) => (
              <li key={t.step} className="rounded border border-slate-200 bg-white p-3">
                <div className="font-semibold">
                  {DECISION_TYPE_ICONS[t.decisionType] ?? '◽'} Step {t.step}: {t.label}
                  {t.location && (
                    <span className="ml-2 text-xs font-normal text-slate-500">[{t.location}]</span>
                  )}
                  <span className="ml-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-normal italic text-slate-600">
                    {String(t.decisionType).replace(/_/g, ' ')}
                  </span>
                </div>
                {t.description && <p className="mt-1 text-sm text-slate-700">{t.description}</p>}
                {t.psychologicalState && (
                  <div className="mt-1 text-xs text-slate-500">
                    state: {t.psychologicalState.stage} · {t.psychologicalState.phase} ·{' '}
                    {t.psychologicalState.motivationMode}
                  </div>
                )}
                {t.comBTarget && (
                  <div className="mt-1 text-xs text-slate-500">
                    COM-B target: {COMB_LABELS[t.comBTarget] ?? t.comBTarget}
                  </div>
                )}
                {t.copingBranches?.length > 0 && (
                  <ul className="mt-1 list-inside text-xs text-slate-600">
                    {t.copingBranches.map((cb: any, i: number) => (
                      <li key={i}>
                        🛡 if "{cb.obstacle}" → {cb.response}
                      </li>
                    ))}
                  </ul>
                )}
                {t.forks?.length > 0 && (
                  <ul className="mt-1 list-inside text-xs text-slate-600">
                    {t.forks.map((f: string, i: number) => (
                      <li key={i}>↪ {f}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {l1.environmentalFactors?.length > 0 && (
        <Section title="§3 Environmental Factors">
          <BulletList items={l1.environmentalFactors} />
        </Section>
      )}

      {l1.socialCulturalContext?.length > 0 && (
        <Section title="§4 Social & Cultural Context">
          <BulletList items={l1.socialCulturalContext} />
        </Section>
      )}

      {l1.consequences?.length > 0 && (
        <Section title="§5 Consequences & Outcomes">
          <ul className="space-y-1">
            {l1.consequences.map((c: any, i: number) => (
              <li key={i} className="text-sm text-slate-700">
                <span className="mr-2 text-xs font-semibold uppercase text-slate-500">
                  ({c.timeframe?.replace(/_/g, '-')}, {c.valence})
                </span>
                {c.description}
                {c.whoIsAffected && (
                  <div className="ml-6 text-xs text-slate-500">→ affects: {c.whoIsAffected}</div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {l1.symbols?.length > 0 && (
        <Section title="§6 Symbols & Signals">
          <ul className="space-y-1">
            {l1.symbols.map((s: any, i: number) => (
              <li key={i} className="text-sm">
                <span className="font-semibold">{s.name}</span>{' '}
                <span className="text-xs text-slate-500">[{s.type}]</span>
                {s.description && <span className="text-slate-700"> — {s.description}</span>}
                {s.context && <span className="ml-2 text-xs text-slate-500">({s.context})</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {l1.observedPatterns?.length > 0 && (
        <Section title="§7 Observed Patterns">
          <BulletList items={l1.observedPatterns} />
        </Section>
      )}

      {l1.potentialAudiences && (
        <Section title="§8 Potential Target Audiences (direction-leverage)">
          {l1.potentialAudiences.increaseLeverage?.length > 0 && (
            <div>
              <div className="font-semibold text-emerald-700">
                ↑ Leverage candidates IF goal becomes to INCREASE
              </div>
              <ul className="mt-1 space-y-1">
                {l1.potentialAudiences.increaseLeverage.map((a: any, i: number) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{a.name}</span> — {a.rationale}
                    {a.comBHypothesis && (
                      <span className="ml-2 text-xs text-slate-500">
                        suspected: {a.comBHypothesis}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {l1.potentialAudiences.decreaseLeverage?.length > 0 && (
            <div className="mt-3">
              <div className="font-semibold text-rose-700">
                ↓ Leverage candidates IF goal becomes to DECREASE
              </div>
              <ul className="mt-1 space-y-1">
                {l1.potentialAudiences.decreaseLeverage.map((a: any, i: number) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{a.name}</span> — {a.rationale}
                    {a.comBHypothesis && (
                      <span className="ml-2 text-xs text-slate-500">
                        suspected: {a.comBHypothesis}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

function FrameView({
  frame,
  behavior,
  objective,
  l1Title,
}: {
  frame: any
  behavior?: string
  objective?: string
  l1Title?: string
}) {
  const dirIcon: Record<string, string> = {
    increase: '↑',
    decrease: '↓',
    shift: '🔄',
    introduce: '✨',
  }
  return (
    <div className="space-y-6">
      <Section title={l1Title || behavior || 'Operational Frame'}>
        <p className="text-lg font-semibold">
          {dirIcon[frame.direction]} {frame.direction?.toUpperCase()} —{' '}
          {frame.objectiveRestated || objective}
        </p>
      </Section>

      {frame.desiredBehavior && (
        <Section title="🎯 Desired audience behavior">
          <p className="text-base font-medium">{frame.desiredBehavior.title}</p>
          {frame.desiredBehavior.description && (
            <p className="mt-1 text-slate-700">{frame.desiredBehavior.description}</p>
          )}
          {frame.desiredBehavior.deltaFromReference && (
            <p className="mt-1 text-xs text-slate-500">
              {String(frame.desiredBehavior.deltaFromReference).replace(/_/g, ' ')} of L1 reference
            </p>
          )}
          {frame.direction === 'shift' && frame.desiredBehavior.substituteFor && (
            <p className="mt-1 text-xs text-slate-500">
              substituting for: {frame.desiredBehavior.substituteFor}
            </p>
          )}
        </Section>
      )}

      {frame.baseline && (
        <Section title={`📊 Current baseline (${frame.baseline.confidence} confidence)`}>
          {frame.baseline.currentRateEstimate && <p>{frame.baseline.currentRateEstimate}</p>}
          {frame.baseline.measurementMethod && (
            <p className="mt-1 text-sm text-slate-600">
              📐 How to measure: {frame.baseline.measurementMethod}
            </p>
          )}
        </Section>
      )}

      {frame.measurement && (
        <Section title="📈 Measurement plan (Michie-primary)">
          {frame.measurement.behaviorIndicators?.length > 0 && (
            <Subsection title="Behavior frequency indicators">
              <BulletList items={frame.measurement.behaviorIndicators} />
            </Subsection>
          )}
          {frame.measurement.comBShiftIndicators?.length > 0 && (
            <Subsection title="COM-B shift indicators">
              <BulletList items={frame.measurement.comBShiftIndicators} />
            </Subsection>
          )}
          {frame.measurement.outcomeIndicators?.length > 0 && (
            <Subsection title="Outcome indicators">
              <BulletList items={frame.measurement.outcomeIndicators} />
            </Subsection>
          )}
          {(frame.measurement.moeCandidates?.length > 0 ||
            frame.measurement.mopCandidates?.length > 0) && (
            <Subsection title="📡 DOD framing (JP 5-0)">
              <ul className="space-y-0.5">
                {frame.measurement.moeCandidates?.map((m: string, i: number) => (
                  <li key={`moe-${i}`} className="text-sm">
                    <span className="font-mono text-xs font-semibold">MOE:</span> {m}
                  </li>
                ))}
                {frame.measurement.mopCandidates?.map((m: string, i: number) => (
                  <li key={`mop-${i}`} className="text-sm">
                    <span className="font-mono text-xs font-semibold">MOP:</span> {m}
                  </li>
                ))}
              </ul>
            </Subsection>
          )}
        </Section>
      )}

      {frame.operationalSoWhat && (
        <Section title="🔗 Operational so-what">
          <p>{frame.operationalSoWhat}</p>
        </Section>
      )}

      {frame.filteredAudienceCandidates?.length > 0 && (
        <Section title={`🎯 Audience candidates for ${dirIcon[frame.direction]}`}>
          <ol className="space-y-2">
            {frame.filteredAudienceCandidates.map((a: any, i: number) => (
              <li key={i} className="text-sm">
                <span className="font-semibold">{a.name}</span> — {a.rationale}
                {a.comBHypothesis && (
                  <div className="ml-6 text-xs text-slate-500">
                    → suspected: {a.comBHypothesis}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {frame.warnings?.length > 0 && (
        <Section title="⚠ Warnings">
          <ul className="space-y-1">
            {frame.warnings.map((w: string, i: number) => (
              <li key={i} className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {w}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function L2View({
  diagnosis,
  recommendations,
  behavior,
  audience,
  objective,
}: {
  diagnosis: any
  recommendations: any
  behavior?: string
  audience?: string
  objective?: string
}) {
  const dirIcon: Record<string, string> = {
    increase: '↑',
    decrease: '↓',
    shift: '🔄',
    introduce: '✨',
  }
  return (
    <div className="space-y-6">
      <Section title={diagnosis.behaviorRestated || behavior || 'COM-B Analysis'}>
        <dl className="space-y-1">
          <Field label="Audience">{audience || '—'}</Field>
          {objective && <Field label="Objective">{objective}</Field>}
          {diagnosis.direction && (
            <Field label="Direction">
              {dirIcon[diagnosis.direction]} {diagnosis.direction.toUpperCase()}
            </Field>
          )}
          {diagnosis.desiredBehavior && (
            <Field label="Desired audience behavior">{diagnosis.desiredBehavior}</Field>
          )}
        </dl>
      </Section>

      {diagnosis.audienceBaseline?.estimatedRate && (
        <Section title={`📊 Audience baseline (${diagnosis.audienceBaseline.confidence})`}>
          <p>{diagnosis.audienceBaseline.estimatedRate}</p>
          {diagnosis.audienceBaseline.measurementMethod && (
            <p className="mt-1 text-sm text-slate-600">
              📐 Measure via: {diagnosis.audienceBaseline.measurementMethod}
            </p>
          )}
        </Section>
      )}

      {diagnosis.behaviorDelta && (
        <Section title="📐 Behavior delta">
          <dl className="space-y-1">
            {diagnosis.behaviorDelta.currentState && (
              <Field label="Current">{diagnosis.behaviorDelta.currentState}</Field>
            )}
            {diagnosis.behaviorDelta.desiredState && (
              <Field label="Desired">{diagnosis.behaviorDelta.desiredState}</Field>
            )}
            {diagnosis.behaviorDelta.gapDescription && (
              <Field label="Gap">{diagnosis.behaviorDelta.gapDescription}</Field>
            )}
          </dl>
        </Section>
      )}

      <Section title="COM-B Diagnosis">
        <ul className="space-y-2">
          {Object.entries(diagnosis.deficits || {}).map(([k, v]: [string, any]) => {
            const sevIcon = v === 'major_barrier' ? '🚨' : v === 'deficit' ? '⚠️' : '✅'
            const note = diagnosis.perComponent?.[k]
            if (v === 'adequate' && !note) return null
            return (
              <li key={k} className="rounded border border-slate-200 bg-white p-3 text-sm">
                <div className="font-semibold">
                  {sevIcon} {COMB_LABELS[k]} — {String(v).replace(/_/g, ' ')}
                </div>
                {note && <p className="mt-1 text-slate-700">{note}</p>}
              </li>
            )
          })}
        </ul>
        {diagnosis.primaryDriver && (
          <div className="mt-3 rounded bg-blue-50 px-3 py-2 text-sm">
            <span className="font-semibold">🎯 Primary driver:</span> {diagnosis.primaryDriver}
          </div>
        )}
      </Section>

      {diagnosis.directionAwareLeverage?.length > 0 && (
        <Section title={`Direction-aware leverage (${diagnosis.direction?.toUpperCase()})`}>
          <ul className="space-y-2">
            {diagnosis.directionAwareLeverage.map((l: any, i: number) => {
              const pIcon = l.interventionPriority === 'high' ? '🚨' : l.interventionPriority === 'medium' ? '⚠️' : '◽'
              return (
                <li key={i} className="rounded border border-slate-200 p-3 text-sm">
                  <div className="font-semibold">
                    {pIcon} [{String(l.interventionPriority).toUpperCase()}]{' '}
                    {COMB_LABELS[l.component] ?? l.component}
                  </div>
                  {l.interventionImplication && (
                    <p className="mt-1 text-slate-700">{l.interventionImplication}</p>
                  )}
                  {l.hypothesizedLever && (
                    <p className="mt-1 text-xs text-slate-500">Lever: {l.hypothesizedLever}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {diagnosis.audienceSpecificMoe?.length > 0 && (
        <Section title="📈 Audience-specific MOE candidates">
          <BulletList items={diagnosis.audienceSpecificMoe} />
        </Section>
      )}

      {recommendations?.recommendations?.length > 0 && (
        <Section title="Canon recommendations (BCW Guide Tables 2.3 + 2.9)">
          <ul className="space-y-2">
            {recommendations.recommendations.map((rec: any, i: number) => {
              const fnNames = rec.interventions
                .map((iv: any) =>
                  iv.function
                    .split('_')
                    .map((w: string) => w[0]?.toUpperCase() + w.slice(1))
                    .join(' '),
                )
                .join(' · ')
              const sevIcon = rec.severity === 'major_barrier' ? '🚨' : '⚠️'
              return (
                <li key={i} className="text-sm">
                  {sevIcon} <span className="font-semibold">{COMB_LABELS[rec.component]}</span>:{' '}
                  {fnNames}
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </div>
  )
}

// ─── Primitives ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-slate-900">{title}</h2>
      <div className="text-slate-800">{children}</div>
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}:</span>{' '}
      <span className="text-sm">{children}</span>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc space-y-0.5 text-sm">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
