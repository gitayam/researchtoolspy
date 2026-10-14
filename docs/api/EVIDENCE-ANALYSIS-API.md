# Evidence analysis service API

`evidence-analysis.v1` is a stateless, quote-grounded analysis operation for scoped community services. It lets clients reuse ResearchTools' model routing and analytical framework prompts while retaining their own records and publication review. It does not ingest, save, index, publish, or scrape supplied text. The service-auth `last_used_at` stamp and model metering are the only writes.

Discover `capabilities.evidenceAnalysis === true`, `contractVersions.evidenceAnalysis === "evidence-analysis.v1"`, and `community.research.execute` before calling it. The capability requires `COMMUNITY_INTEGRATIONS_ENABLED=true`, `EVIDENCE_ANALYSIS_SERVICE_ENABLED=true`, a model key, and a valid scoped service principal.

```http
POST /api/research/analyze-evidence
Authorization: Bearer rt_svc_<client-id>.<secret>
X-Correlation-ID: dta-meeting-<opaque-id>
Content-Type: application/json
```

```json
{
  "schemaVersion": "evidence-analysis.v1",
  "tasks": ["questions", "claims", "entities", "framework_questions"],
  "questions": [{ "id": "trend", "question": "Did police find a trend in the call figures?" }],
  "excerpts": [{ "id": "E1", "questionId": "trend", "section": "Calls for service", "text": "The presenter said the figures were broadly balanced..." }],
  "corrections": ["The earlier activity note used a disputed month-to-month comparison."]
}
```

The response returns arrays `answers`, `claims`, `entities`, and `frameworkQuestions`. Each answer has the requested ID, status `answered|partial|open|conflicted`, short answer and up to three `{evidenceId,text}` quotes. Claims are atomic assertions, including attributed concerns rather than conclusions about their truth. Entities include `name`, `kind`, description and quotes. Framework questions use `ACH` or `starbursting` and point to the excerpt that prompted the gap. Every returned quote is checked against the supplied excerpt after whitespace normalization. Unsupported claims and entities are dropped; answers without a matching quote are downgraded to `conflicted`. Clients should still apply their own domain checks and human review before publication.

Request limits: 64 KiB UTF-8 JSON body, 36,000 excerpt characters, 200 excerpts, 12 questions, 12 corrections. Each excerpt is at most 1,500 characters. Responses are not cached or persisted and carry `Cache-Control: no-store`. Errors use `integration-error.v1`. This endpoint does not accept workspace IDs, source URLs, or caller-selected model names. Use Content Intelligence's public URL analysis for public web scraping; keep private source text on this scoped endpoint. Existing claim and entity persistence workflows remain separate, explicit user actions.
