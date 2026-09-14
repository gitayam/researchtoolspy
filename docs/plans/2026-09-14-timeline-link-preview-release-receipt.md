# Shared presentation link previews

Shared presentation URLs now serve a bounded title, description and dedicated timeline image in initial HTML for browsers and link crawlers. The sharing review shows the same frozen presentation summary and static image before publication. Metadata excludes private workspace fields and event assessments.

Unavailable or revoked links show a generic unavailable preview. Chat applications may retain cached previews after revocation; revocation cannot retract those copies. The 1200×630 PNG contains no user content.

Runtime `1cf5520c7fffc136925f427207591a30c0f0118b` is on both main branches and deployed as `aacd67a1-bc41-434f-8e7a-e0434d4eb705` at [the accepted build](https://aacd67a1.researchtoolspy.pages.dev). All 29 planned project checks, five type checks, frontend/worker builds and compiled schema/link-preview gates passed. Both live URLs passed 45 read-only smoke checks, including the exact static card bytes and generic unavailable metadata for missing, invalid and query-bearing links. No production presentation was created to test live metadata, and no third-party chat posting is claimed.

No production migration was applied. The existing 15-migration inventory and 15 monitored tables (410 catalog rows) remain unchanged, as do secret names. Actual schema validation used already-applied 0015 mode; reconstruction rollback checks ran only against an isolated reference. [Detailed receipt](./2026-09-14-timeline-link-preview-release-receipt.json) records evidence, failures and recovery. TL-17 remains partial.
