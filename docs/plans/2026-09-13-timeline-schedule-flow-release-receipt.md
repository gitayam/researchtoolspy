# Automatic presentation schedule

The [timeline](https://researchtools.net/dashboard/tools/timeline) now offers automatic spacing when presentation scheduling is enabled: local today, 09:00 and a 15-minute interval initially. An explicit arrival or other time override moves following automatic times; adjust the interval or reset an override to reconnect the flow. Today/Tomorrow shortcuts and compact date editing remain available.

Calendar arithmetic handles midnight, leap days and year rollover without timezone conversion. Recorded timestamps keep their precision; backward anchors warn that TimelineJS sorts chronologically. These are presentation assumptions, not travel durations or a before/after constraint solver. Original backups and saved snapshots remain unchanged; closing the dialog resets settings. TL-17 remains partial and TL-13 planning is not delivered.

Accepted source `89c33f1e9b00b1072d0253657b29a3add0195d77` is on both main refs and deployed as `0c6011ec-377f-40be-ac09-0de0b7e195a8` at [the accepted build](https://0c6011ec.researchtoolspy.pages.dev). Exactly 51 distinct checks passed: 24 browser-project checks and 27 contracts, plus five type checks, frontend/worker builds and the compiled production-schema gate. The final focused cases count once. The [JSON receipt](./2026-09-13-timeline-schedule-flow-release-receipt.json) records exact identities and evidence hashes; prior stage counts are historical, not current proof.

The first focused run had two iframe-Escape test timeouts after product assertions. The test now closes through the parent control. A small mobile wrap correction keeps Today/Tomorrow together. Bounded native providers and independent review verified the final source, runtime and all 155 package files.

Prebuilt publication used `--no-bundle`. Thirty read-only checks passed at each deployment and production URL. All 14 tables, 386 catalog rows, 13 migrations and secret names are unchanged. Public renderer and security bytes match the baseline, so no new edge-script replay was needed. No API or schema changes were introduced.

Previous deployment `bbe5b500-a461-4e93-b230-5dfe6b9f94d2` retains independent schedule overrides and reads the same saved data, but lacks automatic propagation. Visual review is representative, not exhaustive accessibility certification or user testing; the full unrelated API suite is not claimed. Primary checkout untouched.
