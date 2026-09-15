# Clock mapping and extraction v2

Two slices complete TL-06. The [timeline Analyst view](https://researchtools.net/dashboard/tools/timeline) gains **Map a relative sequence to recorded anchors**, and `timeline-analysis.v2` is defined behind its release gate without being served.

## Anchor mapping, delivered

A relative sequence has no calendar position of its own. It acquires one only from host anchors an analyst supplies, and the panel makes that explicit: choose host events that carry a recorded date, say how far into the sequence each one sits, and read the resolved `T+0` window with projected steps.

Every result is a window rather than an instant, which is the point. An anchor recorded as `1979` constrains its sequence to somewhere in 1979; reporting a step as `1979-04-02T14:30Z` would manufacture precision the record never had. Agreement between anchors narrows the window but never refines what either record said, so a day-precision anchor inside a year-precision one still reports year precision. An approximate anchor marks every step it places approximate, so the circa work carries through: a circa host cannot yield exact-looking children.

Anchors that disagree produce a conflict naming both events, and the copy says the disagreement is not averaged away. That is deliberate — the failure mode worth guarding is a view that quietly picks one anchor and looks authoritative.

The panel is a derived view. No workspace version, no codec change, no persistence, and no path that writes to recorded events, matching the contract timing and overlap review already hold.

## Extraction v2, defined and gated

The roadmap gates this: release `timeline-analysis.v2` only after its JSON Schema, v1 compatibility behaviour, evidence-locator semantics and migration guide are reviewed. `timeline-analysis.v1` is public and advertised through capability discovery, so all four artifacts exist and none are served. Every file is new; `POST /api/tools/extract-timeline` still requires and returns v1, capability discovery still advertises v1 only, and no route imports the v2 modules.

v1 flattens time: one `eventDate` and a three-value precision cannot express a sub-day instant, a named timezone, a bounded interval, a circa date, a relative placement or an explicit unknown, and a single field cannot hold disagreement — when two sources date an event differently, one claim is discarded silently. v2 replaces the pair with a temporal claim and a list of source assertions. Recorded precision is preserved and never upgraded; disagreement is retained rather than resolved, and a working time cites the assertions it rests on without editing them.

Projection back to v1 reports every loss instead of absorbing it. Relative and unknown times are omitted rather than given an invented date; sub-day precision truncates; named zones drop; competing variants collapse. `projectionMisleads()` singles out two of the five, because they differ in kind: a reduced precision makes an answer coarser, but a dropped approximation makes an uncertain date look certain and discarded variants make a contested date look settled.

The schema is enforced rather than merely published. Ajv compiles it inside the contract spec and asserts that what the implementation produces validates, and that a precision/value mismatch, an assertion-less event, an uncited working time and a v1 `schemaVersion` are each rejected. See the [JSON Schema](../api/schemas/timeline-analysis.v2.schema.json) and the [migration guide](../api/timeline-analysis-v2-migration.md).

**TL-06 is now delivered.** Calendar diagnostics, precision-preserving date entry, intervals, overlap and timing review, durable interval history, circa dates, behaviour time domains, clock mapping and extraction v2 are all in place.

## Verification, and what it does not cover

Accepted source `9516dcd99` is on both main refs and deployed as `2cac6638` at [the accepted build](https://2cac6638.researchtoolspy.pages.dev). Production returns HTTP 200 and zero managed migrations were pending, so no production data was touched. The anchor-mapping strings are present in the deployed asset.

Checks: 41 chromium cases across the v2 contracts, `timeline-fixtures` (which validates the **v1** schema and confirms v1 is untouched), the anchor-mapping browser and contract specs, circa contracts and the timeline tool UI; plus 7 anchor-mapping contracts and 5 anchor-mapping browser cases in their own runs. Both TypeScript roots pass — `tsc -b` for the app and `tsconfig.functions.json` for Functions, neither of which covers the other, which matters because the v2 modules live under `functions/`. Vite build clean. Lint delta zero on every touched file, measured against a stashed baseline rather than read as a raw count.

Limits, stated rather than implied. Checks ran under host Playwright, not the pinned credential-free network-none container earlier tranches in this series used; no mobile-safari project, no light/dark desktop/mobile captures, no independent package-file review. **Live contract enforcement was not verified end to end**: `extract-timeline` checks authentication before schema validation, so probing it needs a service credential that was not available. The code path and the deployed bundle were inspected instead, which is weaker evidence and should not be read as equivalent.

One correction worth recording. A check labelled "v2 not served" was run against the deployed bundle and did not return empty: `deploy.sh` rsyncs `functions/` wholesale, so the v2 module file is uploaded. The accurate claim is narrower — the file is present but unreachable, because `_shared/` files are not routes under Pages Functions file-path routing and no route imports it, confirmed against `_routes.json`.
