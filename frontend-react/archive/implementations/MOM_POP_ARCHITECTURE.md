# MOM-POP Deception Assessment Architecture

**Created:** October 3, 2025
**Status:** Architectural Review & Refactor Plan
**Priority:** High - Core Entity Relationship Model

---

## 🎯 Core Concept

### MOM (Motive, Opportunity, Means)
**Nature:** Context-dependent, situational assessment
**Scope:** Evaluates an actor's deception risk for a **specific scenario or event**
**Cardinality:** **Many-to-many** relationship between Actors and Events/Scenarios

**Key Principle:**
> An actor's motive, opportunity, and means vary based on the specific situation. The same actor may have high motive for one type of deception but low motive for another.

**Examples:**
- "John Smith's MOM for stealing classified documents" (Event A)
  - Motive: 5/5 (financial pressure)
  - Opportunity: 4/5 (has access)
  - Means: 5/5 (technical skills)

- "John Smith's MOM for sabotaging manufacturing equipment" (Event B)
  - Motive: 1/5 (no clear motive)
  - Opportunity: 2/5 (limited access to factory floor)
  - Means: 2/5 (lacks mechanical expertise)

### POP (Patterns of Practice)
**Nature:** Historical, actor-centric assessment
**Scope:** Evaluates an actor's **established deception behavior patterns**
**Cardinality:** **One primary per actor**, with optional topic-based variations

**Key Principle:**
> An actor develops consistent deception patterns over time. These patterns are relatively stable across situations but may vary by domain.

**Structure:**
1. **Primary POP** - Actor's general deception patterns (one per actor)
   - Historical pattern consistency (0-5)
   - Sophistication level (0-5)
   - Success rate (0-5)
   - General notes

2. **Topic-Based POP Variations** (optional, many per actor)
   - Topic/domain (e.g., "Cyber operations", "Financial fraud", "HUMINT")
   - Same metrics as primary, but domain-specific
   - Allows tracking behavioral differences across contexts

**Examples:**
- "Jane Doe - Primary POP"
  - Historical pattern: 4/5 (consistently uses same techniques)
  - Sophistication: 5/5 (advanced tradecraft)
  - Success rate: 3/5 (caught occasionally)

- "Jane Doe - Cyber Operations POP" (variation)
  - Historical pattern: 5/5 (very consistent in cyber domain)
  - Sophistication: 5/5 (expert-level)
  - Success rate: 4/5 (rarely detected in this domain)

- "Jane Doe - Social Engineering POP" (variation)
  - Historical pattern: 3/5 (less consistent approach)
  - Sophistication: 3/5 (moderate skill)
  - Success rate: 2/5 (often detected)

---

## 📊 Current Architecture (INCORRECT)

### Current Data Model
```typescript
interface ActorDeceptionProfile {
  mom: {
    motive: number
    opportunity: number
    means: number
    notes: string
  }
  pop: {
    historical_pattern: number
    sophistication_level: number
    success_rate: number
    notes: string
  }
  overall_assessment: DeceptionAssessment
  last_updated: string
}

interface Actor {
  // ...
  deception_profile?: ActorDeceptionProfile  // ❌ WRONG - MOM is not actor-only
}
```

### Problems
1. **MOM is actor-only** - No connection to events/scenarios
2. **Single MOM per actor** - Can't assess different scenarios
3. **POP structure is correct** - But needs variations support
4. **No event-actor MOM links** - Missing critical relationship

---

## ✅ Correct Architecture

### Proposed Data Model

#### 1. MOM Assessment (New Separate Entity)
```typescript
interface MOMAssessment {
  id: string
  actor_id: string           // Required - who is being assessed
  event_id?: string          // Optional - specific event/incident
  scenario_description: string  // Required - what scenario is this

  // MOM Scores (0-5 each)
  motive: number
  opportunity: number
  means: number

  // Context
  notes: string
  assessed_by: number
  assessed_at: string

  // Metadata
  workspace_id: string
  created_at: string
  updated_at: string
}
```

**Use Cases:**
- Event-specific: "Actor X's MOM for Event Y"
- General scenario: "Actor X's MOM for insider theft (hypothetical)"
- Comparative: Multiple MOM assessments for same actor, different scenarios

#### 2. POP Assessment (Stays with Actor, Enhanced)
```typescript
interface POPAssessment {
  historical_pattern: number      // 0-5: How consistent are their deception patterns?
  sophistication_level: number    // 0-5: How advanced is their tradecraft?
  success_rate: number            // 0-5: How often do they succeed?
  notes: string
  assessed_at: string
}

interface POPVariation {
  topic: string                   // e.g., "Cyber Operations", "Financial Fraud"
  assessment: POPAssessment
}

interface Actor {
  // ...

  // Primary POP - general deception patterns
  primary_pop?: POPAssessment

  // Topic-specific POP variations
  pop_variations?: POPVariation[]

  // MOM assessments are separate entities, queried via actor_id
  // No longer stored directly on actor
}
```

#### 3. Event Enhancement
```typescript
interface Event {
  // ...existing fields

  // MOM assessments are separate entities, queried via event_id
  // Allows showing all actors' MOM for this event
}
```

---

## 🗄️ Database Schema Changes

### New Table: `mom_assessments`
```sql
CREATE TABLE mom_assessments (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  event_id TEXT,  -- Nullable, can be general scenario
  scenario_description TEXT NOT NULL,

  -- MOM Scores
  motive INTEGER NOT NULL CHECK(motive >= 0 AND motive <= 5),
  opportunity INTEGER NOT NULL CHECK(opportunity >= 0 AND opportunity <= 5),
  means INTEGER NOT NULL CHECK(means >= 0 AND means <= 5),

  -- Context
  notes TEXT,
  assessed_by INTEGER,
  assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (assessed_by) REFERENCES users(id)
);

CREATE INDEX idx_mom_actor ON mom_assessments(actor_id);
CREATE INDEX idx_mom_event ON mom_assessments(event_id);
CREATE INDEX idx_mom_workspace ON mom_assessments(workspace_id);
```

### Update Table: `actors`
```sql
-- Add POP variations support
ALTER TABLE actors ADD COLUMN pop_variations TEXT;  -- JSON array of POPVariation objects

-- Existing deception_profile field will be migrated:
-- - mom section → separate mom_assessments records
-- - pop section → primary_pop field
```

### Migration Strategy
1. For each existing `actor.deception_profile.mom`:
   - Create new `mom_assessments` record
   - Set `actor_id` from actor
   - Set `scenario_description` = "General assessment"
   - Set `event_id` = null
   - Copy motive, opportunity, means scores
   - Copy notes

2. For each existing `actor.deception_profile.pop`:
   - Move to `actor.primary_pop` field
   - Keep as JSON in `deception_profile` for backward compat (temp)

---

## 🎨 UI/UX Changes

### Actor Detail View

#### Overview Tab (No Changes)
- Basic information
- Quick stats

#### Deception Profile Tab (MAJOR CHANGES)
**Before:**
- Single MOM card (motive, opportunity, means)
- Single POP card

**After:**
```
┌─ Primary POP Assessment ────────────────────────────────┐
│ Historical Pattern: 4/5                                  │
│ Sophistication: 5/5                                      │
│ Success Rate: 3/5                                        │
│ Notes: [...]                                             │
└──────────────────────────────────────────────────────────┘

┌─ POP Variations ────────────────────────────────────────┐
│ [+ Add Topic-Based POP]                                  │
│                                                          │
│ 📊 Cyber Operations                                      │
│    Historical: 5/5, Sophistication: 5/5, Success: 4/5   │
│                                                          │
│ 📊 Social Engineering                                    │
│    Historical: 3/5, Sophistication: 3/5, Success: 2/5   │
└──────────────────────────────────────────────────────────┘

┌─ MOM Assessments ───────────────────────────────────────┐
│ [+ Create New MOM Assessment]                            │
│                                                          │
│ 📋 Operation Blue Sky (Event linked)                     │
│    Motive: 5/5, Opportunity: 4/5, Means: 5/5            │
│    Assessed: Oct 1, 2025                                 │
│                                                          │
│ 📋 Insider Theft Scenario (General)                      │
│    Motive: 3/5, Opportunity: 2/5, Means: 4/5            │
│    Assessed: Sep 15, 2025                                │
│                                                          │
│ 📋 Equipment Sabotage (Event linked)                     │
│    Motive: 1/5, Opportunity: 2/5, Means: 2/5            │
│    Assessed: Aug 20, 2025                                │
└──────────────────────────────────────────────────────────┘
```

### Event Detail View (NEW SECTION)

#### MOM Assessments Tab (NEW)
Shows all MOM assessments for THIS event across different actors

```
┌─ MOM Assessments for "Operation Blue Sky" ─────────────┐
│                                                         │
│ 👤 John Smith                                           │
│    Motive: 5/5, Opportunity: 4/5, Means: 5/5           │
│    Overall Risk: CRITICAL                               │
│    [View Actor] [Edit Assessment]                       │
│                                                         │
│ 👤 Jane Doe                                             │
│    Motive: 2/5, Opportunity: 3/5, Means: 4/5           │
│    Overall Risk: MEDIUM                                 │
│    [View Actor] [Edit Assessment]                       │
│                                                         │
│ [+ Add MOM Assessment for Another Actor]                │
└─────────────────────────────────────────────────────────┘
```

### MOM Assessment Form (NEW COMPONENT)

#### Create MOM Assessment
**Entry Points:**
1. From Actor Detail → "Create New MOM Assessment"
2. From Event Detail → "Add MOM Assessment for Another Actor"
3. From Frameworks → "Quick Create MOM" (EntityQuickCreate enhancement)

**Form Fields:**
```
┌─ Create MOM Assessment ──────────────────────────────────┐
│                                                          │
│ Actor: [Select Actor Dropdown] *                         │
│ Link to Event: [Select Event Dropdown] (optional)        │
│ Scenario Description: [Text area] *                       │
│   "Describe the specific scenario being assessed"        │
│                                                          │
│ ── MOM Scores (0-5 scale) ──                             │
│                                                          │
│ Motive: [Slider 0-5]                                     │
│   "Why would they deceive in this scenario?"            │
│                                                          │
│ Opportunity: [Slider 0-5]                                │
│   "Can they access/execute deception?"                   │
│                                                          │
│ Means: [Slider 0-5]                                      │
│   "Do they have skills/resources?"                       │
│                                                          │
│ Notes: [Text area]                                       │
│                                                          │
│ Overall Risk: MEDIUM (auto-calculated)                   │
│                                                          │
│ [Cancel] [Save MOM Assessment]                           │
└──────────────────────────────────────────────────────────┘
```

---

## 🔄 API Changes

### New Endpoints

#### MOM Assessments
```
GET    /api/mom-assessments?actor_id={id}     // Get all MOM for an actor
GET    /api/mom-assessments?event_id={id}     // Get all MOM for an event
GET    /api/mom-assessments/{id}              // Get specific MOM
POST   /api/mom-assessments                    // Create MOM
PUT    /api/mom-assessments/{id}               // Update MOM
DELETE /api/mom-assessments/{id}               // Delete MOM
```

#### POP Variations (part of actors API)
```
PUT    /api/actors/{id}/pop-variations         // Update POP variations array
```

### Modified Endpoints

#### Actors API
```
GET    /api/actors/{id}
Response includes:
{
  "actor": {
    ...existing fields,
    "primary_pop": { historical_pattern, sophistication_level, success_rate, notes },
    "pop_variations": [
      { "topic": "Cyber Ops", "assessment": {...} },
      { "topic": "Social Engineering", "assessment": {...} }
    ],
    "_mom_count": 5  // Count of MOM assessments
  }
}
```

---

## 📋 Implementation Plan

### Phase 1: Database & Backend (4-6 hours)
1. ✅ Create `mom_assessments` table
2. ✅ Add `pop_variations` column to `actors` table
3. ✅ Create MOM assessments API endpoints
4. ✅ Migrate existing MOM data to new structure
5. ✅ Update actors API to include POP variations

### Phase 2: Type Definitions (1-2 hours)
1. ✅ Create `MOMAssessment` interface
2. ✅ Create `POPAssessment` interface
3. ✅ Create `POPVariation` interface
4. ✅ Update `Actor` interface
5. ✅ Update `Event` interface

### Phase 3: MOM Assessment Components (3-4 hours)
1. ✅ Create `MOMAssessmentForm.tsx` - Create/edit MOM
2. ✅ Create `MOMAssessmentCard.tsx` - Display single MOM
3. ✅ Create `MOMAssessmentList.tsx` - Display multiple MOM
4. ✅ Update `EntityQuickCreate.tsx` - Add MOM option

### Phase 4: Actor Detail View Updates (2-3 hours)
1. ✅ Update Deception Profile tab layout
2. ✅ Add Primary POP section
3. ✅ Add POP Variations section (+ Add Topic button)
4. ✅ Replace single MOM with MOM Assessments list
5. ✅ Add "Create New MOM" button

### Phase 5: Event Detail View Enhancement (2-3 hours)
1. ✅ Create Event detail view component
2. ✅ Add MOM Assessments tab
3. ✅ Show all MOM for this event
4. ✅ Add "Add MOM Assessment" button

### Phase 6: Testing & Deployment (2-3 hours)
1. ✅ Test MOM creation for actors
2. ✅ Test MOM creation for events
3. ✅ Test POP variations
4. ✅ Migration testing
5. ✅ Deploy to production

**Total Estimate: 14-21 hours**

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ Can create multiple MOM assessments for one actor
- ✅ Can link MOM to specific events
- ✅ Can create general (non-event) MOM scenarios
- ✅ Can view all MOM for an actor
- ✅ Can view all MOM for an event
- ✅ Can add topic-based POP variations
- ✅ Primary POP remains stable
- ✅ Existing MOM data migrates successfully

### User Experience
- ✅ Analysts can compare different scenarios for same actor
- ✅ Event analysis shows all relevant actors' MOM
- ✅ POP shows patterns across actor's history
- ✅ Clear distinction between stable patterns (POP) and situational risk (MOM)

---

## 🔍 Example Use Cases

### Use Case 1: Insider Threat Analysis
**Scenario:** Evaluating employee "John Smith" for multiple risk scenarios

1. Create Actor: "John Smith, IT Administrator"
2. Set Primary POP (from historical behavior):
   - Historical pattern: 2/5 (inconsistent past behavior)
   - Sophistication: 3/5 (moderate technical skills)
   - Success rate: N/A (no known deception attempts)

3. Create MOM Assessments:
   - **Scenario A**: "Stealing customer database"
     - Motive: 5/5 (financial pressure from debt)
     - Opportunity: 5/5 (full database access)
     - Means: 4/5 (technical skills, knows systems)
     - **Result**: HIGH RISK

   - **Scenario B**: "Sabotaging production systems"
     - Motive: 1/5 (no apparent reason)
     - Opportunity: 3/5 (some access, but monitored)
     - Means: 3/5 (could do it, but would be complex)
     - **Result**: LOW RISK

**Outcome:** Focus monitoring on data exfiltration, less concern about sabotage

### Use Case 2: Operation Analysis
**Scenario:** "Operation Blue Sky" - suspected disinformation campaign

1. Create Event: "Operation Blue Sky"
2. Identify potential actors and create MOM for each:

   - **Actor**: "Russian GRU"
     - Motive: 5/5 (strategic interest)
     - Opportunity: 4/5 (established capabilities)
     - Means: 5/5 (resources, expertise)
     - **Result**: CRITICAL RISK

   - **Actor**: "Non-state hacktivist group"
     - Motive: 3/5 (ideological alignment)
     - Opportunity: 2/5 (limited capabilities)
     - Means: 2/5 (amateur level)
     - **Result**: LOW RISK

**Outcome:** Attribution points to state actor, not hacktivists

---

## 📝 Migration Notes

### Backward Compatibility
- Keep `deception_profile` field temporarily
- Mark as deprecated in types
- Remove after 2 release cycles

### Data Migration Script
```typescript
async function migrateMOMData() {
  const actors = await db.query("SELECT * FROM actors WHERE deception_profile IS NOT NULL")

  for (const actor of actors) {
    const profile = JSON.parse(actor.deception_profile)

    if (profile.mom) {
      // Create MOM assessment
      await db.insert("mom_assessments", {
        id: uuidv4(),
        actor_id: actor.id,
        event_id: null,
        scenario_description: "General assessment (migrated)",
        motive: profile.mom.motive || 0,
        opportunity: profile.mom.opportunity || 0,
        means: profile.mom.means || 0,
        notes: profile.mom.notes || "",
        workspace_id: actor.workspace_id,
        assessed_at: actor.updated_at
      })
    }
  }
}
```

---

## 🚀 Next Steps

1. **Review & Approve** this architecture (CURRENT)
2. **Create database migration** for mom_assessments table
3. **Implement backend APIs** for MOM CRUD
4. **Update type definitions** in frontend
5. **Build MOM components** (form, card, list)
6. **Update Actor detail view** with new structure
7. **Create Event detail view** with MOM tab
8. **Test & Deploy**

---

**Status:** ✅ Architecture Defined - Ready for Implementation
**Next:** Database migration creation
