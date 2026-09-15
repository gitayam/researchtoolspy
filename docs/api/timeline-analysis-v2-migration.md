# Migrating to `timeline-analysis.v2`

`timeline-analysis.v2` is **not yet served**. `POST /api/tools/extract-timeline` still requires and returns `timeline-analysis.v1`, and capability discovery still advertises `timeline-analysis.v1` only. The roadmap gates release on review of the [JSON Schema](./schemas/timeline-analysis.v2.schema.json), the v1 compatibility behaviour, evidence-locator semantics, and this guide. Nothing an existing consumer receives has changed. No action is required today; this document exists so the contract can be reviewed before it is offered.

## Why v2 exists

v1 states an event's time as one `eventDate` plus a three-value `datePrecision` of `year`, `month` or `day`. That shape cannot express a timestamp finer than a day, a named timezone, a bounded interval, an approximate (circa) date, a purely relative placement, or an explicit unknown. It also cannot hold disagreement: when two sources date the same event differently, v1 has one field, so one claim is discarded silently.

v2 replaces the pair with a temporal claim and a list of source assertions. Two rules govern it:

1. **Recorded precision is preserved, never upgraded.** A point carries the precision its source stated, and its text must match that precision — `1979` at year precision is valid, `1979-04-02` at year precision is not. Nothing promotes a year to a day or an instant.
2. **Disagreement is retained, not resolved.** Every assertion keeps its own claim. An analyst's `workingTime` is an additional layer that cites the assertions it rests on and never edits them, so the disagreement it was chosen from stays inspectable.

## Shape

```json
{
  "id": "e1",
  "title": "Content update deployed",
  "description": null,
  "category": "event",
  "importance": "high",
  "assertions": [
    { "id": "e1-a1", "sourceRef": "vendor-pir", "claim": { "kind": "instant", "at": { "value": "2024-07-19T04:09:00.000", "precision": "millisecond", "timezone": "UTC" } },
      "locator": { "kind": "text-quote", "exact": "at 04:09 UTC" } },
    { "id": "e1-a2", "sourceRef": "press-report", "claim": { "kind": "instant", "at": { "value": "2024-07-19", "precision": "day" } } }
  ],
  "workingTime": { "claim": { "kind": "instant", "at": { "value": "2024-07-19T04:09:00.000", "precision": "millisecond", "timezone": "UTC" } },
    "citesAssertionIds": ["e1-a1"], "rationale": "Vendor post-incident review is the primary record" }
}
```

A claim is one of `instant`, `interval`, `relative` or `unknown`. An absent `timezone` means the source did not state one, which is **not** the same as UTC — v2 never infers a zone. `approximate: true` marks a circa date. `displayText` preserves the source's own wording for display while the `value` carries the normalised form used for sorting.

### Why an unknown time must say which unknown it is

`unknown` carries a required `basis`, because the reasons are not interchangeable and
flattening them loses the fact worth keeping:

| `basis` | Means | Why it is not the others |
|---|---|---|
| `not_asked` | The question was never put | Silence is not an answer. An account that never covered a topic must never read as one that omitted it. |
| `declined` | Asked, and the answer was withheld | A positive act with its own weight. Recording it as ignorance misstates what happened. |
| `not_recalled` | Asked, and the person stated they do not know | A claim *about memory*, and evidence in its own right. |
| `not_recorded` | An answer may exist; our source does not capture it | Separates a gap in our record from a gap in theirs. |

This is the roadmap's own rule — *"Not observed" must remain different from "observed
absent" and "not collected"* — applied to accounts rather than collection. It matters most
where a timeline is assembled from testimony: *"he never mentioned the weapon"* means
nothing if nobody asked him about the weapon.

`unknownIsInformative(basis)` distinguishes the two that tell you something about the
person (`declined`, `not_recalled`) from the two that tell you something about the process
(`not_asked`, `not_recorded`). Projection to v1 omits the event either way — v1 has no
representation for any of them — but the reported loss names the basis, so a v1 consumer
can tell a refusal from an unasked question rather than seeing an undifferentiated gap.

A caveat that belongs in the contract rather than a UI guideline: none of these is a
credibility signal. Inconsistency and gaps are ordinary features of truthful accounts, and
any consumer that scores or ranks people on them is misusing the field.

### Evidence locators

A locator says where in the retrieved source a claim came from. Prefer `text-quote`: it survives reformatting. `text-position` offsets are only meaningful against the exact retrieved content they were computed from, so they should not be stored against content that may be re-fetched. `page` and `media-timestamp` cover paginated and time-based sources.

## v1 compatibility

**Lifting v1 → v2** is total and lossless. The single v1 date becomes one assertion attributed to the analysed article. No `workingTime` is set, because v1 records no analyst choice and inventing one would present a machine-extracted date as a reviewed judgement. Implementation: `liftV1EventToV2` in `functions/api/_shared/timeline-contract-v2-compat.ts`.

**Projecting v2 → v1** is lossy by construction, and every loss is reported rather than absorbed. `projectV2ToV1` returns `{ events, losses }`:

| Case | v1 behaviour | Reported as |
|---|---|---|
| `relative` or `unknown` time | Event is **omitted** — v1 has no date to carry, and one is not invented | `omitted-no-date` |
| Hour/minute/second/millisecond point | Truncated to the calendar day, not rounded | `precision-reduced` |
| Named timezone | Dropped; v1 has no field for it | `timezone-dropped` |
| `approximate: true` | Value survives, qualifier does not — a v1 consumer reads it as exact | `approximation-dropped` |
| Competing assertions | Collapse to `workingTime`, else the earliest assertion | `variants-discarded` |

`projectionMisleads(projection)` is true when the losses include `approximation-dropped` or `variants-discarded`. Those two are qualitatively different from the rest: a reduced precision or a dropped zone makes the answer coarser, but a dropped approximation makes an uncertain date *look certain*, and discarded variants make a contested date *look settled*. A caller that must serve v1 should surface or log those cases rather than pass them through silently.

Relabelling a v1 response as v2 is not a migration, and neither is the reverse: the schemas reject each other's `schemaVersion`.

## Sorting

`eventSortKey` derives a deterministic key from calendar text alone: a year sorts at the start of that year. This is ordering, not a claim about the time — callers needing a conservative window should use the calendar temporal helpers instead. Events with no usable point sort last, deterministically, rather than being dropped.

## What is still open

The endpoint, capability discovery, request validation and the model prompt are unchanged; only the contract, its compatibility layer and the schema exist. Wiring any of them is a separate change, and per the roadmap v2 should remain a compute contract rather than quietly creating an artifact — resource-oriented artifact and job routes belong in their own API design review.
