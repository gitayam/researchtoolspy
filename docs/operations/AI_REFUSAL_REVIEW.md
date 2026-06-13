# AI Function Refusal & Content-Policy Review

**Date:** 2026-06-13
**Scope:** Deception detection + all server-side AI/LLM call sites (~35 endpoints), assessed for provider content-policy refusal risk.
**Provider today:** OpenAI `gpt-5.4-mini` (+ `-nano`) via Cloudflare AI Gateway (`functions/api/_shared/ai-gateway.ts`), with automatic fallback to direct OpenAI.

## TL;DR
- **Deception detection is fully functional** (SATS: MOM/POP/MOSES/EVE + RageCheck, AI-scored, aggregated, exported). The only deception stub is the `// TODO: Implement deep deception analysis endpoint` button in `ClaimAnalysisDisplay.tsx:556`.
- On **OpenAI (current)**, most analytical functions pass; refusal exposure is concentrated in a small **Tier-1** set (individual-surveillance + operational-targeting + unbounded generation).
- On **Anthropic (if ever routed there)**, the whole intel/security cluster (**Tier-2**) gates heavily — the `agent-reliability` Surface Hopping measurements put Anthropic refusal at ~65% on a security-class corpus vs 0% for Mistral/Gemini.
- **Refusals are not handled as refusals today** — a model refusal returns 200 with a refusal string, fails `JSON.parse`, and surfaces as a generic `502/500 "AI returned invalid JSON"`. No refusal detection, no provider routing, no defensive-framing prompt.

## Refusal-risk tiers (assuming the feature is functional)

### Tier 1 — refusal-prone on *any* provider (incl. OpenAI)
| Function | File | Policy category |
|---|---|---|
| Entity summarization + relationship inference on **named private individuals** | `content-intelligence/summarize-entity.ts`, `relationships/infer-type.ts` | PII profiling / doxxing |
| OSINT-on-people: persona/social scrape → LLM summarize; `pimeyes`/`reverse_image`/`geoguessr` task types | COP scrapers + entity summarizers | Surveillance of individuals (also Apify/PimEyes **ToS + legal** exposure, separate from LLM) |
| **CARVER** target-vulnerability + **COG** `generate-vulnerabilities` | `ai/cog-analysis.ts` | Operational attack-planning framing |
| `ai/generate` — arbitrary user prompt, no system guardrail, direct OpenAI, no rate limit | `ai/generate.ts:127` | Unbounded misuse |

### Tier 2 — analytical/intel: passes OpenAI, ~65% refused on Anthropic
`ai/behavior-analysis` (adversary means/intent), `ai/cog-analysis` (suggest/validate), `intelligence/synthesis` + `predictions`, `dime-analyze`, `pmesii-pt/import-url`, `equilibrium-analysis`, `hamilton-rule`, `ach/generate-hypotheses`.

**Special flag:** `extract-claim-entities.ts:60-79` hardcoded political-bias credibility scores ("Politicians with partisan bias: −30 to −40", "government agencies: +30 to +40"). This is both a refusal/defamation risk and an **analytic-integrity flaw** — it bakes a political prior into "objective" scoring, and "government = trustworthy" is a poor default for a *deception* tool. **(Fixed 2026-06-13 — replaced with stake/independence/proximity factors.)**

### Tier 3 — low risk (generic NLP)
summarize, generate-title/questions/timeline, keyphrases, topics, sentiment, SWOT/Starbursting, survey + cross-table. The deception/rage-check *detection* functions are defensive (spotting manipulation) and generally pass.

## The handling gap (now partially fixed)
`callOpenAIViaGateway` returned the raw model response; a refusal looked identical to malformed output. **Fixed 2026-06-13:**
- Added `detectRefusal()` (conservative, anchored signatures for OpenAI- and Anthropic-style refusals) in `ai-gateway.ts`.
- The gateway now annotates `response._refusal = true` and logs `[AI Gateway] model refusal detected` distinctly (observability — ties to TD-03).
- `tools/rage-check.ts` now checks `_refusal` and returns a clean `200 { declined: true, reason }` instead of an opaque 502.

## Recommendations (remaining)
1. **Adopt the `_refusal` check in the other Tier-1/2 callers** (claims/analyze, cog-analysis, behavior-analysis, intelligence/*) — the gateway already flags it; callers just need to branch.
2. **Shared defensive-framing system-prompt prefix** for Tier-2 intel functions ("analyst supporting authorized defensive/educational analysis…") — lowers refusal rate without changing behavior.
3. **Provider routing / Surface Hopping**: if any intel function is ever moved to Claude, route it to a permissive surface (Mistral/Vibe or Gemini) or keep it on OpenAI. Don't switch the Tier-2 cluster to Anthropic blindly.
4. **Gate Tier-1 behind explicit auth + ToS ack**, and re-evaluate PimEyes/face-match and any remaining identity-profiling features on policy + legal grounds.
