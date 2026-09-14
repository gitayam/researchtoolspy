# Find overlapping recorded dates

The Analyst timeline now offers **Find overlapping dates**. Choose an event to compare its recorded calendar window with other events. Potential overlaps, separate dates and dates that cannot be compared remain distinct. Links focus existing event cards; queries leave the complete sequence, workspace JSON and saved presentation selections unchanged.

Partial dates and inclusive interval endpoints use conservative calendar extents. Potential overlap does not establish simultaneous occurrence, causality or evidence agreement. Missing, invalid or ambiguous dates remain unresolved. Recorded clocks are not timezone-normalized, and temporary schedules do not supply evidence dates.

Runtime `a27dbdb14e8cbbbbfcf4324a56b27350bf644b30` is on both main branches and deployed as `eb084968-896b-4051-aa5f-ea0f90edb529` at [the accepted build](https://eb084968.researchtoolspy.pages.dev). All 55 planned project checks, five type checks, frontend/worker builds and compiled schema gates passed. Both live URLs passed 37 read-only smoke checks. This stage does not claim unrelated full-suite validation or a new captured-edge replay.

No production migration was applied. The existing 15-migration inventory and 15 monitored tables (410 catalog rows) are unchanged, as are secret names. Actual schema validation used already-applied 0015 mode; reconstruction rollback checks ran only against an isolated reference. [Detailed receipt](./2026-09-14-timeline-overlap-release-receipt.json) records evidence, failures and recovery. TL-06 remains partial; circa dates, clock mappings and extraction v2 remain pending.
