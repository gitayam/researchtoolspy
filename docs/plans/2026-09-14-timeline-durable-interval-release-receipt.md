# Durable recorded intervals

Signed-in users can save recorded intervals to a private workspace, reopen them, and inspect earlier single-date or interval revisions. Adding or removing an interval preserves the artifact and object identity; old revisions retain their exact format. A retry sends the original prepared snapshot even after current edits change format. Historical preview and downloads leave current edits unchanged.

Runtime `240252f08a210a59993dcd24cabfc947681ae131` is on both main branches and deployed as `355ab8b0-6ad0-48fa-8998-822f0ffa73a0` at [the accepted build](https://355ab8b0.researchtoolspy.pages.dev). All 107 planned project checks, five type checks, frontend/worker builds and compiled human/service interval checks passed. Both live URLs passed 37 read-only smoke checks. This stage does not claim a new captured-edge browser replay or unrelated full-suite validation.

Migration 0015 was rehearsed atomically against the actual production 0014 schema with populated synthetic history, failed DDL/tracker rollback, retry and exact old payload/replay preservation. Production now has 15 applied migrations and 15 monitored tables. Existing metadata and catalogs passed pre/post checks; no research payload was read for production preservation checks. [Detailed receipt](./2026-09-14-timeline-durable-interval-release-receipt.json) records evidence, failures and recovery.

Canonical snapshots remain limited to 60 KiB and requests to 64 KiB. Guests remain local; private intervals do not enter automatic drafts after opening. Prior application versions may refuse v2 history, so keep migration 0015 and roll forward compatible code. Circa dates, clock mappings and extraction v2 remain pending; TL-06 and TL-17 are partial.
