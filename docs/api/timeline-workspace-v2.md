# Local interval workspaces

`timeline-workspace.v2` adds an optional `recordedEnd` calendar label to analyst events. The existing `eventDate`, `eventTime`, and `datePrecision` describe the start. The source extraction and original event remain unchanged. The shared strict decoder in `src/lib/timeline-workspace-codec.ts` is the authoritative local import validator.

```json
{
  "eventDate": "2026-09",
  "datePrecision": "month",
  "recordedEnd": { "date": "2026-10", "precision": "month" }
}
```

This fragment describes inclusive recorded months, not exact midnight timestamps. It belongs inside an otherwise complete v2 workspace event. End labels require `date` and may include matching `precision` (`year`, `month`, or `day`) and `time` (`HH:mm` or `HH:mm:ss`). A clock requires a complete day at either endpoint. New endpoint entry uses real Gregorian dates in years 1000–9999. Import retains the existing start-date validator, including valid legacy starts before year 1000; recorded ends require years 1000–9999. Unknown start dates, empty ends, unsupported fields, and definitely reversed intervals are rejected. Overlapping endpoint precision remains uncertain; the calendar core retains a conservative possible extent without claiming a duration.

The editor offers **Record an end date**. Fields start empty; no current date is substituted. Save validates the whole interval before applying it. Cancel preserves the event. Clearing the checkbox removes the end only when saved. End edits participate in evidence-review freshness checks, while retained review history and source extraction remain unchanged.

Exports use v2 whenever a recorded end exists and v1 otherwise. The v1 decoder rejects interval fields; relabeling a v2 file as v1 is not a migration. Removing all interval ends explicitly allows a v1 export again. The browser similarly uses `timeline-browser-draft.v2` for interval drafts and v1 for existing drafts. A v1 draft containing interval fields is preserved for recovery rather than silently accepted. Local drafts remain subject to the existing expiration and replacement behavior; export JSON to keep a lasting backup.

Private workspace saving/history currently accepts only v1. Interval saves are blocked before an upload, and the server rejects v2 payloads submitted as v1 objects. Existing saved revisions remain readable. Retrying a previously prepared save sends that earlier snapshot, not later interval edits. This release makes no change to artifact kinds, database schema, or service discovery.

TimelineJS presentation currently omits interval events with an explicit reason, including when a temporary schedule is enabled. Other supported events can still be presented. The complete ResearchTools JSON backup retains every interval. No endpoint is silently discarded to make an event exportable. Native TimelineJS endpoint rendering and versioned durable interval snapshots are subsequent stages.
