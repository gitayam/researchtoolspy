# Temporal coverage release receipt

Date: 2026-09-15

The analyst timeline now shows a compact Temporal coverage card alongside the
existing contents and review controls. It counts recorded day, month and year
precision, recorded intervals, relative and position-only placement, and events
without a recorded date. Counts intentionally describe independent signals and
may overlap; presentation scheduling is not treated as recorded evidence.

This is a UI-only TL-06 slice. It adds no schema, API, persistence, export or
sharing behavior. Circa dates, clock mappings and extraction v2 remain pending.

Validation: full workspace TypeScript checks, production build and `git diff
--check` passed in the integration workspace.
