# Timeline corpus rubric v1

This is a frozen **synthetic contract regression corpus**, as of 2026-09-11. It is not analyst-reviewed historical gold or a measured extraction-quality benchmark. No publisher was contacted. Source URLs identify fictional fixtures; retrieval timestamps and publisher timezones are null because neither exists. Full fixture text is in `fixtures.json`; manifest provenance and usage constraints apply to every case.

The deterministic suite feeds frozen model payloads to the actual normalizer and route. It checks required event preservation, calendar precision, duplicate removal, rejection counts, valid empty output, invalid-output separation, supplied provenance and reference-client compatibility. These tests measure normalization/transport behavior, not model recall. Source quotes in `requiredAssertions` are fixture annotations, not fields returned by v1.

For a future separately authorized model evaluation, preserve exact source bytes, model/version/prompt parameters, retrieval/data-through timestamps and raw outputs. Review and version gold assertions before measuring:

| Metric | Definition | Current status |
|---|---|---|
| Required event recall | Matched required assertions / all required assertions; report numerator and denominator | Pending real model run and analyst review; roadmap target >=90% |
| False events | Returned events with no supported source assertion / returned events | Pending; empty denominator is N/A, never 100% |
| Date/precision accuracy | Matched required events preserving accepted date and precision / matched required events | Pending; false precision is an error; roadmap target >=98% |
| Source attribution | Required events linked to correct originating source / matched required events | Pending; v1 has article provenance only, no event-level locator; roadmap target >=95% |
| Duplicate reduction | Baseline duplicate count minus output duplicate count, divided by baseline duplicates | Only exact date/title normalizer regression covered; cross-source target >=30% pending |
| Incorrect merges | Incorrectly merged distinct event pairs / all merged pairs | Pending cross-source identity; roadmap target <2% |
| Unsupported narrative statements | Unsupported factual narrative statements / all factual narrative statements | N/A to extraction v1; pending narrative evidence capability |

Use exact date/title fixture identity only in deterministic tests. Future semantic matching requires a reviewed annotation rule and disagreements recorded independently, rather than automatic fuzzy matching disguised as gold. Required versus optional assertions must be explicit. Never score omitted/unsupported capabilities as passing, use publication time as occurrence time, treat derivative sources as corroboration, or score uncollected data as observed absence.

Later corpus versions must add circular reporting, conflicting timestamps, corrections, observed absence versus missing collection, judgment changes and reviewed technique records; planning/comparison/composition and Signal/RSS lineage cases remain pending in the manifest. A live demonstration is separately labeled and cannot overwrite these frozen fixtures.
