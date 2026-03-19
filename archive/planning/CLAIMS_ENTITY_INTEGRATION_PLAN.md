# Claims & Entity Integration Plan
**Created:** 2025-10-11
**Status:** Planning → Implementation
**Priority:** HIGH - Critical for claims investigation workflow

---

## Problem Statement

### Current State ❌

**Claims are extracted but not normalized:**
1. Content Intelligence extracts claims from URLs (line 416 in `analyze-url.ts`)
2. Claims are analyzed for deception (line 422)
3. Claims are stored in `content_analysis.claim_analysis` as **JSON** (line 460)
4. ❌ Claims are NOT saved to `claim_adjustments` table
5. ❌ Entities mentioned in claims are NOT extracted
6. ❌ Claims are NOT linked to Actor/Event/Place entities
7. ❌ Claims cannot be used in Investigation Packets
8. ❌ Claims cannot be tracked over time per entity

**Database Schema Exists But Unused:**
- `claim_adjustments` table exists (migration 039)
- `claim_entity_mentions` table exists
- `claim_evidence_links` table exists
- `investigation_packets` table exists
- ❗ **None of these are being populated during content analysis**

### Target State ✅

**Claims should be first-class entities tied to actors:**
1. ✅ Extract claims from content (DONE)
2. ✅ Analyze for deception (DONE)
3. ✅ Save to `content_analysis.claim_analysis` as JSON (DONE for display)
4. ✅ **NEW:** Normalize each claim to `claim_adjustments` table
5. ✅ **NEW:** Extract entities mentioned in each claim
6. ✅ **NEW:** Link entities to claims via `claim_entity_mentions`
7. ✅ **NEW:** Match entities to existing Actors/Events/Places
8. ✅ **NEW:** Track claim-making patterns per actor

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────┐
│  Content Intelligence: URL Analysis          │
│  (functions/api/content-intelligence/       │
│   analyze-url.ts)                           │
└──────────────────┬──────────────────────────┘
                   │
                   ↓ Extracts Claims via GPT
┌─────────────────────────────────────────────┐
│  CLAIMS EXTRACTED                            │
│  [{claim, category, deception_analysis}]     │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ↓                     ↓
┌──────────────┐    ┌──────────────────────┐
│  Save to     │    │  NORMALIZE CLAIMS    │ ← NEW!
│  JSON field  │    │  (New Function)      │
│  (existing)  │    └──────────┬───────────┘
└──────────────┘               │
                               ↓
                ┌──────────────────────────────┐
                │  For each claim:              │
                │  1. Save to claim_adjustments │
                │  2. Extract entities from it  │
                │  3. Link entities to claim    │
                │  4. Match to existing actors  │
                └──────────────────────────────┘
```

### Database Integration

```sql
-- Current (JSON in content_analysis)
content_analysis.claim_analysis = {
  "claims": [
    {
      "claim": "Kristi Noem blamed Democrats for TSA delays",
      "category": "political_statement",
      "deception_analysis": {...}
    }
  ]
}

-- New (Normalized in claim_adjustments)
INSERT INTO claim_adjustments (
  id, content_analysis_id, claim_index, claim_text,
  original_risk_score, adjusted_by, ...
);

-- New (Entity linking)
INSERT INTO claim_entity_mentions (
  claim_adjustment_id, entity_id, entity_name, entity_type,
  role, credibility_impact
) VALUES
  ('claim-123', 'actor-456', 'Kristi Noem', 'person', 'claim_maker', -30),
  ('claim-123', 'actor-789', 'Democrats', 'political_party', 'subject', 0),
  ('claim-123', 'org-234', 'TSA', 'organization', 'affected', 0);
```

---

## Implementation Plan

### Phase 1: Normalize Claims to Database (2-3 hours)

**New API Function: `normalizeClaims()`**

```typescript
/**
 * functions/api/content-intelligence/normalize-claims.ts
 *
 * Takes claims from GPT and normalizes them to database tables
 */

interface NormalizeClaimsParams {
  content_analysis_id: number
  claims: Array<{
    claim: string
    category: string
    deception_analysis: DeceptionAnalysis
  }>
  user_id: number
  workspace_id: string
}

async function normalizeClaims(
  db: D1Database,
  params: NormalizeClaimsParams
): Promise<string[]> {
  const claimIds: string[] = []

  for (let i = 0; i < params.claims.length; i++) {
    const claim = params.claims[i]
    const claimId = `claim-${crypto.randomUUID()}`

    // 1. Save to claim_adjustments
    await db.prepare(`
      INSERT INTO claim_adjustments (
        id, content_analysis_id, claim_index, claim_text, claim_category,
        original_risk_score, original_overall_risk, original_methods,
        adjusted_by, workspace_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      claimId,
      params.content_analysis_id,
      i,
      claim.claim,
      claim.category,
      claim.deception_analysis.risk_score,
      claim.deception_analysis.overall_risk,
      JSON.stringify(claim.deception_analysis.methods),
      params.user_id,
      params.workspace_id
    ).run()

    claimIds.push(claimId)
  }

  return claimIds
}
```

**Integration Point:**

```typescript
// In analyze-url.ts, after line 422:
if (claimAnalysis && claimAnalysis.claims.length > 0) {
  // Save claims to normalized tables
  const claimIds = await normalizeClaims(env.DB, {
    content_analysis_id: analysisId,
    claims: claimAnalysis.claims,
    user_id: userId,
    workspace_id: workspaceId
  })

  console.log(`[DEBUG] Normalized ${claimIds.length} claims to database`)
}
```

**Files to Modify:**
1. ✅ Create: `functions/api/content-intelligence/normalize-claims.ts`
2. ✅ Modify: `functions/api/content-intelligence/analyze-url.ts` (add call after claim extraction)

---

### Phase 2: Extract Entities from Claims (3-4 hours)

**New API Function: `extractClaimEntities()`**

```typescript
/**
 * Uses GPT to extract entities mentioned in each claim
 */

interface ClaimEntity {
  name: string
  type: 'person' | 'organization' | 'location' | 'event' | 'political_party'
  role: 'claim_maker' | 'subject' | 'mentioned' | 'affected'
  credibility_impact: number // -50 to +50
  context: string
}

async function extractClaimEntities(
  claimText: string,
  env: Env
): Promise<ClaimEntity[]> {
  const prompt = `Analyze this claim and extract all entities mentioned:

Claim: "${claimText}"

Extract entities with the following details:
1. name - Full name of the entity
2. type - person, organization, location, event, or political_party
3. role:
   - claim_maker: Who is making this claim?
   - subject: Who/what is the claim about?
   - mentioned: Other entities mentioned
   - affected: Who is impacted by this claim?
4. credibility_impact: How does this entity affect credibility? (-50 to +50)
   - Politicians with partisan history: -30 to -40
   - Industry spokespeople: -20 to -30
   - Neutral experts: +20 to +40
   - Government agencies: +30 to +50
5. context: Brief note on why this entity is mentioned

Return JSON array of entities.`

  const response = await callOpenAIViaGateway(
    env.OPENAI_API_KEY,
    'gpt-5-mini',
    [{ role: 'user', content: prompt }],
    {
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    },
    env.AI_GATEWAY_ACCOUNT_ID
  )

  const result = JSON.parse(response.choices[0].message.content)
  return result.entities || []
}
```

**Integration:**

```typescript
// After normalizeClaims() in analyze-url.ts:
if (claimIds.length > 0) {
  // Extract entities for each claim
  for (let i = 0; i < claimAnalysis.claims.length; i++) {
    const claim = claimAnalysis.claims[i]
    const claimId = claimIds[i]

    try {
      const entities = await extractClaimEntities(claim.claim, env)

      // Save entity mentions
      for (const entity of entities) {
        await db.prepare(`
          INSERT INTO claim_entity_mentions (
            id, claim_adjustment_id, entity_id, entity_name, entity_type,
            role, context, credibility_impact, extracted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          crypto.randomUUID(),
          claimId,
          crypto.randomUUID(), // Temporary, will be matched to real actor later
          entity.name,
          entity.type,
          entity.role,
          entity.context,
          entity.credibility_impact
        ).run()
      }

      console.log(`[DEBUG] Extracted ${entities.length} entities for claim ${i}`)
    } catch (error) {
      console.error(`[DEBUG] Entity extraction failed for claim ${i}:`, error)
      // Continue with other claims
    }
  }
}
```

**Files to Create/Modify:**
1. ✅ Create: `functions/api/content-intelligence/extract-claim-entities.ts`
2. ✅ Modify: `functions/api/content-intelligence/analyze-url.ts` (add entity extraction loop)

---

### Phase 3: Match Entities to Existing Actors (2-3 hours)

**New API Function: `matchEntitiesToActors()`**

```typescript
/**
 * Matches extracted claim entities to existing actors/places/events
 */

async function matchEntitiesToActors(
  db: D1Database,
  claimId: string,
  workspaceId: string
): Promise<number> {
  let matchCount = 0

  // Get all unmatched entities for this claim
  const entities = await db.prepare(`
    SELECT id, entity_name, entity_type, role
    FROM claim_entity_mentions
    WHERE claim_adjustment_id = ?
      AND entity_id LIKE 'temp-%' -- Temporary IDs from extraction
  `).bind(claimId).all()

  for (const entity of entities.results) {
    let matchedId: string | null = null

    // Try to match to existing actors
    if (entity.entity_type === 'person' || entity.entity_type === 'organization' || entity.entity_type === 'political_party') {
      const actor = await db.prepare(`
        SELECT id FROM actors
        WHERE workspace_id = ?
          AND LOWER(name) = LOWER(?)
        LIMIT 1
      `).bind(workspaceId, entity.entity_name).first()

      matchedId = actor?.id as string
    }

    // Try to match to places
    if (!matchedId && entity.entity_type === 'location') {
      const place = await db.prepare(`
        SELECT id FROM places
        WHERE workspace_id = ?
          AND LOWER(name) = LOWER(?)
        LIMIT 1
      `).bind(workspaceId, entity.entity_name).first()

      matchedId = place?.id as string
    }

    // Try to match to events
    if (!matchedId && entity.entity_type === 'event') {
      const event = await db.prepare(`
        SELECT id FROM events
        WHERE workspace_id = ?
          AND LOWER(name) = LOWER(?)
        LIMIT 1
      `).bind(workspaceId, entity.entity_name).first()

      matchedId = event?.id as string
    }

    // Update with matched ID if found
    if (matchedId) {
      await db.prepare(`
        UPDATE claim_entity_mentions
        SET entity_id = ?
        WHERE id = ?
      `).bind(matchedId, entity.id).run()

      matchCount++
      console.log(`[DEBUG] Matched "${entity.entity_name}" to existing ${entity.entity_type} ${matchedId}`)
    }
  }

  return matchCount
}
```

**Integration:**

```typescript
// After entity extraction in analyze-url.ts:
if (claimIds.length > 0) {
  // Match extracted entities to existing actors/places/events
  let totalMatches = 0
  for (const claimId of claimIds) {
    const matches = await matchEntitiesToActors(env.DB, claimId, workspaceId)
    totalMatches += matches
  }

  console.log(`[DEBUG] Matched ${totalMatches} entities to existing actors/places/events`)
}
```

**Files to Create/Modify:**
1. ✅ Create: `functions/api/content-intelligence/match-entities.ts`
2. ✅ Modify: `functions/api/content-intelligence/analyze-url.ts` (add matching call)

---

### Phase 4: UI Integration (2-3 hours)

**Display Claim Entities in Content Intelligence Page:**

```tsx
// src/pages/tools/ContentIntelligencePage.tsx

// Add new section in Claims tab:
<div className="mt-4 space-y-2">
  {claim.entities && claim.entities.length > 0 && (
    <div>
      <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        Entities Mentioned:
      </h5>
      <div className="flex flex-wrap gap-1">
        {claim.entities.map((entity, idx) => (
          <Badge
            key={idx}
            variant={entity.role === 'claim_maker' ? 'default' : 'secondary'}
            className={`text-xs ${
              entity.credibility_impact < 0
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                : entity.credibility_impact > 0
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : ''
            }`}
          >
            {entity.role === 'claim_maker' && '👤 '}
            {entity.name}
            {entity.credibility_impact !== 0 && (
              <span className="ml-1">
                ({entity.credibility_impact > 0 ? '+' : ''}{entity.credibility_impact})
              </span>
            )}
          </Badge>
        ))}
      </div>
    </div>
  )}
</div>
```

**Add Claims Tab to Actor Profile:**

```tsx
// src/pages/entities/ActorDetailPage.tsx

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="relationships">Relationships</TabsTrigger>
    <TabsTrigger value="claims">Claims Made ({claimCount})</TabsTrigger> {/* NEW */}
    <TabsTrigger value="activity">Activity</TabsTrigger>
  </TabsList>

  <TabsContent value="claims">
    <ClaimHistoryPanel actorId={actor.id} />
  </TabsContent>
</Tabs>
```

**New Component: ClaimHistoryPanel**

```tsx
// src/components/actors/ClaimHistoryPanel.tsx

export function ClaimHistoryPanel({ actorId }: { actorId: string }) {
  const [claims, setClaims] = useState<ClaimWithAnalysis[]>([])
  const [stats, setStats] = useState({
    total: 0,
    high_risk: 0,
    medium_risk: 0,
    low_risk: 0,
    avg_risk_score: 0
  })

  // Fetch claims where this actor is claim_maker
  useEffect(() => {
    fetch(`/api/actors/${actorId}/claims`)
      .then(res => res.json())
      .then(data => {
        setClaims(data.claims)
        setStats(data.stats)
      })
  }, [actorId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim-Making History</CardTitle>
        <CardDescription>
          All claims attributed to this actor
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Claims" value={stats.total} />
          <StatCard label="High Risk" value={stats.high_risk} color="red" />
          <StatCard label="Medium Risk" value={stats.medium_risk} color="yellow" />
          <StatCard label="Avg Risk Score" value={stats.avg_risk_score} />
        </div>

        {/* Claims List */}
        <div className="space-y-3">
          {claims.map(claim => (
            <ClaimCard key={claim.id} claim={claim} showSource />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

### Phase 5: New API Endpoints (1-2 hours)

**Get Claims for Actor:**

```typescript
// functions/api/actors/[id]/claims.ts

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const actorId = params.id as string

  // Get all claims where this actor is the claim_maker
  const claims = await env.DB.prepare(`
    SELECT
      ca.id,
      ca.claim_text,
      ca.claim_category,
      ca.original_risk_score,
      ca.original_overall_risk,
      ca.verification_status,
      ca.created_at,
      c.url as source_url,
      c.title as source_title
    FROM claim_adjustments ca
    JOIN claim_entity_mentions cem ON ca.id = cem.claim_adjustment_id
    JOIN content_analysis c ON ca.content_analysis_id = c.id
    WHERE cem.entity_id = ?
      AND cem.role = 'claim_maker'
    ORDER BY ca.created_at DESC
    LIMIT 100
  `).bind(actorId).all()

  // Calculate stats
  const stats = {
    total: claims.results.length,
    high_risk: claims.results.filter(c => c.original_overall_risk === 'high').length,
    medium_risk: claims.results.filter(c => c.original_overall_risk === 'medium').length,
    low_risk: claims.results.filter(c => c.original_overall_risk === 'low').length,
    avg_risk_score: claims.results.reduce((sum, c) => sum + c.original_risk_score, 0) / claims.results.length
  }

  return new Response(JSON.stringify({ claims: claims.results, stats }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

**Get Claim Entity Details:**

```typescript
// functions/api/claims/get-claim-entities.ts (already exists!)

// Modify to return full actor/place/event data
```

---

## Success Metrics

### Technical Success:
- ✅ 100% of claims extracted are normalized to database
- ✅ 80%+ of entities matched to existing actors
- ✅ Claims queryable by entity/actor
- ✅ Actor claim history displayable
- ✅ Zero performance degradation (<100ms added per claim)

### User Success:
- ✅ Analysts can see all claims made by an actor
- ✅ Analysts can track actor credibility over time
- ✅ Claims can be added to investigation packets
- ✅ Entity-claim relationships visible in UI

---

## Implementation Order

**Week 1 (Days 1-3): Core Normalization**
- [x] Phase 1: Normalize claims to database ✅ DONE
- [x] Test with existing content analyses
- [x] Verify database writes

**Week 1 (Days 4-5): Entity Extraction**
- [x] Phase 2: Extract entities from claims
- [x] Test GPT entity extraction accuracy
- [x] Handle edge cases (ambiguous entities)

**Week 2 (Days 1-2): Entity Matching**
- [ ] Phase 3: Match entities to existing actors
- [ ] Test matching accuracy
- [ ] Handle multiple matches (disambiguation)

**Week 2 (Days 3-4): UI Integration**
- [ ] Phase 4: Display entities in claims
- [ ] Add claims tab to actor profile
- [ ] Test UX flow

**Week 2 (Day 5): API & Polish**
- [ ] Phase 5: New API endpoints
- [ ] Performance testing
- [ ] Documentation

---

## Migration Path

**For Existing Content Analyses:**

```sql
-- Run backfill script to normalize existing claims
-- functions/api/admin/backfill-claims.ts

SELECT id, claim_analysis FROM content_analysis
WHERE claim_analysis IS NOT NULL
  AND id NOT IN (
    SELECT content_analysis_id FROM claim_adjustments
  )
```

Script will:
1. Parse JSON claims from existing analyses
2. Normalize to `claim_adjustments`
3. Extract entities
4. Match to actors
5. Report progress

**Estimated backfill time:** 10-20 seconds per analysis with claims

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| **GPT entity extraction errors** | Validate with regex patterns, allow manual correction |
| **Entity matching ambiguity** | Provide UI for manual disambiguation, track confidence scores |
| **Performance impact** | Run entity extraction async, cache results, add indexes |
| **Breaking existing flows** | Keep JSON field intact, add new normalized tables alongside |
| **Database size growth** | Add cleanup job for old temp entities, archive old claims |

---

## Next Steps

1. ✅ Review this plan
2. ✅ Get approval
3. ✅ Start Phase 1 implementation
4. ✅ Test with sample URLs
5. ✅ Iterate based on results

**Ready to implement!** 🚀
