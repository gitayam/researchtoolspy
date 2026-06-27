# Research Intake Form Upgrade — "paste a URL or drop a document, the form fills itself in"

**Added:** 2026-06-27 (user request) · **Status:** planned · **Roadmap:** Capability-expansion item **E**

Goal: turn `/dashboard/research/forms/new` (and the submitter experience) into a researcher-grade
intake tool — **document upload with automatic scanning, URL auto-confirm (auto-extract + verify),
rich typed fields, auto entity/claim/geo extraction, dedup, and search** — minimizing submitter effort
while maximizing structured, verified data. "Think like a researcher": paste a link or drop a PDF and
the form pre-fills metadata for you to confirm, not retype.

---

## 0. The decisive finding — there are TWO form systems; the named route is the weaker one

| | **System B** (the route to improve) | **System A** (the richer engine) |
|---|---|---|
| Builder | `/dashboard/research/forms/new` → `CreateSubmissionFormPage.tsx` (471 LOC) | **none** (no builder UI) |
| Backend | `submission_forms` / `form_submissions` | `survey_drops` / `survey_responses` |
| Fields | **fixed 9 boolean toggles** (`CreateSubmissionFormPage.tsx:27-37`, allowlisted `research/forms/create.ts:78-88`) | **dynamic `form_schema` JSON, 19 field types** incl. `file` (`src/types/cop.ts:579-596`; `survey_drops.form_schema`, migration 101) |
| Submitter page | `/submit/:hashId` (`SubmitEvidencePage.tsx`) | `/drop/:slug`, `/survey/:slug` (`PublicIntakeForm.tsx`) |
| URL handling | Wayback archive + regex metadata (`research/submit/[hashId].ts`) | **post-submit `analyze-url` enrichment** → `_enriched_<field>` (`surveys/public/[token]/submit.ts:217-273`) |
| Dedup | — | **`content_hash` + unique index → 409** (migration 101) |
| Geo / rate-limit / password / access-levels | partial | yes |

**→ DECISION D-E0 (must be made first):** build the new builder on **System A's dynamic schema** (recommended — it already has the 19 typed fields, URL enrichment, dedup, geo) and **redirect/retire System B**, OR backport System A's capabilities into System B. Everything below assumes we converge on **one** dynamic-schema engine (System A). Also fold in: the `/dashboard/research/forms` **list route is orphaned** (`SubmissionFormsPage.tsx` imported by no router → "back to forms" 404s) — fix as part of this.

---

## 1. Reusable building blocks (already in the repo — the feature stands on these)

- **URL extraction:** `content-intelligence/analyze-url.ts:46` → title/author/publish_date/extracted_text/summary/word_count/entities/claims/archive_urls/bypass_urls/content_hash (+ paywall fallback, SSRF guard). Lighter no-DB: `tools/analyze-url.ts`.
- **PDF text (works in-Worker, no external API):** `content-intelligence/pdf-extractor.ts:26 extractPDFText()` via `unpdf`; OCR fallback gated on `PDF_CO_API_KEY`.
- **Multipart parser (the only one):** `tools/extract.ts:264` `request.formData()` → File → arrayBuffer (10MB cap). (Wire its weak PDF regex to `pdf-extractor.ts`.)
- **R2 write pattern (working in code):** `feedback/submit.ts:58` `env.UPLOADS.put(...)`; `twitter-image-proxy.ts:105` stream-to-R2 + hash dedup + `.head()`. Binding `UPLOADS`=`researchtoolspy-uploads` (`wrangler.toml:32`). **No `/uploads/*` serve function exists yet.**
- **Entity/claim/timeline extraction:** `tools/extract-claims.ts`, `tools/extract-timeline.ts`, `content-intelligence/extract-claim-entities.ts`, `auto-extract-entities.ts:15` (creates `actors`, uppercase types, dedup-by-name).
- **Geocoding (works, no key; Nominatim now CSP-allowed via COP-13):** `PlaceSearch.tsx:103`, `surveys/resolve-location.ts:95`.
- **Dedup:** `analyze-url.ts:1619 calculateHash()` + `content_deduplication`; `_shared/survey-drops.ts:86 hashFormData()`.
- **Archive snapshot CREATION (not just a link):** `research/submit/[hashId].ts:41 autoArchiveUrl()` → `web.archive.org/save/${url}`.

**Only genuinely missing primitive:** EXIF/GPS extraction from uploaded images.

---

## 2. Phased plan (AUTO vs DECISION)

### Phase 0 — Foundation `DECISION + AUTO`
- **D-E0** converge on System A engine (above). **DECISION.**
- **Verify the R2 `UPLOADS` binding is dashboard-enabled** (ROADMAP **TD-08** flags writes may be silently failing — uploads depend on this; verify before building Phase 3). `AUTO` (verify) → may surface a config fix.
- Fix the orphaned `/dashboard/research/forms` list route. `AUTO`.

### Phase 1 — A real form builder `AUTO`
- Field-type builder on `form_schema`: add / rename / reorder / delete fields; per-field **type picker** (the 19 types), required toggle, options editor, help text, validation (min/max/accept). Cap 50 (existing app limit).
- **Live preview-as-submitter** + a "test submit" that doesn't persist.
- **Form templates** a researcher reaches for: OSINT tip, incident report, media/image submission, claim submission, source-document intake. (Seed `form_schema` presets.)

### Phase 2 — URL auto-confirm (interactive) `AUTO`
- On a `url` field, paste → run `analyze-url` in a fast **`quick` mode inline** → show extracted **title / author / published date / summary / archive link / detected entities + claims** in a **confirm card** (edit before accept) — not the current post-submit-only background enrichment.
- **Dedup check on paste** (`content_hash`) → "this URL was already submitted to this workspace" with a link.
- **Auto-create an archive.org snapshot** (`autoArchiveUrl`) and store the immutable snapshot URL alongside the live URL.

### Phase 3 — Document upload + automatic scanning `AUTO` (gated on Phase-0 R2 verify)
- Real **multipart → R2** submit path (parser `tools/extract.ts:264` + R2 `feedback/submit.ts:58`) replacing today's base64-in-64KB-JSON (which 413s on real docs). Add the **missing `/uploads/:key` serve function** (correct Content-Type, auth/visibility scoped).
- **Auto-scan on upload:** PDF → `pdf-extractor.ts` (`unpdf`) text; image → OCR (pdf.co fallback or Workers AI — see D-E1). Extracted text → **pre-fill** description/title + run entity/claim extraction for confirmation.
- Multi-file, drag-drop, paste, camera capture (UI already exists in `PublicIntakeForm`); per-file size cap + type allowlist; content-hash dedup of files.

### Phase 4 — Researcher intelligence + discovery `AUTO + DECISION`
- **EXIF/GPS from images** (the missing primitive) → auto-fill a `geopoint` field; strip EXIF on the served copy by default (privacy) — `DECISION D-E2` on retention/PII.
- **Auto entity/claim extraction → confirm → promote** to `evidence` / `actors` (reuse `auto-extract-entities`), so a submission becomes structured workspace data, not just a row.
- **Source-credibility scaffolding as first-class fields:** Admiralty reliability (A–F) + info credibility (1–6) — the scales ACH/evidence already use — so submissions arrive pre-rated.
- **Geocode free-text locations** (Nominatim) on confirm.
- **"What researchers search for":** full-text search over submissions' extracted content + filters (entity / date range / domain / content-type / credibility / submitter), saved searches, and a **map view** of geolocated submissions. (Today `submissions/list` has no search.)

---

## 3. Decisions to make (surfaced; don't guess)
- **D-E0** — one engine (System A dynamic schema) vs backport into System B. *(Blocks everything.)*
- **D-E1** — image OCR provider: `PDF_CO_API_KEY` (already wired as PDF fallback) vs Cloudflare Workers AI vs none. Cost + accuracy call.
- **D-E2** — uploaded-file retention + PII/EXIF policy (D1/R2 retention convention; default-strip EXIF on served copies).
- **D-E3** — anonymous public submitters uploading to R2 = abuse/cost surface; need per-form upload limits + type/size caps + the existing IP-hash rate-limit extended to uploads.

## 4. Done-when (per phase)
Each phase ships behind the existing verify gate (type-check + `@smoke`), with new tables/columns carrying a **retention cron** (project convention), R2 writes verified to actually land, and the submitter + reviewer paths prod-verified. New endpoints follow the public-share-token auth model (submitter side stays unauthenticated via opaque token + access-level; reviewer side `requireAuth`). Watch **#19** (`research/forms/list` workspace authorization) — fix it as part of touching this surface.
