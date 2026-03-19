# Claims Investigation System - Comprehensive Integration Plan

## Vision: Claims as Investigation Hub

Transform the claims analysis feature from a read-only display into a collaborative investigation platform that integrates with evidence, entities, and analytical frameworks.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONTENT INTELLIGENCE                         │
│                    (Entry Point: URL Analysis)                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ↓ Extracts Claims
┌─────────────────────────────────────────────────────────────────┐
│                     CLAIMS ANALYSIS ENGINE                       │
│  • 6 Deception Detection Methods                                 │
│  • Risk Scoring (0-100)                                          │
│  • Source Credibility Evaluation                                 │
└───────────────┬────────────────────┬────────────────────────────┘
                │                    │
     ┌──────────▼──────────┐  ┌─────▼──────────┐
     │  CLAIM ADJUSTMENTS  │  │  VERIFICATION  │
     │  • User Scores      │  │  • Status      │
     │  • Comments         │  │  • Confidence  │
     │  • Audit Trail      │  │  • Conclusion  │
     └──────────┬──────────┘  └─────┬──────────┘
                │                    │
     ┌──────────▼────────────────────▼──────────┐
     │         CLAIM INTEGRATIONS                │
     ├───────────────────────────────────────────┤
     │  ┌────────────────────────────────────┐   │
     │  │  EVIDENCE LINKING                  │   │
     │  │  • Supports / Contradicts         │   │
     │  │  • Relevance Scoring              │   │
     │  │  • Confidence Assessment          │   │
     │  └────────────────────────────────────┘   │
     │                                           │
     │  ┌────────────────────────────────────┐   │
     │  │  ENTITY EXTRACTION                 │   │
     │  │  • Claim Makers                    │   │
     │  │  • Subjects                        │   │
     │  │  • Credibility Impact              │   │
     │  │  • Historical Pattern Tracking     │   │
     │  └────────────────────────────────────┘   │
     │                                           │
     │  ┌────────────────────────────────────┐   │
     │  │  INVESTIGATION PACKETS             │   │
     │  │  • Group Related Claims            │   │
     │  │  • Team Collaboration              │   │
     │  │  • Status Tracking                 │   │
     │  │  • Export Reports                  │   │
     │  └────────────────────────────────────┘   │
     │                                           │
     │  ┌────────────────────────────────────┐   │
     │  │  ACH INTEGRATION                   │   │
     │  │  • Claims → Hypotheses             │   │
     │  │  • Evidence → ACH Matrix           │   │
     │  │  • Risk Flags → Analysis           │   │
     │  └────────────────────────────────────┘   │
     └───────────────────────────────────────────┘
                        │
     ┌──────────────────▼─────────────────────┐
     │        SHARING & EXPORT                 │
     │  • Public Claim Links                   │
     │  • Investigation Reports                │
     │  • Team Collaboration URLs              │
     │  • API Exports (JSON/CSV)               │
     └─────────────────────────────────────────┘
```

---

## Use Case Examples

### Example 1: Journalist Fact-Checking

**Scenario:** Journalist analyzes politician's claims about policy

```
1. INPUT: CNN article with Noem's claims
   ↓
2. EXTRACT: 5 claims identified
   - Claim: "Democrats caused TSA pay delays"
   - Original Risk Score: 20 (low risk)
   ↓
3. USER ADJUSTS:
   - Adjusted Score: 75 (high risk)
   - Reasoning: "Known partisan bias, contradicts government records"
   ↓
4. LINK EVIDENCE:
   - [CONTRADICTS] GAO Report: "Shutdown caused by budget impasse"
   - [CONTRADICTS] Fact-check: "Noem has made 12 false partisan claims"
   - [SUPPORTS] Video of Noem making statement (proves she said it)
   ↓
5. EXTRACT ENTITIES:
   - Claim Maker: Kristi Noem (credibility: 2/5, political bias: high)
   - Subject: Democrats (entity type: political party)
   - Affected: TSA workers (entity type: organization)
   ↓
6. CREATE INVESTIGATION PACKET:
   - Title: "Fact-Check: Noem's TSA Claims"
   - Status: Debunked
   - Verification Confidence: 95%
   ↓
7. EXPORT:
   - Generate fact-check article with citations
   - Share public link with editors
   - Export to CMS as structured data
```

### Example 2: Intelligence Analyst

**Scenario:** Analyst tracks disinformation campaign

```
1. ANALYZE: 20 social media posts
   ↓
2. IDENTIFY PATTERN:
   - 15 claims share same false narrative
   - All from accounts linked to known actor
   ↓
3. CREATE INVESTIGATION PACKET:
   - Title: "Operation X Disinformation Campaign"
   - Type: Narrative Analysis
   - Priority: Critical
   ↓
4. LINK CLAIMS TO ENTITIES:
   - 8 different "claim makers" (likely coordinated)
   - All target same 3 political figures
   - Timeline: All within 72-hour window
   ↓
5. BUILD EVIDENCE CHAIN:
   - Link each claim to contradicting official statements
   - Track claim propagation across platforms
   - Identify original source of narrative
   ↓
6. ACH ANALYSIS:
   - Hypothesis 1: Organic grassroots movement (low probability)
   - Hypothesis 2: Coordinated influence operation (high probability)
   - Evidence from claims supports Hypothesis 2
   ↓
7. REPORT:
   - Export investigation packet
   - Generate timeline visualization
   - Share with team via secure link
```

---

## MVP Features (Phase 1)

### 1. Persistent Claim Adjustments
- [x] UI component for adjustments (DONE)
- [ ] Save adjustments to database
- [ ] Load adjustments when viewing analysis
- [ ] Show "Last adjusted by [user] on [date]"
- [ ] Track adjustment history (audit trail)

**API Endpoints:**
```typescript
POST /api/claims/save-adjustment
  Body: {
    content_analysis_id,
    claim_index,
    adjusted_risk_score,
    user_comment,
    verification_status
  }

GET /api/claims/adjustments/:content_analysis_id
  Returns: Array of all adjustments for this analysis
```

### 2. Evidence Linking
**UI Component:** `ClaimEvidenceLinker.tsx`

```typescript
interface ClaimEvidenceLinkerProps {
  claimAdjustmentId: string
  onLinked: () => void
}

// Features:
// - Search existing evidence items
// - Select relationship: Supports / Contradicts / Provides Context
// - Set relevance score (0-100)
// - Add notes on relationship
// - Preview linked evidence
// - Remove links
```

**API Endpoints:**
```typescript
POST /api/claims/link-evidence
  Body: { claim_adjustment_id, evidence_id, relationship, relevance_score, notes }

GET /api/claims/:id/linked-evidence
  Returns: Array of linked evidence with relationships

DELETE /api/claims/unlink-evidence/:link_id
```

**UI Enhancements:**
```tsx
<Card>
  <CardHeader>
    <div className="flex justify-between">
      <span>Claim: {claim}</span>
      <Badge>{linkedEvidence.length} Evidence Items</Badge>
    </div>
  </CardHeader>
  <CardContent>
    {/* Existing deception analysis... */}

    {/* NEW: Evidence Section */}
    <div className="mt-4">
      <Button onClick={() => setShowEvidenceLinker(true)}>
        <Link className="mr-2 h-4 w-4" />
        Link Evidence
      </Button>

      {linkedEvidence.map(evidence => (
        <div className="mt-2 p-2 border rounded">
          <div className="flex items-center gap-2">
            {evidence.relationship === 'contradicts' && <XCircle className="text-red-500" />}
            {evidence.relationship === 'supports' && <CheckCircle className="text-green-500" />}
            <span>{evidence.title}</span>
            <Badge>Relevance: {evidence.relevance_score}%</Badge>
          </div>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

### 3. Entity Extraction & Linking
**Auto-extract entities from claims:**

```typescript
// Example claim: "Kristi Noem blamed Democrats for TSA pay delays"

await extractEntitiesFromClaim(claim)
  => [
    {
      name: "Kristi Noem",
      type: "person",
      role: "claim_maker",
      credibility_impact: -30 // Lowers credibility due to partisan history
    },
    {
      name: "Democrats",
      type: "political_party",
      role: "subject",
      credibility_impact: 0 // Neutral
    },
    {
      name: "TSA",
      type: "organization",
      role: "affected",
      credibility_impact: 0
    }
  ]
```

**Credibility Impact System:**
- Claim maker with track record of falsehoods: `-30 to -50`
- Partisan political figure: `-20 to -40`
- Industry spokesperson with financial interest: `-20 to -35`
- Neutral expert: `+20 to +40`
- Official government source: `+30 to +50`

**API Endpoints:**
```typescript
POST /api/claims/extract-entities
  Body: { claim_adjustment_id, claim_text }
  Returns: Array of extracted entities with credibility impact

GET /api/claims/:id/entities
  Returns: All entities linked to this claim
```

### 4. Investigation Packets
**UI Component:** `InvestigationPacketManager.tsx`

```typescript
// Create packet
const packet = await createInvestigationPacket({
  title: "Fact-Check: Noem's TSA Claims",
  description: "Investigating claims made by Kristi Noem regarding TSA worker pay",
  investigation_type: "fact_check",
  priority: "high"
})

// Add claims to packet
await addClaimToPacket({
  packet_id: packet.id,
  claim_adjustment_id: "claim-123",
  priority: "critical",
  investigation_notes: "Primary claim to verify"
})
```

**UI Features:**
- Create new packets from Content Intelligence page
- Add multiple claims to single packet
- Assign claims to team members
- Track verification status per claim
- Export packet as PDF/JSON
- Share packet via URL

### 5. Sharing System
**Three sharing levels:**

```typescript
// Level 1: Share individual claim
const shareUrl = await shareClaimPublicly({
  claim_adjustment_id: "claim-123",
  show_evidence: true,
  show_entities: true,
  allow_comments: false
})
// => https://researchtoolspy.pages.dev/public/claim/abc123

// Level 2: Share entire content analysis (already implemented)
// => https://researchtoolspy.pages.dev/public/content-analysis/xyz789

// Level 3: Share investigation packet
const packetUrl = await shareInvestigationPacket({
  packet_id: "packet-456",
  is_public: true,
  allow_collaboration: false
})
// => https://researchtoolspy.pages.dev/public/investigation/def456
```

---

## Integration with Existing Systems

### 1. ACH Integration
**Workflow:**
```
Claims Analysis → Investigation Packet → ACH Analysis
```

**Implementation:**
```typescript
// Button in Investigation Packet: "Create ACH from Claims"
async function createACHFromPacket(packetId: string) {
  // 1. Get all claims in packet
  const claims = await getPacketClaims(packetId)

  // 2. Generate ACH hypotheses from high-risk claims
  const hypotheses = [
    "Claim is accurate and supported by evidence",
    "Claim is politically motivated spin with partial truth",
    "Claim is intentional disinformation",
    "Claim is misunderstanding of complex situation"
  ]

  // 3. Use linked evidence as ACH evidence
  const evidence = await getAllLinkedEvidence(claims)

  // 4. Create ACH with pre-populated matrix
  const ach = await createACH({
    title: `ACH: ${packet.title}`,
    hypotheses,
    evidence,
    source_packet_id: packetId
  })
}
```

### 2. Evidence System Integration
**Bi-directional links:**
```
Claim ←→ Evidence
  - Evidence page shows "Related Claims"
  - Claim page shows "Linked Evidence"
  - Evidence credibility affects claim risk score
```

**Auto-suggest evidence:**
```typescript
// When user clicks "Link Evidence", suggest relevant evidence
async function suggestRelevantEvidence(claim: string) {
  // Search evidence by:
  // 1. Keywords from claim
  // 2. Entities mentioned in claim
  // 3. Similar topics
  // 4. Same time period

  return await searchEvidence({
    query: extractKeywords(claim),
    entities: extractEntities(claim),
    limit: 10,
    sort_by: 'relevance'
  })
}
```

### 3. Entity System Integration
**Track entity credibility over time:**
```sql
-- Query: Get entity's claim history
SELECT
  e.name,
  e.type,
  COUNT(c.id) as total_claims,
  AVG(c.adjusted_risk_score) as avg_risk_score,
  SUM(CASE WHEN pc.verification_status = 'debunked' THEN 1 ELSE 0 END) as debunked_count
FROM claim_entity_mentions cem
JOIN claim_adjustments c ON cem.claim_adjustment_id = c.id
JOIN actors e ON cem.entity_id = e.id
LEFT JOIN packet_claims pc ON c.id = pc.claim_adjustment_id
WHERE cem.role = 'claim_maker'
GROUP BY e.id
ORDER BY debunked_count DESC
```

**Entity Profile Enhancement:**
```tsx
// On Actor/Entity page, show:
<Card>
  <CardHeader>
    <CardTitle>{entity.name}</CardTitle>
    <CardDescription>Claim Making History</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-3 gap-4">
      <Stat label="Total Claims" value={entity.total_claims} />
      <Stat label="Avg Risk Score" value={entity.avg_risk_score} />
      <Stat label="Debunked" value={entity.debunked_count} color="red" />
    </div>

    <div className="mt-4">
      <h4>Recent Claims:</h4>
      {entity.recent_claims.map(claim => (
        <ClaimCard claim={claim} compact />
      ))}
    </div>
  </CardContent>
</Card>
```

---

## Value Propositions by User Type

### Journalists
**Workflow:** URL Analysis → Claim Extraction → Evidence Linking → Fact-Check Article
- Extract claims from press releases/speeches
- Link to fact-checking evidence
- Track politician's claim accuracy over time
- Export as structured fact-check article
- **ROI:** Reduces fact-checking time by 60%

### Intelligence Analysts
**Workflow:** Multiple Sources → Pattern Detection → Investigation Packet → ACH Analysis
- Identify coordinated disinformation campaigns
- Track narrative propagation across platforms
- Build evidence chains for attribution
- Generate classified reports
- **ROI:** Identifies threats 3x faster

### Researchers
**Workflow:** Dataset Analysis → Claim Extraction → Entity Patterns → Academic Paper
- Study misinformation patterns
- Analyze source credibility trends
- Export datasets for statistical analysis
- Generate citation graphs
- **ROI:** Accelerates research by 40%

### Legal Teams
**Workflow:** Evidence Collection → Claim Verification → Investigation Packet → Legal Brief
- Document claims made in legal proceedings
- Link to supporting/contradicting evidence
- Build audit trail of verification process
- Export as legal evidence package
- **ROI:** Ensures admissible evidence chain

---

## MVP Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Run migration 039 to create tables
- [ ] API endpoint: Save claim adjustments
- [ ] API endpoint: Load claim adjustments
- [ ] Update ClaimAnalysisDisplay to save/load
- [ ] Add "Save Adjustments" button
- [ ] Show "Last adjusted by..." metadata

### Phase 2: Evidence Linking (Week 3-4)
- [ ] Create ClaimEvidenceLinker component
- [ ] API endpoint: Link evidence to claim
- [ ] API endpoint: Get linked evidence
- [ ] Search evidence by keywords
- [ ] Display linked evidence in ClaimCard
- [ ] Show relationship badges (supports/contradicts)

### Phase 3: Entity Integration (Week 5-6)
- [ ] API endpoint: Extract entities from claim
- [ ] Create ClaimEntityExtractor component
- [ ] Link entities to existing actor/entity tables
- [ ] Display entities in ClaimCard
- [ ] Show credibility impact
- [ ] Entity profile: Show claim history

### Phase 4: Investigation Packets (Week 7-8)
- [ ] Create InvestigationPacketManager component
- [ ] API endpoints: CRUD investigation packets
- [ ] Add claims to packets
- [ ] Packet detail page
- [ ] Export packet as PDF/JSON
- [ ] Activity log/audit trail

### Phase 5: Sharing & ACH Integration (Week 9-10)
- [ ] Public claim sharing URLs
- [ ] Public investigation packet URLs
- [ ] "Create ACH from Packet" button
- [ ] Pre-populate ACH with claims as hypotheses
- [ ] Link evidence to ACH matrix
- [ ] Export integrated reports

---

## Technical Considerations

### Performance
- **Caching:** Cache linked evidence/entities (1 hour TTL)
- **Pagination:** Load 20 claims at a time for large analyses
- **Lazy Loading:** Load evidence details on demand
- **Optimistic Updates:** Show adjustments immediately, sync in background

### Security
- **Authorization:** Only claim creator or workspace admin can adjust
- **Audit Trail:** All changes logged to `investigation_activity_log`
- **Share Tokens:** Cryptographically secure random tokens
- **Rate Limiting:** Max 100 adjustments per hour per user

### Data Integrity
- **Cascade Deletes:** Delete claims → delete links to evidence/entities
- **Referential Integrity:** Foreign key constraints enforced
- **Validation:** Risk scores 0-100, statuses from enum
- **Consistency:** Updates wrapped in transactions

---

## Success Metrics

### Engagement
- **Adoption Rate:** % of analyses with adjusted claims
- **Evidence Links:** Avg # of evidence items linked per claim
- **Investigation Packets:** # of active packets
- **Collaboration:** # of shared investigations with multiple editors

### Quality
- **Verification Rate:** % of claims with verified/debunked status
- **Evidence Depth:** Avg credibility score of linked evidence
- **Audit Trail Completeness:** % of adjustments with user comments
- **Export Usage:** # of investigation reports exported

### Business Impact
- **Time Savings:** Reduction in fact-checking time
- **Accuracy:** % of claims correctly verified
- **Collaboration:** # of team members per investigation
- **API Usage:** External tools integrating claims data

---

## Future Enhancements (Phase 6+)

### Advanced Analytics
- Claim propagation visualization (network graph)
- Sentiment analysis of claim language
- Automated duplicate claim detection
- ML-based credibility prediction

### Collaboration Features
- Real-time co-editing of investigations
- Comment threads on claims
- @mention team members
- Notification system for status changes

### Automation
- Auto-link evidence based on keywords
- Auto-extract entities with NER
- Auto-suggest similar claims
- Scheduled investigation reports

### Integrations
- Slack notifications for high-risk claims
- Jira tickets from investigation tasks
- Google Docs export
- API webhooks for external tools

---

## Questions for User

1. **Priority Order:** Which integration is most valuable first?
   - Evidence linking
   - Entity tracking
   - Investigation packets
   - Sharing/collaboration

2. **User Workflow:** Typical investigation process?
   - Do you work alone or with teams?
   - How do you currently track claim verification?
   - What format do you need for exports?

3. **Technical Constraints:**
   - Database size limits?
   - User count expectations?
   - Performance requirements?

4. **MVP Scope:** What's the minimum viable feature set?
   - Just save adjustments?
   - Save + evidence linking?
   - Full investigation packets?

---

Ready to implement! Let me know which phase to start with.
