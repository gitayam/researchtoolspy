# Integration Upgrade Plan
## Upgrading Legacy Frameworks with New Capabilities

**Date Created**: 2025-10-11
**Last Updated**: 2025-10-11

---

## Overview

This document outlines opportunities to integrate newer capabilities (Evidence, Entities/Actors, Claims, Investigations) into existing analysis frameworks that were built before these systems existed.

### What's New & Available for Integration

1. **Evidence System** - Structured evidence items with source URLs, descriptions, credibility ratings
2. **Entities/Actors** - Person, organization, location tracking with credibility & bias ratings
3. **Claims System** - Automated claim extraction, deception detection, risk scoring
4. **Investigation Packets** - Multi-source case organization with unified analysis

### Current Integration Status

| Feature | Evidence | Entities | Claims | Investigations |
|---------|----------|----------|--------|----------------|
| **ACH** | ✅ Full | ❌ No | ❌ No | ❌ No |
| **Content Intelligence** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **SWOT** | ❌ No | ❌ No | ❌ No | ❌ No |
| **COG** | ❌ No | ❌ No | ❌ No | ❌ No |
| **PMESII-PT** | ❌ No | ❌ No | ❌ No | ❌ No |
| **DOTMLPF** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Deception (SATS)** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Behavior Analysis** | ❌ No | ❌ No | ❌ No | ❌ No |
| **COMB** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Starbursting** | ❌ No | ❌ No | ❌ No | ❌ No |
| **DIME** | ❌ No | ❌ No | ❌ No | ❌ No |
| **PEST** | ❌ No | ❌ No | ❌ No | ❌ No |

---

## Priority 1: High-Value Quick Wins

### 1. COG Analysis + Entities Integration (⭐ Highest Priority)

**Why**: COG analysis already identifies actors (adversaries, allies, neutral parties) but stores them as text strings instead of linking to the Actors system.

**Current State:**
- COG identifies "Adversary", "Ally", "Neutral" actors
- Actors stored as plain text in COG data structure
- No credibility/bias tracking
- No ability to pivot to other analyses involving same actor

**Upgrade Path:**
```typescript
// Current COG Structure
centers_of_gravity: [
  {
    id: string
    adversary: string  // Plain text: "Russia", "China", etc.
    cog_type: string
    description: string
  }
]

// After Integration
centers_of_gravity: [
  {
    id: string
    adversary_id: string  // FK to actors table
    adversary_name: string  // Display cache
    cog_type: string
    description: string
    // Link to actor with full credibility/bias data
  }
]
```

**Implementation Steps:**
1. Add `adversary_id` field to COG data structure
2. Create actor picker/search component for COG form
3. Link existing plain-text actors to Actors database (migration helper)
4. Display actor credibility/bias in COG view
5. Add "View all COG analyses for this actor" pivot button

**Value:**
- Analysts can track adversary patterns across analyses
- Credibility scores inform COG targeting priorities
- Entity pivoting enables cross-analysis insights

**Effort**: Medium (3-4 hours)

---

### 2. SWOT Analysis + Evidence Integration

**Why**: SWOT strengths/weaknesses/opportunities/threats are claims that need supporting evidence.

**Current State:**
- SWOT items are plain text entries
- No evidence backing
- No way to validate claims

**Upgrade Path:**
```typescript
// Current SWOT Structure
strengths: string[]
weaknesses: string[]
opportunities: string[]
threats: string[]

// After Integration
strengths: [{
  id: string
  text: string
  evidence_ids: string[]  // Links to evidence table
  confidence: number      // Based on evidence quality
}]
```

**Implementation Steps:**
1. Migrate SWOT arrays to objects with evidence links
2. Add "Link Evidence" button to each SWOT item
3. Display evidence count badge on each item
4. Show evidence credibility aggregate
5. Add "View Supporting Evidence" expandable section

**Value:**
- Validates SWOT claims with evidence
- Prevents unsupported assertions
- Enables evidence-based strategic planning

**Effort**: Medium (2-3 hours)

---

### 3. Investigation Packets + COG/SWOT Pre-Population

**Why**: Multi-source investigations should be able to generate framework analyses.

**Current State:**
- Investigations collect content analyses
- No way to export investigation data to frameworks
- Manual re-entry required

**Upgrade Path:**
1. Add "Create COG from Investigation" button in investigation detail view
2. Extract entities from all sources → populate adversary list
3. Extract claims → populate COG vulnerabilities
4. Pre-populate COG with investigation context

**Implementation Steps:**
1. Create investigation-to-COG mapper function
2. Add "Generate Framework" dropdown in investigation detail
3. Support COG, SWOT, PMESII pre-population
4. Link generated framework back to investigation

**Value:**
- Seamless workflow from investigation → analysis
- Reduces manual data entry
- Maintains audit trail

**Effort**: Medium-High (4-5 hours)

---

## Priority 2: Medium-Value Enhancements

### 4. Deception (SATS) + Claims Integration

**Why**: Deception framework already assesses deception indicators, but Claims system has automated deception detection.

**Integration Opportunity:**
- Import claims from Content Intelligence into Deception framework
- Auto-populate MOM/POP/MOSES/EVE indicators from claim analysis
- Link back to original source for verification

**Effort**: Medium (3 hours)

---

### 5. PMESII-PT + Entities Integration

**Why**: PMESII-PT analyzes Political/Military/Economic/Social/Information/Infrastructure domains - all involve actors.

**Integration Opportunity:**
- Link political actors to PMESII Political factors
- Link military actors to Military factors
- Track actor influence across domains

**Effort**: Medium (3 hours)

---

### 6. Behavior Analysis + Entities Integration

**Why**: Behavior analysis studies actor behaviors - should link to Actors system.

**Integration Opportunity:**
- Link actors to behavior patterns
- Track behavior evolution over time
- Compare behaviors across actors

**Effort**: Low-Medium (2 hours)

---

## Priority 3: Nice-to-Have Features

### 7. Framework Export to Investigation Packets

**Reverse Direction**: Allow frameworks to contribute back to investigations.

**Use Case:**
- Analyst completes COG analysis
- Wants to share findings in investigation packet
- Export COG conclusions as structured findings

**Effort**: Low (1-2 hours)

---

### 8. Global Entity Dashboard

**Cross-Framework Analytics**

**Features:**
- "Show me all frameworks mentioning Entity X"
- Entity credibility timeline across analyses
- Network graph of entity relationships
- Most-analyzed entities report

**Effort**: High (6-8 hours)

---

### 9. Evidence Quality Dashboard

**Cross-Framework Evidence Metrics**

**Features:**
- Evidence usage statistics (which evidence used most)
- Evidence source credibility analysis
- Gap analysis (which claims lack evidence)
- Evidence collection recommendations

**Effort**: High (6-8 hours)

---

## Implementation Roadmap

### Phase 1: Foundational Integrations (Week 1)
1. ✅ **Investigation Packets MVP** (COMPLETED)
2. ✅ **Claims + Evidence + Entities** (COMPLETED)
3. 🔲 **COG + Entities Integration** (Priority 1.1)
4. 🔲 **SWOT + Evidence Integration** (Priority 1.2)

### Phase 2: Cross-System Workflows (Week 2)
5. 🔲 **Investigation → Framework Pre-Population** (Priority 1.3)
6. 🔲 **Deception + Claims Integration** (Priority 2.1)
7. 🔲 **PMESII-PT + Entities** (Priority 2.2)

### Phase 3: Advanced Analytics (Week 3-4)
8. 🔲 **Global Entity Dashboard** (Priority 3.1)
9. 🔲 **Evidence Quality Dashboard** (Priority 3.2)
10. 🔲 **Framework Export to Investigations** (Priority 3.3)

---

## Technical Considerations

### Database Schema Changes

**New Foreign Key Relationships:**
```sql
-- COG adversary linking
ALTER TABLE framework_data ADD COLUMN adversary_actor_ids TEXT; -- JSON array

-- SWOT evidence linking
CREATE TABLE swot_evidence_links (
  id TEXT PRIMARY KEY,
  swot_framework_id INTEGER NOT NULL,
  swot_item_id TEXT NOT NULL,
  swot_item_type TEXT NOT NULL, -- strength/weakness/opportunity/threat
  evidence_id TEXT NOT NULL,
  relevance_score INTEGER DEFAULT 50,
  linked_at TEXT NOT NULL,
  FOREIGN KEY (swot_framework_id) REFERENCES frameworks(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

-- Investigation framework links
CREATE TABLE investigation_framework_links (
  id TEXT PRIMARY KEY,
  investigation_packet_id TEXT NOT NULL,
  framework_id INTEGER NOT NULL,
  framework_type TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE,
  FOREIGN KEY (framework_id) REFERENCES frameworks(id) ON DELETE CASCADE
);
```

### API Endpoints Needed

```typescript
// COG Entities
POST /api/frameworks/cog/link-actor
GET /api/frameworks/cog/:id/actors
DELETE /api/frameworks/cog/remove-actor/:link_id

// SWOT Evidence
POST /api/frameworks/swot/link-evidence
GET /api/frameworks/swot/:id/evidence
DELETE /api/frameworks/swot/remove-evidence/:link_id

// Investigation Pre-population
POST /api/investigation-packets/:id/generate-framework
GET /api/investigation-packets/:id/frameworks
```

---

## User Workflows Enabled

### Workflow 1: Security Analyst Investigating Adversary

**Before Integration:**
1. Create investigation packet
2. Add URLs about adversary
3. Extract claims manually
4. Separately create COG analysis
5. Manually re-enter adversary data

**After Integration:**
1. Create investigation packet ("APT29 Analysis")
2. Add multiple intelligence reports
3. Click "Generate COG from Investigation"
4. COG pre-populated with:
   - Adversary (APT29) linked to Actors database
   - Vulnerabilities extracted from claims
   - Evidence auto-linked
5. Analyst refines and saves

**Time Saved**: 60-80%

---

### Workflow 2: Strategic Planner Using SWOT

**Before Integration:**
1. Brainstorm SWOT items
2. No validation of claims
3. Trust gut feelings

**After Integration:**
1. Add SWOT items
2. Link evidence to each item
3. System shows credibility aggregate
4. Red flags unsupported claims
5. Confident, evidence-based strategy

**Quality Improvement**: Significant

---

### Workflow 3: Cross-Framework Entity Analysis

**Before Integration:**
- No way to find all analyses mentioning an entity
- Manual search through frameworks

**After Integration:**
1. Navigate to Actors page
2. Click on "Russia" entity
3. See dashboard:
   - 3 COG analyses (adversary)
   - 2 PMESII analyses (political actor)
   - 5 investigation packets
4. Click to view any analysis
5. Understand full picture

**Insight Gain**: Dramatic

---

## Migration Strategy

### For Existing Data

**COG Analyses with Text Actors:**
```typescript
// Migration Helper Script
async function migrateCOGActors() {
  const cogAnalyses = await fetchAllCOG()

  for (const cog of cogAnalyses) {
    for (const cogItem of cog.centers_of_gravity) {
      // Check if actor exists
      let actor = await findActorByName(cogItem.adversary)

      if (!actor) {
        // Create actor
        actor = await createActor({
          name: cogItem.adversary,
          type: 'organization',
          description: `Identified in COG analysis: ${cog.title}`,
          credibility_rating: 50 // Default
        })
      }

      // Link
      cogItem.adversary_id = actor.id
      await updateCOG(cog)
    }
  }
}
```

---

## Success Metrics

### Quantitative
- **Integration Coverage**: % of frameworks with evidence/entity linking
- **Usage Rate**: % of framework analyses using new features
- **Time Savings**: Average time to create evidence-backed framework analysis
- **Data Quality**: % of framework claims supported by evidence

### Qualitative
- **User Feedback**: "Much easier to validate my analysis"
- **Cross-Analysis Insights**: "Finally can track adversary across all frameworks"
- **Confidence**: "Evidence backing makes me confident in recommendations"

---

## Conclusion

The integration of Evidence, Entities, Claims, and Investigations into existing frameworks represents a **major value multiplier** for the platform.

**Priority Order:**
1. ✅ **COG + Entities** - Highest impact for strategic/military analysis
2. ✅ **SWOT + Evidence** - Validates strategic planning
3. ✅ **Investigation Pre-population** - Seamless workflow

These three integrations alone will **transform** how analysts use the platform, enabling:
- **Evidence-based decision making**
- **Cross-framework entity tracking**
- **Seamless investigation → analysis workflows**
- **Audit trails for compliance**
- **Confidence in strategic recommendations**

**Estimated Total Effort**: 12-15 hours for Priority 1 items
**Estimated Value**: Dramatically improved analyst productivity and confidence
