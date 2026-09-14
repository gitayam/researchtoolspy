# Timeline presentation readability

The [timeline presentation](https://researchtools.net/dashboard/tools/timeline) now starts its story near the top in a readable column, with clearer date, title and body typography. Squeezed adjacent headlines are removed while arrows and 44-pixel navigation controls remain. Compact marker and axis labels stay within their regions, and the bounded dialog and quieter toolbar leave more room for the story.

Full titles and provenance remain reachable in the story and accessible list. Scheduling, original backups, saved snapshots, chronological positions and zoom/pan behavior are retained. This is a presentation UI repair: TL-17 remains partial and TL-13 planning is not delivered.

Accepted source `0bdb3590887d054cd2f5e2737c42cc34e5e63122` is on both main refs and deployed as `11685fa7-7411-4ba2-895b-1dd4e8d6e3d3` at [the accepted build](https://11685fa7.researchtoolspy.pages.dev). Exactly 53 distinct checks passed: 26 browser-project checks and 27 contracts, plus five type checks, frontend/worker builds and the compiled production-schema gate. The final focused cases count once. The [JSON receipt](./2026-09-14-timeline-presentation-ui-release-receipt.json) records exact identities and evidence hashes; prior stage counts are historical, not current proof.

Dense 20-event desktop/mobile and light/dark evidence was reviewed alongside existing full-heading, date, provenance, navigation and backup checks. Bounded native providers and independent review verified the final source, runtime and all 155 package files. The first visual pass missed an upstream desktop next-arrow offset; zeroed icon margins and explicit desktop bounds/hover checks corrected it. An initial mobile short-story viewport regression was repaired by tightening header and typography spacing without weakening the existing full-text oracle. A subsequent focused test incorrectly required upstream-hidden mobile side arrows; the test now verifies that responsive behavior alongside the native 44-pixel controls. Both failed runs are preserved; all 53 accepted checks and four reviewed captures use the final source.

Prebuilt publication used `--no-bundle`. Thirty read-only checks passed at each deployment and production URL. All 14 tables, 386 catalog rows, 13 migrations and secret names are unchanged. Public changes are limited to preview.css and generated HTML style blocks. All HTML outside those blocks, scripts, fonts, vendor assets, CSP and headers match the baseline; independent style review and exact live owned-byte checks support omitting a fresh edge-script replay. No API or schema changes were introduced.

Previous deployment `0c6011ec-377f-40be-ac09-0de0b7e195a8` retains automatic scheduling and reads the same saved data, but lacks these presentation readability repairs. Visual review is representative, not exhaustive accessibility certification or user testing; the full unrelated API suite is not claimed. Primary checkout untouched.

## Subsequent deployment

The [timing review release](./2026-09-14-timeline-timing-review-release-receipt.md) adds transient recorded calendar-placement diagnostics while preserving presentation, automatic scheduling, backups and saved data. This receipt retains historical presentation-readability validation.
