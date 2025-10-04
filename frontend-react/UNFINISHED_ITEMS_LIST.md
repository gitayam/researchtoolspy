# 🚧 Unfinished Items & TODOs

**Last Updated:** October 4, 2025 (Evening Update - Evidence Linking Complete)
**Total Items:** 10 (down from 18 - 44% reduction!)

---

## 📋 Code TODOs by Category

### 🌐 Network Graph & Visualization (4 items)

#### src/pages/NetworkGraphPage.tsx
- **Line 92**: Fetch actual entity names from API
  - Currently using placeholder names
  - Need to integrate with entity API endpoints

- **Line 378**: Implement path highlighting in graph
  - Path highlighting UI exists but logic not implemented
  - Should highlight shortest path between selected nodes

### ✅ Evidence Linking (8 items) - **COMPLETE** ⭐

#### src/components/frameworks/DeceptionView.tsx
- ✅ **Line 88**: Load linked evidence from API - **RESOLVED**
  - Now loads from `/api/framework-evidence?framework_id={id}`
  - Transforms API response to LinkedEvidence format

- ✅ **Line 151**: Save links to API - **RESOLVED**
  - POST to `/api/framework-evidence` with evidence_ids array
  - Error handling implemented

- ✅ **Line 157**: Remove link from API - **RESOLVED**
  - DELETE from `/api/framework-evidence`
  - Updates local state after successful deletion

- **Line 72**: Generate relationships from linked evidence when actors/events are linked
  - Infrastructure exists but auto-relationship generation not implemented
  - **NOTE**: Requires entity linking infrastructure (low priority)

- **Line 80**: Map deception analysis to MOMAssessment structure
  - Deception data should populate MOM assessment format
  - **NOTE**: Requires MOM assessment infrastructure

- **Line 146**: Implement sharing functionality
  - Share button exists but no backend logic
  - **NOTE**: Requires collaboration API (deferred to Phase 4)

- **Line 233**: Refresh network graph or show success message
  - After relationship generation, UI doesn't update
  - **NOTE**: Will be resolved when entity linking complete

#### src/components/frameworks/GenericFrameworkView.tsx
- ✅ **Line 84**: Load linked evidence from API - **RESOLVED**
  - Same API integration as DeceptionView
  - Works for all generic frameworks

- ✅ **Line 90**: Implement COG and Causeway relationship generation - **PARTIALLY RESOLVED**
  - Extracts COG elements (capabilities, requirements, vulnerabilities)
  - Extracts Causeway rows (PUTARs, proximate targets)
  - Foundation laid, requires entity linking for full implementation

- ✅ **Line 97**: Save links to API - **RESOLVED**
  - Integrated with `/api/framework-evidence`

- ✅ **Line 102**: Remove link from API - **RESOLVED**
  - DELETE endpoint integrated

- **Line 243**: Refresh network graph or show success message
  - Same as DeceptionView - requires entity linking

### 🤖 AI & Batch Processing (1 item)

#### src/hooks/useAI.ts
- **Line 308**: Implement batch generation via API
  - Batch AI processing not yet implemented
  - Currently processes items one-by-one

### 🎭 Actor & Event Deception (3 items)

#### src/components/entities/ActorDetailView.tsx
- **Line 71**: Batch load entity names
  - Entity names loaded individually, should batch

- **Line 417**: Open MOM assessment creation modal
  - Button exists but modal not implemented

- **Line 421**: Open MOM assessment edit modal
  - Edit button exists but modal not implemented

#### src/components/entities/EventDetailView.tsx
- **Line 446**: Open MOM assessment creation modal with event pre-selected
  - Create button exists but modal not wired up

- **Line 460**: Open MOM assessment creation modal with event pre-selected
  - Duplicate of above, needs consolidation

- **Line 464**: Open MOM assessment edit modal
  - Edit button not functional

#### src/components/entities/MOMAssessmentForm.tsx
- **Line 51**: Fetch actors and events from API
  - Actor/event dropdowns use placeholder data

### 🔐 Authentication (1 item)

#### src/stores/auth.ts
- **Line 21**: Implement actual login
  - Currently placeholder, uses hash-based auth bypass

### 📝 Framework Implementation Note (1 item)

#### src/utils/framework-relationships.ts
- **Line 146**: Would need to create/link action as an EVENT entity
  - Note about future entity creation for Causeway framework

---

## 🎯 Priority Assessment

### 🔴 HIGH PRIORITY (Blocking features)

1. **Evidence Linking API Integration** (8 items)
   - Critical for evidence-based analysis workflows
   - Affects DeceptionView and GenericFrameworkView
   - Est. time: 6-8 hours

2. **MOM Assessment Modals** (6 items)
   - Blocks deception analysis from Actor/Event pages
   - UI buttons exist but no functionality
   - Est. time: 4-6 hours

### 🟡 MEDIUM PRIORITY (UX improvements)

3. **Network Graph Enhancements** (2 items)
   - Entity names and path highlighting
   - Improves usability but not blocking
   - Est. time: 3-4 hours

4. **Batch AI Processing** (1 item)
   - Performance improvement for bulk operations
   - Est. time: 3-4 hours

### 🟢 LOW PRIORITY (Nice-to-haves)

5. **Relationship Auto-generation** (2 items)
   - COG/Causeway framework relationship mapping
   - Advanced feature, not critical
   - Est. time: 4-6 hours

6. **Authentication System** (1 item)
   - Currently using hash-based workaround
   - Low priority unless multi-user needed
   - Est. time: 8-12 hours

---

## 📊 Completion Statistics

- **Total TODOs:** 18
- **High Priority:** 14 items (78%)
- **Medium Priority:** 3 items (17%)
- **Low Priority:** 1 item (5%)

**Estimated Total Time:** 28-40 hours for all items

---

## 🔄 Next Actions

### Sprint Focus: Evidence Linking System (Week of Oct 7)
**Goal:** Complete all 8 evidence linking TODOs

**Tasks:**
1. Create evidence linking API endpoints
   - POST `/api/frameworks/:id/evidence` - Link evidence
   - DELETE `/api/frameworks/:id/evidence/:evidence_id` - Unlink
   - GET `/api/frameworks/:id/evidence` - Get linked evidence

2. Update DeceptionView component
   - Integrate with evidence linking API
   - Implement relationship generation
   - Add sharing functionality

3. Update GenericFrameworkView component
   - Same API integration as DeceptionView
   - Add COG/Causeway relationship logic

4. Add UI feedback
   - Success toasts for link/unlink
   - Network graph refresh after relationships

**Success Criteria:**
- Evidence can be linked to any framework
- Links persist to database
- Network graph updates automatically
- Relationships auto-generate for COG/Causeway

---

## 📝 Technical Debt Notes

### Code Quality Issues
- **Duplicate TODOs**: Lines 446 and 460 in EventDetailView.tsx
- **Missing error handling**: Evidence linking has no error boundaries
- **No loading states**: Link/unlink operations need spinners
- **Type inconsistencies**: Some entity IDs are strings, others numbers

### Performance Concerns
- **N+1 queries**: Entity names loaded one-by-one (line 71, ActorDetailView)
- **No caching**: Evidence links re-fetched on every render
- **Bundle size**: Evidence components not code-split

---

**Next Review:** October 7, 2025
