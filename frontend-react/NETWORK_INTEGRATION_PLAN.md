# Network Analysis Integration Plan
**Created**: 2025-10-06
**Status**: Recommendation Phase

---

## 📊 Current State Analysis

### Existing Network Features

#### 1. **Global Network Graph** (`/dashboard/network-graph`)
- **Location**: `src/pages/NetworkGraphPage.tsx`
- **Purpose**: Visualize ALL entity relationships across the workspace
- **Entities Supported**: ACTOR, SOURCE, EVENT, PLACE, BEHAVIOR, EVIDENCE
- **Features**:
  - Force-directed graph visualization
  - Entity type filtering
  - Confidence-based filtering
  - Path finding between nodes
  - Network metrics (centrality, clustering)
  - Export to PNG/JSON/CSV
- **Data Source**: Pulls from `relationships` table in database

#### 2. **COG-Specific Visualization** (Embedded in COG Analysis)
- **Location**: `src/components/frameworks/COGNetworkVisualization.tsx`
- **Purpose**: Visualize COG hierarchy (COG → Capabilities → Requirements → Vulnerabilities)
- **Features**:
  - Force-directed layout
  - "What if?" simulation mode (remove nodes)
  - Color-coded by type
  - PNG export
  - Click for node details
- **Data Source**: COG analysis data (NOT connected to global network)
- **Issue**: **Isolated** - doesn't connect to main entity network

#### 3. **Framework Auto-Generation** (Partially Implemented)
- **Location**: `src/utils/framework-relationships.ts` + `GenericFrameworkView.tsx`
- **Purpose**: Auto-generate entity relationships from COG/Causeway analyses
- **Status**: ⚠️ **NOT FUNCTIONAL** - Functions exist but never called with real data
- **Issue**: Lines 143-165 in `GenericFrameworkView.tsx` have `TODO` comments
  ```typescript
  // TODO: Map COG items to entities and generate DEPENDS_ON relationships
  // This requires entity linking infrastructure
  console.log('COG elements for relationship generation:', cogElements)
  ```

### Current User Experience Gaps

1. ❌ **No Bridge Between COG and Global Network**
   - Users create COG analysis → Creates internal visualization
   - **But**: COG elements don't become entities in global network
   - **But**: No automatic relationship generation
   - **Result**: COG data siloed from rest of analysis

2. ❌ **Manual Entity Linking Only**
   - GenericFrameworkView has "Link Evidence" button
   - **But**: Requires manually selecting existing evidence
   - **But**: Doesn't auto-create entities FROM framework elements

3. ❌ **Causeway Has No Visualization**
   - COG has dedicated viz
   - Global network exists
   - **But**: Causeway (actor-action-target) has none
   - **Result**: Missing opportunity for relationship-heavy framework

4. ❌ **No "View in Network" Button**
   - COG/Causeway view pages have own visualizations
   - **But**: No quick link to see analysis in global network context
   - **Result**: Users don't discover how frameworks connect to broader intelligence picture

---

## 🎯 Recommended Integration Strategy

### Phase 1: Auto-Entity Creation from COG ⭐ **HIGH PRIORITY**

**Goal**: When user creates COG analysis, automatically create entities and relationships

#### Implementation

**1.1 Entity Creation Service**
```typescript
// src/services/cog-entity-mapper.ts
export async function createEntitiesFromCOG(
  cogAnalysis: COGAnalysis,
  workspaceId: string
): Promise<{
  createdEntities: EntityMapping[]
  createdRelationships: Relationship[]
  errors: Error[]
}>
```

**What it does**:
- Create ACTOR entity for each COG (if actor-focused)
- Create BEHAVIOR entities for critical capabilities
- Create EVENT entities for critical requirements (if time-based)
- Generate DEPENDS_ON relationships (Capability → COG)
- Generate ENABLES relationships (Requirement → Capability)
- Generate EXPOSES relationships (Vulnerability → Requirement)

**1.2 UI Integration**
- Add "Create Entities" button in COGView
- Show dialog: "Create 3 Actors, 5 Behaviors, 12 Relationships?"
- Preview what will be created
- Confirm → Create → Show success toast
- Add "View in Network Graph" button after creation

**Impact**:
- ✅ COG data becomes part of global intelligence network
- ✅ Enables cross-framework correlation
- ✅ Powers network metrics (find most critical actors via centrality)

---

### Phase 2: Causeway Visualization & Integration ⭐ **MEDIUM PRIORITY**

**Goal**: Causeway analysis creates actor-target-action relationships

#### Implementation

**2.1 Causeway Network View**
- Create `CausewayNetworkVisualization.tsx` (similar to COGNetworkVisualization)
- Show Actor → Action → Target chains
- Color-code by action type (kinetic, cyber, information, etc.)
- Export to global network

**2.2 Auto-Entity Creation**
```typescript
// src/services/causeway-entity-mapper.ts
export async function createEntitiesFromCauseway(
  causewayRows: CausewayRow[],
  workspaceId: string
): Promise<EntityMapping>
```

**What it does**:
- Create ACTOR entities for each unique actor
- Create EVENT entities for each action
- Create PLACE entities for location (if specified)
- Generate TARGETED relationships
- Generate PERFORMED relationships
- Generate LOCATED_AT relationships

**Impact**:
- ✅ PUTAR/Causeway becomes network-ready
- ✅ Enables timeline analysis (when did Actor X target Y?)
- ✅ Enables geospatial analysis (where did actions occur?)

---

### Phase 3: Unified Network Entry Points 🔗 **HIGH PRIORITY**

**Goal**: Make it easy to jump between framework views and network graph

#### Implementation

**3.1 "View in Network" Buttons**

Add to **ALL** framework view pages:
```tsx
<Button
  variant="outline"
  onClick={() => navigate('/dashboard/network-graph', {
    state: { highlightEntities: [cogId, ...capabilityIds] }
  })}
>
  <Network className="h-4 w-4 mr-2" />
  View in Network Graph
</Button>
```

**3.2 Network Graph Deep Linking**

Support URL params:
- `/dashboard/network-graph?highlight=actor-123,event-456`
- `/dashboard/network-graph?focus=cog-789` (zoom to specific node)
- `/dashboard/network-graph?source=cog` (filter to show only COG-derived entities)

**3.3 Bi-Directional Navigation**

In NetworkGraphPage, when clicking a node:
- If entity came from COG → Show "View COG Analysis" button
- If entity came from Causeway → Show "View Causeway" button
- Store `source_framework_id` in entity metadata

**Impact**:
- ✅ Seamless navigation between detailed framework view and big-picture network
- ✅ Users discover connections they didn't know existed
- ✅ Reinforces value of doing structured analysis

---

### Phase 4: Enhanced Auto-Generation UI 🤖 **MEDIUM PRIORITY**

**Goal**: Make relationship generation smarter and more visible

#### Implementation

**4.1 Auto-Generate Preview Dialog**

Before creating relationships, show preview:
```
┌─────────────────────────────────────────────────┐
│ Auto-Generate Relationships from COG Analysis   │
├─────────────────────────────────────────────────┤
│ ✅ 3 Actors (from COGs)                         │
│ ✅ 8 Behaviors (from capabilities)              │
│ ✅ 15 Dependencies (capability → COG)           │
│ ✅ 22 Vulnerabilities (exposes relationships)   │
│                                                  │
│ Total: 48 new entities, 37 relationships        │
│                                                  │
│ [Cancel]  [Preview in Network]  [Create All]    │
└─────────────────────────────────────────────────┘
```

**4.2 Confidence Scoring**

Auto-assign confidence based on analysis quality:
- COG with high vulnerability scores → CONFIRMED relationships
- COG with low scores → PROBABLE relationships
- User can override before creation

**4.3 Batch Operations**

- "Generate from All COG Analyses" (workspace-wide)
- Progress bar: "Processing 5 of 23 analyses..."
- Summary report: "Created 127 entities, 89 relationships, 3 errors"

**Impact**:
- ✅ Users understand what will be created
- ✅ Reduces accidental duplicate creation
- ✅ Enables bulk operations for large analysis sets

---

## 🏗️ Technical Implementation Details

### Database Schema Changes

**Add source tracking to entities**:
```sql
ALTER TABLE actors ADD COLUMN source_framework_type TEXT;
ALTER TABLE actors ADD COLUMN source_framework_id TEXT;
ALTER TABLE relationships ADD COLUMN auto_generated BOOLEAN DEFAULT 0;
ALTER TABLE relationships ADD COLUMN source_framework_type TEXT;
ALTER TABLE relationships ADD COLUMN source_framework_id TEXT;

CREATE INDEX idx_actors_source_framework ON actors(source_framework_type, source_framework_id);
```

**Benefits**:
- Track which entities came from COG vs Causeway vs manual creation
- Enable "delete all auto-generated relationships from this COG"
- Support bi-directional navigation

### API Endpoints

```typescript
// New endpoints needed
POST /api/frameworks/:id/generate-entities
  // Creates entities from framework data
  // Returns: { entities: [], relationships: [], preview: boolean }

POST /api/frameworks/:id/export-to-network
  // Combines generate + create in one step

GET /api/entities/by-framework/:frameworkId
  // Get all entities derived from a specific framework
```

### Component Architecture

```
┌─────────────────────────────────────────────────┐
│         NetworkGraphPage (Global View)          │
│  - Shows ALL entities/relationships             │
│  - Deep linking support                         │
│  - Source filtering                             │
└───────────────┬─────────────────────────────────┘
                │
                │ Navigation Links
                │
    ┌───────────┴───────────┬──────────────────┐
    │                       │                  │
┌───▼──────────┐  ┌─────────▼────┐  ┌─────────▼────────┐
│   COGView    │  │ CausewayView │  │  GenericFramework│
│              │  │              │  │                  │
│ - Own viz    │  │ - Own viz    │  │ - Link Evidence  │
│ - Export btn │  │ - Export btn │  │ - View Network   │
└──────────────┘  └──────────────┘  └──────────────────┘
```

---

## 📈 Success Metrics

### User Experience Improvements

1. **Discovery**: Users find 3x more connections via network graph
2. **Efficiency**: 80% reduction in manual entity creation time
3. **Adoption**: 60% of users use "View in Network" within first week
4. **Correlation**: Users connect 5+ frameworks via shared entities

### Technical Metrics

1. **Entity Coverage**: 90% of COG analyses auto-generate entities
2. **Relationship Quality**: <5% false positive relationships
3. **Performance**: Auto-generation completes in <3 seconds
4. **Data Integrity**: Zero orphaned relationships

---

## 🚀 Implementation Phases & Timeline

### Quick Wins (Week 1) ⭐
1. Add "View in Network" button to COGView/CausewayView
2. Implement deep linking in NetworkGraphPage
3. Add source_framework_id to database

**Benefit**: Immediate navigation improvement

### Phase 1: COG Auto-Generation (Week 2-3)
1. Implement `cog-entity-mapper.ts`
2. Add "Create Entities" button to COGView
3. Add preview dialog
4. Test with 10 sample COG analyses

**Benefit**: COG data integrated into network

### Phase 2: Causeway Integration (Week 4-5)
1. Create `CausewayNetworkVisualization.tsx`
2. Implement `causeway-entity-mapper.ts`
3. Add export functionality
4. Test with 5 sample Causeway analyses

**Benefit**: Causeway becomes network-ready

### Phase 3: Enhanced UX (Week 6-7)
1. Batch operations UI
2. Confidence scoring
3. Relationship deduplication
4. Workspace-wide auto-generation

**Benefit**: Production-ready for large datasets

---

## 🎯 Recommended Next Steps

### Option 1: Start with Quick Win ⭐ **RECOMMENDED**
- **Time**: 1-2 days
- **Impact**: Immediate UX improvement
- **Tasks**:
  1. Add "View in Network Graph" buttons to COGView + CausewayView
  2. Implement highlight/focus deep linking in NetworkGraphPage
  3. Add breadcrumb: "From COG Analysis: [Title]" in network view
- **Why**: Shows value immediately, builds momentum for larger work

### Option 2: Full COG Auto-Generation
- **Time**: 1-2 weeks
- **Impact**: Transform how COG data is used
- **Tasks**: Implement Phase 1 entirely
- **Why**: Addresses core integration gap, enables advanced analysis

### Option 3: Causeway Visualization First
- **Time**: 1 week
- **Impact**: Makes Causeway more valuable
- **Tasks**: Build CausewayNetworkVisualization component
- **Why**: Causeway is relationship-heavy, perfect for network viz

---

## 💡 Additional Ideas (Future Enhancements)

### 1. Time-Based Network Animation
- Show how actor networks evolve over time
- Scrub timeline to see relationships appear/disappear
- Use EVENT entity timestamps

### 2. Geospatial Network Overlay
- Overlay network graph on map
- Show physical proximity + relationship proximity
- Useful for HUMINT/GEOINT correlation

### 3. AI-Powered Relationship Suggestions
- "You analyzed Actor X in COG, we found them in 3 Causeway rows"
- "This capability matches 2 behaviors in your behavior library"
- Smart entity deduplication

### 4. Multi-Framework Comparison View
- Load 2+ COG analyses
- Highlight overlapping entities
- Show conflicting assessments
- Reconciliation workflow

### 5. Export to External Tools
- Export to Palantir Gotham format
- Export to Analyst Notebook (i2)
- Export to Gephi for advanced network analysis

---

## 🤔 Questions for User

1. **Priority**: Which integration is most valuable?
   - Quick navigation links (1-2 days)?
   - Full COG auto-generation (1-2 weeks)?
   - Causeway visualization (1 week)?

2. **Workflow**: How do you currently use network analysis?
   - After creating COG/Causeway?
   - Before (to understand environment)?
   - Both?

3. **Entity Strategy**: When auto-creating entities:
   - Always create new (may duplicate)?
   - Smart matching (slower, more complex)?
   - Ask user each time?

4. **Confidence Handling**: For auto-generated relationships:
   - Default all to "PROBABLE"?
   - Score based on vulnerability scores?
   - Let user set per-analysis?

---

## 📝 Summary

**Current State**: Network graph and framework visualizations exist but are **siloed**

**Core Issue**: No bridge between COG/Causeway data and global entity network

**Recommended Approach**:
1. ⭐ **Start Quick** (1-2 days): Add navigation links + deep linking
2. 🔨 **Then Build** (2-3 weeks): Auto-entity generation from COG
3. 🚀 **Then Expand** (1-2 weeks): Causeway integration + advanced features

**Expected Impact**:
- Users discover 3x more intelligence connections
- 80% time savings on manual entity creation
- COG/Causeway become "network-first" tools
- Enables cross-framework correlation at scale
