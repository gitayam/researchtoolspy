import { useState } from 'react'
import { TimelineJSPreview } from './TimelineJSPreview'
import { Download, FileJson, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { buildTimelineJSExport } from '@/lib/timeline-timelinejs'
import type { TimelineWorkspaceExport } from '@/types/timeline-workspace'

type SnapshotInput = Omit<TimelineWorkspaceExport, 'exportedAt'>

function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function TimelineJSExport({ snapshot, savedRevision }: { snapshot: SnapshotInput & { exportedAt?: string }; savedRevision?: { revisionId: string; sequence: number } }) {
  const [preview, setPreview] = useState<{
    snapshot: TimelineWorkspaceExport
    signature: string
    result: ReturnType<typeof buildTimelineJSExport>
  } | null>(null)
  const [presenting, setPresenting] = useState(false)
  const signature = JSON.stringify(snapshot)
  const stale = preview !== null && signature !== preview.signature
  const capture = () => {
    setPresenting(false)
    const captured = { ...structuredClone(snapshot), exportedAt: savedRevision && snapshot.exportedAt ? snapshot.exportedAt : new Date().toISOString() }
    setPreview({ snapshot: captured, signature, result: buildTimelineJSExport(captured) })
  }
  const download = (companion: boolean) => {
    if (!preview || stale || (!companion && preview.result.timeline.events.length === 0)) return
    const suffix = `${savedRevision ? `revision-${savedRevision.sequence}-` : ''}${preview.snapshot.exportedAt.replace(/[:.]/g, '-')}`
    downloadJson(companion ? preview.snapshot : preview.result.timeline, `timeline-${companion ? 'researchtools' : 'timelinejs'}-${suffix}.json`)
  }

  return <Dialog open={preview !== null} onOpenChange={open => { if (open) capture(); else { setPreview(null); setPresenting(false) } }}>
    <DialogTrigger asChild><Button variant="outline"><FileJson aria-hidden="true" className="mr-2 h-4 w-4" />{savedRevision ? 'Preview saved revision' : 'Export TimelineJS'}</Button></DialogTrigger>
    {preview && <DialogContent className={`flex max-h-[90dvh] w-[calc(100%-1.5rem)] flex-col rounded-xl border-indigo-200 bg-white p-4 text-slate-950 sm:p-6 dark:border-indigo-800 dark:bg-slate-950 dark:text-slate-100 ${presenting && !stale ? 'h-[95dvh] max-h-[95dvh] max-w-6xl' : 'max-w-2xl'}`}>
      <DialogHeader className="shrink-0 pr-6 text-left">
        <DialogTitle className="flex items-center gap-2 text-xl"><FileJson aria-hidden="true" className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />{savedRevision ? 'Saved revision preview' : 'TimelineJS export preview'}</DialogTitle>
        <DialogDescription className="text-slate-600 dark:text-slate-300">{savedRevision ? `Saved revision ${savedRevision.sequence} · Selected narrative. This does not publish a timeline.` : presenting && !stale ? 'Selected narrative · This does not publish a timeline.' : 'A presentation file of your selected narrative. Downloads stay on this device; this does not publish a timeline.'}</DialogDescription>
      </DialogHeader>
      {presenting && !stale ? <>
        <Button variant="outline" className="w-fit shrink-0" onClick={() => setPresenting(false)}>Back to export details</Button>
        <TimelineJSPreview timeline={preview.result.timeline} snapshot={preview.snapshot} />
      </> : <>
      <div className="min-h-0 space-y-4 overflow-y-auto" aria-label="Export details" role="region" tabIndex={0}>
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950">
        <h3 className="break-words font-semibold">{preview.snapshot.analystWorkspace.narrative?.title || 'Untitled narrative'}</h3>
        <p className="mt-1 text-sm">{preview.result.timeline.events.length} exportable · {preview.result.selectedCount} selected · {preview.result.omitted.length} omitted</p>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{savedRevision ? 'Captured from the last successfully saved or opened revision. Current unsaved edits are excluded. Both files use this same saved snapshot.' : 'Captured from the open workspace, including unsaved edits. Both files use this same snapshot.'}</p>
      </div>
      {savedRevision && <p className="break-all text-xs text-slate-600 dark:text-slate-300">Revision ID: {savedRevision.revisionId}</p>}
      {stale && <div role="alert" className="rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
        <p>The workspace changed after this preview. Refresh it before downloading.</p>
        <Button className="mt-2 bg-indigo-700 text-white hover:bg-indigo-800" onClick={capture}>Refresh export preview</Button>
      </div>}
      <section aria-label="Presentation limitations" className="space-y-2 text-sm">
        <h3 className="flex items-center gap-2 font-semibold"><TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-700 dark:text-amber-300" />What changes in TimelineJS</h3>
        <ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">{preview.result.notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul>
      </section>
      {preview.result.omitted.length > 0 && <details className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40" open>
        <summary className="cursor-pointer font-semibold">Omitted events ({preview.result.omitted.length})</summary>
        <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">{preview.result.omitted.map(item => <li key={item.eventId} className="break-words"><strong>{item.title}</strong><span className="block text-slate-700 dark:text-slate-300">{item.reason}</span></li>)}</ul>
      </details>}
      {preview.result.timeline.events.length === 0 && <p role="status" className="text-sm font-medium">Select at least one event with a recorded absolute date to export TimelineJS.</p>}
      </div>
      <div className="shrink-0 space-y-1">
        <Button variant="outline" className="w-full border-indigo-400 text-indigo-800 dark:text-indigo-200" disabled={stale || preview.result.timeline.events.length === 0 || preview.result.timeline.events.length > 100} onClick={() => setPresenting(true)}>Open presentation</Button>
        {preview.result.timeline.events.length > 100 && <p className="text-xs text-slate-600 dark:text-slate-300">Presentation supports up to 100 dated events. Narrow your narrative selection; JSON downloads retain all eligible events.</p>}
      </div>
      <div className="grid shrink-0 gap-3 border-t border-slate-200 pt-4 dark:border-slate-700 sm:grid-cols-2">
        <div className="space-y-2">
          <Button className="w-full bg-indigo-700 text-white hover:bg-indigo-800" disabled={stale || preview.result.timeline.events.length === 0} onClick={() => download(false)}><Download aria-hidden="true" className="mr-2 h-4 w-4" />Download TimelineJS JSON</Button>
          <p className="text-xs text-slate-600 dark:text-slate-300">For a TimelineJS renderer. Cannot restore a ResearchTools workspace.</p>
        </div>
        <div className="space-y-2">
          <Button variant="outline" className="w-full border-slate-400 bg-white text-slate-950 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800" disabled={stale} onClick={() => download(true)}>Download ResearchTools JSON</Button>
          <p className="text-xs text-slate-600 dark:text-slate-300">Complete backup, including unselected events, evidence and review history. Keep it for reimport.</p>
        </div>
      </div>
      </>}
    </DialogContent>}
  </Dialog>
}
