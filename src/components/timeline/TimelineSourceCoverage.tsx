import { FileSearch, MessageSquare, ShieldAlert, ThumbsUp } from 'lucide-react'
import { timelineSourceCoverage } from '@/lib/timeline-evidence'
import type { TimelineEvidence, TimelineWorkspaceEvent } from '@/types/timeline-workspace'

/** Read-only counts of linked records; never a credibility or independence score. */
export function TimelineSourceCoverage({ evidence, event }: { evidence?: TimelineEvidence; event: TimelineWorkspaceEvent }) {
  const counts = timelineSourceCoverage(evidence, event.id)
  return <section aria-label={`Source coverage for ${event.title}`} className="mt-3 min-w-0 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h4 className="inline-flex items-center gap-2 font-semibold"><FileSearch aria-hidden="true" className="h-4 w-4" />Source coverage</h4>
      <span>{counts.sourceCount} recorded {counts.sourceCount === 1 ? 'source' : 'sources'} · {counts.assertionCount} linked {counts.assertionCount === 1 ? 'assertion' : 'assertions'}</span>
    </div>
    <dl className="flex flex-wrap gap-2 text-xs font-medium">
      <div className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2 py-1.5 text-teal-950 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100"><ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" /><dt>Supports</dt><dd>{counts.supports}</dd></div>
      <div className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"><ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" /><dt>Contradicts</dt><dd>{counts.contradicts}</dd></div>
      <div className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100"><MessageSquare aria-hidden="true" className="h-3.5 w-3.5" /><dt>Context</dt><dd>{counts.context}</dd></div>
    </dl>
    <p className={counts.activeSupports ? 'text-slate-700 dark:text-slate-200' : 'font-medium text-amber-800 dark:text-amber-200'}>{counts.activeSupports ? `${counts.activeSupports} active supporting ${counts.activeSupports === 1 ? 'assertion' : 'assertions'}` : 'No active supporting assertion.'}</p>
    {(counts.retracted > 0 || counts.withdrawnAncestrySupports > 0) && <p className="text-xs text-slate-600 dark:text-slate-300">{[
      counts.retracted > 0 ? `${counts.retracted} linked ${counts.retracted === 1 ? 'assertion is' : 'assertions are'} retracted` : '',
      counts.withdrawnAncestrySupports > 0 ? `${counts.withdrawnAncestrySupports} supporting ${counts.withdrawnAncestrySupports === 1 ? 'assertion has' : 'assertions have'} retracted ancestry` : '',
    ].filter(Boolean).join(' · ')}</p>}
    <p className="text-xs text-slate-600 dark:text-slate-300">Role counts include retracted records. Recorded sources do not imply independent confirmation. Inspect the evidence trail below.</p>
  </section>
}
