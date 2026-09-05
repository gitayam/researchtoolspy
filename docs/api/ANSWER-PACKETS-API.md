# Answer Packets API

Answer Packets turn persisted source analysis into an investigation-scoped answer whose material claims point to exact passages in the stored source. These endpoints require managed migration `0007_answer_packet_storage.sql`.

## Trust and authorization model

- All endpoints require `X-User-Hash` or a supported bearer credential.
- Creation requires ownership of the selected `content_analysis` row and `EDITOR` access to its workspace.
- The investigation must belong to the same workspace as the analysis.
- List and detail reads require `VIEWER` access to the packet workspace.
- A supported or disputed claim must cite at least one exact excerpt. The API returns `422 excerpt_not_found` when any supplied excerpt is not a verbatim substring of `content_analysis.extracted_text`.
- An insufficient claim cannot carry evidence. Use `collection_gaps` to record what should be collected next.
- A detail read reconstructs and validates the stored claim -> link -> passage -> artifact graph. Broken lineage returns `409`, not a partially trusted answer.

Legacy Content Intelligence rows do not record complete scraper version/quality provenance. Promotion labels those fields `legacy-content-analysis.unknown`; it does not infer or invent them.

## Create a grounded packet

`POST /api/answer-packets`

```json
{
  "analysis_id": 42,
  "investigation_id": "investigation-uuid",
  "question_id": "research-question-uuid",
  "question": "When did the operation begin?",
  "answer": "The source says the operation began Tuesday.",
  "claims": [
    {
      "statement": "The operation began Tuesday.",
      "status": "supported",
      "confidence": 0.9,
      "evidence": [
        {
          "excerpt": "The operation began Tuesday.",
          "stance": "supports",
          "relevance": 1,
          "confidence": 0.95,
          "rationale": "The source states the timing directly."
        }
      ]
    }
  ],
  "limitations": ["The source gives no calendar date."],
  "collection_gaps": ["Find independent confirmation."],
  "expires_at": null
}
```

`question_id`, `limitations`, `collection_gaps`, and `expires_at` are optional. Confidence and relevance values use the inclusive `0..1` interval. Promotion is deliberately bounded to 25 claims, 10 evidence passages per claim, 25 passages total, and 50 entries in each limitations/gaps list.

Success returns `201` with the validated `packet`, `artifact`, `passages`, and `links` objects. Persistence is one transactional D1 batch, including the `content_analysis.source_artifact_id` bridge.

Common errors:

| Status | Meaning |
|---:|---|
| `400` | Invalid request, score, status, stance, or evidence cardinality |
| `401` | Authentication required |
| `403` | User lacks editor access to the workspace |
| `404` | Owned analysis or same-workspace investigation was not found |
| `409` | Analysis lacks a writable workspace, source text, or valid content hash |
| `422` | At least one citation is not an exact stored source passage |

## List packets for an investigation

`GET /api/answer-packets?investigation_id=<id>`

Returns up to 100 packets newest-first, including `claim_count`. The supplied investigation is the authorization boundary; arbitrary workspace IDs are not accepted.

## Read a packet with evidence lineage

`GET /api/answer-packets/<packet-id>`

Returns:

```json
{
  "packet": {},
  "artifact": {},
  "passages": [],
  "links": []
}
```

Every `packet.claims[].evidenceLinkIds[]` resolves to a returned link, every link resolves to a returned passage, and every passage resolves to the packet's primary artifact. Consumers should display citations from returned passage text and source identity rather than regenerating excerpts from the answer.

## Release prerequisite

Before deploying the handlers, apply migration `0007` through the backed-up managed migration workflow in [`../operations/D1_MIGRATIONS.md`](../operations/D1_MIGRATIONS.md), then verify all five tables, three nullable legacy bridge columns, and `answer_packets.primary_artifact_id`.
