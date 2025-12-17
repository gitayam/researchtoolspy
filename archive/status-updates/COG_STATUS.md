# COG Analysis Framework - Implementation Status

## ✅ Completed Components

### 1. Type System (`/src/types/cog-analysis.ts`)
Comprehensive TypeScript definitions for:

**Core Entities:**
- `CenterOfGravity` - Sources of power across DIMEFIL domains (Diplomatic, Information, Military, Economic, Financial, Intelligence, Law Enforcement, Cyber, Space)
- `CriticalCapability` - What COG can DO (verb-oriented)
- `CriticalRequirement` - Resources/conditions NEEDED (noun-oriented)
- `CriticalVulnerability` - Weaknesses to exploit (noun with scoring)

**Operational Context:**
- Guided questions for objective, desired impact, identity, environment
- Constraints and restraints tracking
- Timeframe and strategic level

**Scoring Systems:**
- **Linear Scale**: 1-5 (equal intervals)
- **Logarithmic Scale**: 1, 3, 5, 8, 12 (exponential impact)

**Scoring Criteria:**
- Impact on COG (I) - How significantly affects the COG
- Attainability (A) - Feasibility with available resources
- Follow-Up Potential (F) - Strategic advantages enabled
- **Composite Score** = I + A + F

**Network Analysis:**
- Edge list generation (COG→Capability→Requirement→Vulnerability)
- Centrality measures (degree, betweenness, closeness, eigenvector)
- Helper functions for scoring and ranking

**Actor Categories:**
- Friendly Forces
- Adversary
- Host Nation
- Third Party

### 2. Framework Configuration Update
Updated `/config/framework-configs.ts` with:
- Custom COG implementation flag (not Q&A based)
- 6 specialized sections:
  1. Operational Context (guided questions)
  2. Centers of Gravity (DIMEFIL domains)
  3. Critical Capabilities (verbs/actions)
  4. Critical Requirements (resources)
  5. Critical Vulnerabilities (weaknesses with scoring)
  6. Network Analysis (visualization)

### 3. Documentation
Created comprehensive implementation guide (`/docs/COG_IMPLEMENTATION_GUIDE.md`) with:
- Architecture overview
- Data structure hierarchy
- Scoring guide (linear vs logarithmic)
- Component specifications
- Workflow examples
- API endpoint definitions
- Testing scenarios
- Future enhancement roadmap
- Reference to Irregularpedia: https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide

### 4. Form Component (Started)
Basic structure for `/components/frameworks/COGForm.tsx`:
- Header with reference link to Irregularpedia
- State management for all entities
- CRUD operations for COG/Capability/Requirement/Vulnerability
- Evidence linking integration points
- Scoring system selector

## 🚧 In Progress / Next Steps

### 1. Complete COG Form Component
**Need to add:**
- Operational Context section (guided questions UI)
- COG management cards with actor/domain selectors
- Capability cards linked to COGs
- Requirement cards linked to capabilities
- Vulnerability cards with scoring interface:
  - Impact/Attainability/Follow-up sliders
  - Score descriptions (tooltips)
  - Real-time composite score calculation
  - Priority ranking display
- Evidence linking modals for each entity
- Tabs or accordion UI for organization

**Implementation Pattern:**
```tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="context">Operational Context</TabsTrigger>
    <TabsTrigger value="cogs">Centers of Gravity</TabsTrigger>
    <TabsTrigger value="analysis">Analysis & Network</TabsTrigger>
  </TabsList>

  <TabsContent value="context">
    {/* Guided questions form */}
  </TabsContent>

  <TabsContent value="cogs">
    {/* COG cards with capabilities/requirements/vulnerabilities */}
  </TabsContent>

  <TabsContent value="analysis">
    {/* Network preview and scoring summary */}
  </TabsContent>
</Tabs>
```

### 2. Create COG View Component
`/components/frameworks/COGView.tsx` should include:

**Display Sections:**
1. **Header**: Title, description, edit/delete buttons
2. **Operational Context Panel**: Display guided questions and answers
3. **COG Overview Cards**: Group by actor category
   - Show domain badges
   - Link to evidence
4. **Analysis Tree View**: Expandable hierarchy
   ```
   📍 COG: Adversary Information COG
     └─⚡ Capability: Influence Public Opinion
        └─📋 Requirement: Social Media Platforms
           └─⚠️ Vulnerability: Platform Policy (Score: 21, Rank #1)
   ```
5. **Vulnerability Scorecard Table**:
   - Sorted by composite score (desc)
   - Columns: Vulnerability | Type | I | A | F | Score | Rank
   - Color coding by priority
6. **Network Visualization**:
   - Force-directed graph using existing NetworkGraphCanvas
   - Node sizes by centrality
   - Edge weights from scores
   - Click to highlight paths
7. **Centrality Metrics Panel**:
   - Top 5 by degree centrality
   - Top 5 by betweenness
   - Key nodes identification
8. **Export Buttons**:
   - Edge list CSV
   - Report (Markdown)
   - Network diagram (PNG)

### 3. Update Page Routing
In `/pages/frameworks/index.tsx`, replace generic COG page:

```tsx
// Change from:
export const CogPage = () => <GenericFrameworkPage frameworkKey="cog" />

// To custom implementation:
export const CogPage = () => {
  // Similar structure to DeceptionPage
  const config = frameworkConfigs['cog']
  // ... custom COG CRUD logic

  if (isCreateMode) {
    return <COGForm mode="create" onSave={handleSave} backPath={basePath} />
  }

  if (isEditMode && currentAnalysis) {
    return <COGForm mode="edit" initialData={parsedData} onSave={handleSave} backPath={basePath} frameworkId={id} />
  }

  if (isViewMode && currentAnalysis) {
    return <COGView data={parsedData} onEdit={...} onDelete={...} backPath={basePath} />
  }

  // List view...
}
```

### 4. Network Analysis Integration
Create `/components/frameworks/COGNetworkAnalysis.tsx`:
- Use existing `NetworkGraphCanvas` component
- Convert COG entities to nodes
- Use `generateEdgeList()` for links
- Display centrality metrics
- Export functionality

**Integration:**
```tsx
import { generateEdgeList, calculateCentralityMeasures } from '@/types/cog-analysis'
import { NetworkGraphCanvas } from '@/components/network/NetworkGraphCanvas'

const edges = generateEdgeList(cogAnalysis)
const centrality = calculateCentralityMeasures(edges)

// Convert to graph format
const nodes = [
  ...cogAnalysis.centers_of_gravity.map(cog => ({
    id: cog.id,
    name: `${cog.actor_category} - ${cog.domain}`,
    entityType: 'cog',
    val: centrality.degree_centrality[cog.id] || 1
  })),
  // ... capabilities, requirements, vulnerabilities
]
```

### 5. Evidence Integration
**Already Available:**
- `EvidenceLinker` component for selecting evidence
- Link/unlink evidence to each entity
- Display `EvidenceItemBadge` for linked evidence

**Integration Points:**
```tsx
// In COG Form
<Button onClick={() => openEvidenceLinker('cog', cogId)}>
  <Link2 className="h-4 w-4 mr-2" />
  Link Evidence ({cog.linked_evidence.length})
</Button>

<EvidenceLinker
  open={evidenceLinkerOpen}
  onClose={() => setEvidenceLinkerOpen(false)}
  onLink={handleEvidenceLink}
  alreadyLinked={getAlreadyLinked()}
/>
```

### 6. Export Functionality
Create export utilities:

**Edge List CSV:**
```typescript
function exportEdgeList(analysis: COGAnalysis) {
  const edges = generateEdgeList(analysis)
  const csv = [
    'Source,Source Type,Target,Target Type,Weight,Relationship',
    ...edges.map(e => `${e.source},${e.source_type},${e.target},${e.target_type},${e.weight},${e.relationship}`)
  ].join('\n')

  downloadCSV(csv, `cog_edges_${analysis.title}.csv`)
}
```

**Report Markdown:**
```typescript
function exportReport(analysis: COGAnalysis) {
  const md = `
# COG Analysis: ${analysis.title}

## Operational Context
- **Objective:** ${analysis.operational_context.objective}
- **Timeframe:** ${analysis.operational_context.timeframe}

## Centers of Gravity
${analysis.centers_of_gravity.map(cog => `
### ${cog.actor_category} - ${cog.domain}
${cog.description}
`).join('\n')}

## Critical Vulnerabilities (Prioritized)
${rankedVulnerabilities.map((v, i) => `
${i + 1}. **${v.vulnerability}** (Score: ${v.composite_score})
   - Impact: ${v.scoring.impact_on_cog}
   - Attainability: ${v.scoring.attainability}
   - Follow-up: ${v.scoring.follow_up_potential}
`).join('\n')}
  `

  downloadMarkdown(md, `cog_report_${analysis.title}.md`)
}
```

## 📋 Quick Start Checklist

To complete the COG implementation:

1. [ ] Finish COGForm.tsx component
   - [ ] Add operational context section
   - [ ] Implement COG CRUD with domain selectors
   - [ ] Add capability management (linked to COGs)
   - [ ] Add requirement management (linked to capabilities)
   - [ ] Add vulnerability management with scoring UI
   - [ ] Integrate evidence linker

2. [ ] Create COGView.tsx component
   - [ ] Display operational context
   - [ ] Show COG hierarchy tree
   - [ ] Vulnerability scorecard table
   - [ ] Network visualization
   - [ ] Centrality metrics panel
   - [ ] Export buttons

3. [ ] Update routing in index.tsx
   - [ ] Replace GenericFrameworkPage with custom COGPage
   - [ ] Add create/edit/view mode handling
   - [ ] Implement save/delete handlers

4. [ ] Create COGNetworkAnalysis.tsx
   - [ ] Convert entities to network format
   - [ ] Integrate NetworkGraphCanvas
   - [ ] Display centrality metrics

5. [ ] Add export utilities
   - [ ] Edge list CSV export
   - [ ] Markdown report export
   - [ ] Network diagram export

6. [ ] Testing
   - [ ] Create test COG analysis
   - [ ] Test scoring calculations
   - [ ] Test network generation
   - [ ] Test evidence linking
   - [ ] Test export functionality

## 🎯 Current Functional Status

**What Works:**
- ✅ Type system with full TypeScript support
- ✅ Scoring calculations (linear and logarithmic)
- ✅ Edge list generation
- ✅ Centrality measure calculations (basic implementation)
- ✅ Vulnerability ranking by composite score
- ✅ Framework configuration
- ✅ Reference documentation

**What's Needed:**
- ⏳ UI components (Form and View)
- ⏳ Routing integration
- ⏳ Full network visualization
- ⏳ Export functionality
- ⏳ Evidence display in view mode

## 🔗 Integration Points

The COG framework integrates with existing systems:

1. **Evidence System** → Link evidence to any COG entity
2. **Network Graph** → Visualize COG relationships with existing NetworkGraphCanvas
3. **Entity System** → Reference actors, places, events in COG analysis
4. **Framework System** → Saves via standard /api/frameworks endpoint

## 📚 Reference

- **Implementation Guide**: `/docs/COG_IMPLEMENTATION_GUIDE.md`
- **Type Definitions**: `/src/types/cog-analysis.ts`
- **Irregularpedia**: https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide

## 💡 Key Design Decisions

1. **Not Q&A Based**: Unlike other frameworks, COG uses specialized structured data (not simple Q&A pairs)

2. **Hierarchical Structure**: COG → Capability → Requirement → Vulnerability maintains logical flow per JP 3-0

3. **Dual Scoring**: Support both linear (simpler) and logarithmic (captures exponential impact) scales

4. **Network-First**: Built with network analysis as core feature (not afterthought)

5. **Evidence Integration**: Every entity can link to evidence for traceability

6. **Guided Workflow**: Operational context questions guide users through proper COG analysis methodology
