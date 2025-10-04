# Entity Network Analysis & Relationship Management Plan

**Created:** October 3, 2025
**Status:** Planning & Design
**Priority:** High - Core Intelligence Capability

---

## 🎯 Requirements Analysis

### Core Requirements
1. **Universal Entity Linking** - Connect any entity to any other entity
2. **Bidirectional Relationships** - Actor↔Actor, Actor↔Event, Event↔Place, etc.
3. **Edge List Export** - CSV/JSON export for external analysis tools
4. **Graph Visualization** - Interactive nodal analysis and network graphs
5. **Framework Integration** - Connect with COG and Causeway analyses

### Current State Assessment

**Existing Infrastructure:**
✅ Entity types defined: Actor, Source, Event, Place, Behavior, Evidence
✅ Relationship interface exists in `types/entities.ts`
✅ RelationshipType enum with 12+ relationship types
✅ COG and Causeway frameworks implemented
✅ MOM-POP assessments create implicit actor-event relationships

**Gaps:**
❌ No UI for creating/managing relationships
❌ No relationship visualization
❌ No network graph component
❌ No export functionality
❌ No integration between entity network and frameworks

---

## 📋 INITIAL PLAN (v1.0)

### Phase 1: Relationship Management UI (6-8 hours)
**Goal:** Enable users to create and manage entity relationships

**Components:**
1. **RelationshipForm** - Create/edit relationships
   - Source entity selector (from context or dropdown)
   - Target entity selector (search across all entity types)
   - Relationship type selector (CONTROLS, REPORTS_TO, ALLIED_WITH, etc.)
   - Weight slider (0.0-1.0 for relationship strength)
   - Confidence selector (CONFIRMED, PROBABLE, POSSIBLE, SUSPECTED)
   - Date range (temporal relationships)
   - Evidence linking (supporting evidence IDs)

2. **RelationshipCard** - Display single relationship
   - Visual representation (Entity A → Type → Entity B)
   - Metadata (weight, confidence, dates)
   - Edit/delete actions

3. **RelationshipList** - Display multiple relationships
   - Filterable by entity, type, confidence
   - Sortable by date, weight
   - Bulk operations

4. **Entity Detail View Integration**
   - Add "Relationships" tab to all entity detail views
   - "Add Relationship" button
   - List all relationships (incoming and outgoing)
   - Visual indicators for relationship strength

### Phase 2: Network Visualization (8-10 hours)
**Goal:** Visualize entity network as interactive graph

**Components:**
1. **NetworkGraphPage** - Dedicated network analysis page
   - Full-screen graph canvas
   - Control panel (filters, layout options, search)
   - Selected node details panel
   - Export controls

2. **NetworkGraphComponent** - React force-directed graph
   - Library: `react-force-graph-2d` or `@visx/network`
   - Node rendering:
     - Color by entity type
     - Size by centrality/importance
     - Icons for entity types
     - Labels on hover
   - Edge rendering:
     - Color by relationship type
     - Thickness by weight
     - Style by confidence (solid/dashed)
     - Directional arrows
   - Interactions:
     - Zoom/pan
     - Click to select
     - Drag nodes
     - Right-click for context menu

3. **Network Filters**
   - Entity type filter (show/hide actors, events, etc.)
   - Relationship type filter
   - Confidence threshold
   - Date range filter
   - Depth of connections (1-hop, 2-hop, etc.)

### Phase 3: Export Functionality (4-6 hours)
**Goal:** Export network data for external analysis

**Export Formats:**

1. **Edge List CSV**
   ```csv
   source_id,source_type,target_id,target_type,relationship_type,weight,confidence,start_date,end_date
   actor_123,ACTOR,event_456,EVENT,PARTICIPATED_IN,0.9,CONFIRMED,2024-01-01,2024-01-15
   ```

2. **Node List CSV**
   ```csv
   id,type,label,category,deception_risk,significance
   actor_123,ACTOR,John Smith,Military,0.75,HIGH
   event_456,EVENT,Operation Blue Sky,OPERATION,N/A,CRITICAL
   ```

3. **JSON Graph**
   ```json
   {
     "nodes": [
       {"id": "actor_123", "type": "ACTOR", "label": "John Smith", "metadata": {...}}
     ],
     "edges": [
       {"source": "actor_123", "target": "event_456", "type": "PARTICIPATED_IN", "weight": 0.9}
     ]
   }
   ```

4. **GraphML/GEXF** (for Gephi, Cytoscape)
   - XML-based graph exchange formats
   - Preserves all metadata
   - Compatible with professional network analysis tools

**Export Component:**
- `NetworkExportDialog` with format selection
- Preview of data
- Subset selection (filtered network or full network)
- Download as file

### Phase 4: Network Analysis Metrics (6-8 hours)
**Goal:** Calculate and display network analysis metrics

**Metrics to Calculate:**

1. **Node-Level Metrics**
   - Degree centrality (# of connections)
   - Betweenness centrality (bridge nodes)
   - Closeness centrality (avg distance to all nodes)
   - Eigenvector centrality (importance based on neighbors)
   - PageRank (Google's algorithm)

2. **Network-Level Metrics**
   - Number of nodes/edges
   - Network density
   - Average clustering coefficient
   - Number of communities/clusters
   - Average path length
   - Network diameter

3. **Path Analysis**
   - Shortest path between two entities
   - All paths within N hops
   - Critical paths (highest weighted path)

**UI Components:**
- `NetworkMetricsPanel` - Display calculated metrics
- `PathFinderDialog` - Find paths between entities
- `CentralityRanking` - Top nodes by centrality
- Metric visualization (histograms, distributions)

### Phase 5: Framework Integration (8-10 hours)
**Goal:** Connect entity network with COG and Causeway frameworks

**COG Integration:**

Current COG structure:
```typescript
interface COGAnalysis {
  critical_capabilities: Array<{name, description, assessment}>
  critical_requirements: Array<{name, description, assessment}>
  critical_vulnerabilities: Array<{name, description, assessment}>
}
```

**Enhancement:**
```typescript
interface COGElement {
  name: string
  description: string
  assessment: string
  linked_entities: string[]  // Entity IDs
  entity_type: EntityType
}
```

**Features:**
- Map COG elements to entities (Actor, Place, System)
- Show COG network (capabilities → requirements → vulnerabilities)
- Highlight critical nodes in main network
- Export COG-specific subgraph

**Causeway Integration:**

Current Causeway structure:
```typescript
interface CausewayRow {
  action: string
  actor: string
  target: string
  means: string
  when: string
  // ... other columns
}
```

**Enhancement:**
- Each row becomes a set of entities + relationships
- Action → Event entity
- Actor → Actor entity
- Target → Actor/Place entity
- Relationships: PERFORMED, TARGETED, USED_MEANS
- Visualize causal chain as directed graph
- Path analysis shows cause-effect sequences

**Implementation:**
1. Add `linked_entity_id` field to COG/Causeway elements
2. Entity selector in COG/Causeway forms
3. "View Network" button in COG/Causeway views
4. Network graph filtered to show COG/Causeway subgraph

---

## 🎯 PLAN GRADING (v1.0)

### Grading Criteria & Scores

| Criterion | Weight | Score | Reasoning |
|-----------|--------|-------|-----------|
| **Completeness** | 25% | 7/10 | Covers main requirements but missing: <br>- Relationship validation rules<br>- Conflict detection (contradictory relationships)<br>- Temporal network evolution visualization<br>- Recommendation engine for relationships |
| **Usability** | 20% | 6/10 | Good UI components but missing:<br>- Quick-create relationship shortcuts<br>- Relationship templates<br>- Guided relationship creation<br>- Bulk import from CSV |
| **Integration** | 20% | 8/10 | Strong framework integration but could improve:<br>- Automatic relationship inference from frameworks<br>- Bi-directional sync (framework ↔ network)<br>- MOM-POP relationship auto-generation |
| **Scalability** | 15% | 5/10 | Potential issues:<br>- Force-directed graph doesn't scale to 1000+ nodes<br>- No graph database consideration<br>- No pagination for relationship lists<br>- No clustering/aggregation for large networks |
| **Value** | 20% | 8/10 | High analytical value but missing:<br>- Intelligence products (link charts, association matrices)<br>- Anomaly detection in network patterns<br>- Change detection over time<br>- Predictive analytics |

**TOTAL SCORE: 6.8/10** - Good foundation but needs improvements

### Identified Weaknesses

1. **Scalability Concerns**
   - Force-directed graphs struggle with >200 nodes
   - No strategy for large-scale networks
   - Memory/performance issues not addressed

2. **Missing Intelligence Features**
   - No link analysis tools (shortest path emphasis, key nodes)
   - No pattern detection (cliques, triangles, hubs)
   - No temporal analysis (how network evolves)
   - No predictive capabilities

3. **User Experience Gaps**
   - Relationship creation too manual
   - No smart suggestions
   - No templates for common patterns
   - Missing bulk operations

4. **Framework Integration Depth**
   - COG/Causeway integration is superficial
   - Not leveraging frameworks to auto-generate relationships
   - Missing opportunity for framework validation via network

---

## ✅ IMPROVED PLAN (v2.0)

### Added Phase 0: Data Model & API Enhancement (3-4 hours)

**Relationship Enhancements:**
```typescript
interface Relationship {
  // Existing fields...

  // NEW: Metadata
  auto_generated: boolean  // System vs user-created
  generation_source?: string  // "MOM_ASSESSMENT" | "COG_ANALYSIS" | "CAUSEWAY"
  inference_confidence?: number  // 0-1 for inferred relationships

  // NEW: Validation
  validated_by?: number  // User ID who validated
  validation_status: 'PENDING' | 'VALIDATED' | 'REJECTED'

  // NEW: Conflict detection
  conflicts_with?: string[]  // IDs of contradictory relationships
}
```

**API Additions:**
- `POST /api/relationships/bulk` - Bulk create relationships
- `GET /api/relationships/suggest?entity_id={id}` - AI-suggested relationships
- `POST /api/relationships/validate/{id}` - Validate inferred relationship
- `GET /api/network/metrics` - Calculate network metrics
- `GET /api/network/export?format={csv|json|graphml}` - Export network

### Enhanced Phase 2: Advanced Visualization (10-12 hours)

**Scalability Solutions:**

1. **Graph Layout Options**
   - Force-directed (default, <200 nodes)
   - Hierarchical (tree layout for org charts)
   - Circular (highlight relationships)
   - Geographic (if entities have locations)
   - Matrix view (adjacency matrix heatmap)

2. **Large Network Handling**
   - Clustering: Aggregate nodes by type/category
   - LOD (Level of Detail): Show summary nodes, expand on click
   - Filtering: Progressive disclosure
   - Pagination: Load network in chunks
   - WebGL rendering for 1000+ nodes (use `react-force-graph-3d`)

3. **Multiple View Modes**
   - `NetworkGraphCanvas` (2D force-directed)
   - `NetworkMatrix` (adjacency matrix)
   - `NetworkHierarchy` (tree/org chart)
   - `NetworkTimeline` (temporal evolution)
   - `NetworkGeo` (geographic overlay)

### Enhanced Phase 4: Intelligence Analysis Tools (8-10 hours)

**Advanced Analytics:**

1. **Pattern Detection**
   ```typescript
   interface NetworkPattern {
     type: 'CLIQUE' | 'CHAIN' | 'STAR' | 'TRIANGLE' | 'LOOP'
     entities: string[]
     significance: number
     description: string
   }
   ```
   - Detect cliques (fully connected groups)
   - Find chains (linear sequences)
   - Identify stars (hub-and-spoke)
   - Triangle detection (A→B→C→A)
   - Loop detection (cycles)

2. **Anomaly Detection**
   - Unexpected relationships
   - Isolated nodes (should be connected)
   - Over-connected nodes (potential errors)
   - Temporal anomalies (sudden changes)

3. **Temporal Analysis**
   - Network snapshots at different times
   - Relationship timeline
   - Growth/decay of connections
   - Event impact on network structure

4. **Predictive Analytics**
   - Link prediction (likely future relationships)
   - Missing link detection
   - Relationship strength prediction
   - Cascade analysis (impact propagation)

**Intelligence Products:**

1. **Link Chart Generator**
   - Export publication-quality diagrams
   - Annotations and labels
   - Highlight key nodes/paths
   - Print-ready format (PDF, PNG)

2. **Association Matrix**
   - Entity × Entity heatmap
   - Relationship strength visualization
   - Identify clusters

3. **Network Report**
   - Executive summary
   - Key findings (central nodes, critical paths)
   - Metrics dashboard
   - Recommendations

### Enhanced Phase 5: Deep Framework Integration (10-12 hours)

**Automatic Relationship Generation:**

1. **From MOM Assessments**
   ```typescript
   // When MOM assessment created:
   createRelationship({
     source: mom_assessment.actor_id,
     target: mom_assessment.event_id,
     type: 'ASSESSED_FOR',
     weight: (motive + opportunity + means) / 15,  // 0-1
     auto_generated: true,
     generation_source: 'MOM_ASSESSMENT'
   })
   ```

2. **From COG Analysis**
   ```typescript
   // Critical Capability depends on Critical Requirement
   createRelationship({
     source: capability.linked_entity_id,
     target: requirement.linked_entity_id,
     type: 'DEPENDS_ON',
     auto_generated: true,
     generation_source: 'COG_ANALYSIS'
   })
   ```

3. **From Causeway**
   ```typescript
   // Each Causeway row creates multiple relationships:
   - Actor PERFORMED Action
   - Action TARGETED Target
   - Action USED Means
   - Action OCCURRED_AT When (temporal)
   ```

**Framework Validation via Network:**

1. **COG Validation**
   - Identify true centers of gravity by betweenness centrality
   - Validate critical requirements by dependency analysis
   - Find vulnerabilities by single-point-of-failure analysis

2. **Causeway Validation**
   - Verify causal chains are connected
   - Identify gaps in cause-effect logic
   - Suggest missing intermediate steps

**Bi-directional Sync:**
- Network changes update frameworks
- Framework changes update network
- Conflict resolution UI

### New Phase 6: User Experience Enhancements (6-8 hours)

**Quick Actions:**
1. **Context Menus**
   - Right-click entity → "Add Relationship"
   - Quick-add common relationships
   - Drag-and-drop to create connections

2. **Relationship Templates**
   - "Organization Hierarchy" template
   - "Event Participation" template
   - "Source-Evidence Chain" template
   - Custom templates

3. **Smart Suggestions**
   - "People who worked on Event A also worked on Event B"
   - "Actor X is often associated with Place Y"
   - "Source Z usually provides Evidence for Actor W"

4. **Bulk Operations**
   - CSV import of relationships
   - Multi-select and bulk add
   - Copy relationship patterns

---

## 📊 IMPROVED PLAN GRADING (v2.0)

| Criterion | Weight | v1.0 | v2.0 | Improvement |
|-----------|--------|------|------|-------------|
| **Completeness** | 25% | 7/10 | 9/10 | +2 - Added validation, conflict detection, temporal analysis, recommendations |
| **Usability** | 20% | 6/10 | 9/10 | +3 - Templates, quick actions, smart suggestions, bulk import |
| **Integration** | 20% | 8/10 | 10/10 | +2 - Auto-generation, bi-directional sync, validation |
| **Scalability** | 15% | 5/10 | 8/10 | +3 - Clustering, LOD, multiple views, WebGL |
| **Value** | 20% | 8/10 | 10/10 | +2 - Intelligence products, anomaly detection, predictive analytics |

**NEW TOTAL SCORE: 9.2/10** - Comprehensive, production-ready solution

---

## 🚀 IMPLEMENTATION ROADMAP

### Sprint 1: Foundation (Weeks 1-2)
- [ ] Phase 0: Data model & API (3-4h)
- [ ] Phase 1: Relationship management UI (6-8h)
- [ ] Basic relationship CRUD
- [ ] Entity detail view integration

**Deliverable:** Users can create and manage relationships manually

### Sprint 2: Visualization (Weeks 3-4)
- [ ] Phase 2: Network visualization (10-12h)
- [ ] Force-directed graph
- [ ] Filters and controls
- [ ] Multiple view modes

**Deliverable:** Interactive network graph with filtering

### Sprint 3: Export & Analysis (Weeks 5-6)
- [ ] Phase 3: Export functionality (4-6h)
- [ ] Phase 4: Network analytics (8-10h)
- [ ] CSV/JSON export
- [ ] Metrics calculation
- [ ] Pattern detection

**Deliverable:** Export capabilities and basic analytics

### Sprint 4: Intelligence Features (Weeks 7-8)
- [ ] Phase 4 (continued): Advanced analytics (8-10h)
- [ ] Anomaly detection
- [ ] Temporal analysis
- [ ] Intelligence products

**Deliverable:** Professional intelligence analysis tools

### Sprint 5: Framework Integration (Weeks 9-10)
- [ ] Phase 5: COG/Causeway integration (10-12h)
- [ ] Auto-relationship generation
- [ ] Validation tools
- [ ] Bi-directional sync

**Deliverable:** Seamless framework integration

### Sprint 6: UX Polish (Week 11)
- [ ] Phase 6: UX enhancements (6-8h)
- [ ] Templates and quick actions
- [ ] Smart suggestions
- [ ] Bulk operations

**Deliverable:** Production-ready, polished UX

---

## 📐 TECHNICAL ARCHITECTURE

### Frontend Components
```
src/components/network/
├── RelationshipForm.tsx          # Create/edit relationships
├── RelationshipCard.tsx          # Display single relationship
├── RelationshipList.tsx          # List with filters
├── NetworkGraphPage.tsx          # Full network analysis page
├── NetworkGraphCanvas.tsx        # Force-directed graph
├── NetworkMatrix.tsx             # Adjacency matrix view
├── NetworkHierarchy.tsx          # Tree/org chart view
├── NetworkTimeline.tsx           # Temporal evolution
├── NetworkMetricsPanel.tsx       # Display metrics
├── NetworkExportDialog.tsx       # Export controls
├── PathFinderDialog.tsx          # Find paths
├── PatternDetectionPanel.tsx    # Show detected patterns
└── NetworkControls.tsx           # Filters, layout, etc.
```

### Data Flow
```
User Action (Create Relationship)
  ↓
RelationshipForm validates input
  ↓
POST /api/relationships
  ↓
Backend creates relationship + auto-infers related relationships
  ↓
WebSocket update to frontend
  ↓
Network graph re-renders with new edge
  ↓
Metrics recalculated
```

### Libraries
- `react-force-graph-2d` - 2D force-directed graphs
- `react-force-graph-3d` - 3D graphs for large networks
- `@visx/network` - Alternative graph visualization
- `graphology` - Graph data structure and algorithms
- `papaparse` - CSV export
- `file-saver` - File download
- `d3-force` - Force simulation algorithms

---

## 🎯 SUCCESS METRICS

### User Adoption
- [ ] 80%+ of entities have at least 1 relationship
- [ ] Average 5+ relationships per entity
- [ ] 50%+ of users create custom relationships weekly

### Analytical Value
- [ ] 10+ intelligence products exported per week
- [ ] Network analysis influences 50%+ of COG analyses
- [ ] Path finding used in 30%+ of investigations

### System Performance
- [ ] Graph renders in <2s for 500 nodes
- [ ] Metrics calculate in <5s
- [ ] Export completes in <10s for 1000 nodes

---

## 📝 NEXT STEPS

1. **Review & Approve** this plan
2. **Prioritize** phases based on immediate needs
3. **Begin Sprint 1** implementation
4. **Iterate** based on user feedback

**Estimated Total Effort:** 55-70 hours (6-8 weeks with testing)

---

**Status:** ✅ Plan Complete - Ready for Review & Implementation
