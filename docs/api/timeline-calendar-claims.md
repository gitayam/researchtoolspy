# Calendar claims for timeline integration

The internal `timeline-calendar-claim.v1` contract in `src/lib/timeline-temporal.ts` provides validated calendar labels and conservative extents for TL-06. Existing timing review consumes the same calendar calculation. This is not an extraction API capability or a workspace import format. Existing v1 backups, extraction responses, and source assertion text retain their current contracts.

A claim preserves `displayText` separately from normalized values. Its `kind` is `date`, `interval`, `relative`, or `unknown`; every claim carries `schema: "timeline-calendar-claim.v1"`. Date claims carry `value`; intervals carry `start` and `end`. Each calendar label has a `date`, optional matching `precision` (`year`, `month`, `day`), and optional `time` (`HH:mm` or `HH:mm:ss`) only for a complete day. Relative claims carry `relation` (`before` or `after`) and `anchorEventId`. Unknown claims have no date fields. Parsing rejects unknown fields and malformed Gregorian dates rather than coercing them.

```json
{
  "schema": "timeline-calendar-claim.v1",
  "kind": "interval",
  "displayText": "During March through April 2026",
  "start": { "date": "2026-03", "precision": "month" },
  "end": { "date": "2026-04", "precision": "month" }
}
```

Both endpoint labels are inclusive recorded units. This example covers March 1 through the end of April, represented computationally as a half-open extent ending May 1. A year-only label covers its entire year; a minute-only clock covers its entire minute. Missing components are not newly recorded facts. Numeric bounds use UTC calendar setters solely to produce deterministic coordinates; they do not establish a timezone or UTC instant.

Overlapping endpoint ranges retain their full possible extent. For example, a start of `2026` and end of `2026-03` spans the union's outer bounds, with unresolved endpoint ordering. The result is a conservative envelope, not a certain duration or proof that the event occupied every moment. Definitely reversed endpoints are invalid. Relative and unknown claims return unresolved reasons and never acquire dates from narrative position or the current clock.

Call `parseCalendarTemporalClaim` at an unknown input boundary. `temporalClaimBounds` also validates runtime inputs. `calendarLabelBounds` is the existing timing-review compatibility seam and distinguishes missing from invalid dates. The core accepts years 0001–9999; existing authoring and workspace restrictions remain unchanged, including the UI's minimum year of 1000. The exclusive boundary after year 9999 is an internal coordinate only.

Named timezones, instants, circa semantics, relative offsets, endpoint-order diagnostics, persisted intervals, and extraction/workspace v2 remain future work. Before interval authoring, version the persisted contract, retain source variants and original wording, and prove round trips through import, history, services, and presentation exports.
