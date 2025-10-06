# COG Analysis Framework - Implementation Guide

## Overview

This COG (Center of Gravity) Analysis framework implements the Joint Publication 3-0 methodology with enhanced capabilities for:
- Multi-domain analysis (DIMEFIL)
- Vulnerability scoring (linear/logarithmic)
- Network visualization with centrality measures
- Evidence integration
- Guided workflow with operational context

## Architecture

### Type System (`/src/types/cog-analysis.ts`)

**Core Entities:**
- `CenterOfGravity`: Source of power across DIMEFIL domains
- `CriticalCapability`: What the COG can DO (verbs)
- `CriticalRequirement`: What's NEEDED for capabilities (nouns/resources)
- `CriticalVulnerability`: WEAKNESSES to exploit (nouns with scoring)

**Scoring Systems:**
- **Linear**: 1-5 scale for straightforward assessment
- **Logarithmic**: 1, 3, 5, 8, 12 scale for exponential impact

**Scoring Criteria:**
- Impact on COG (I): How significantly affects the COG
- Attainability (A): Feasibility with available resources
- Follow-Up Potential (F): Strategic advantages enabled

**Composite Score** = I + A + F (used for prioritization)

### Data Structure

```
COG Analysis
├── Operational Context (guided questions)
│   ├── Objective
│   ├── Desired Impact
│   ├── Our Identity
│   ├── Operating Environment
│   ├── Constraints/Restraints
│   └── Timeframe
│
├── Centers of Gravity (per actor/domain)
│   ├── Actor Category (Friendly/Adversary/Host Nation)
│   ├── DIMEFIL Domain
│   └── Linked Evidence
│
├── Critical Capabilities (linked to COGs)
│   ├── Capability (verb/action)
│   ├── Strategic Contribution
│   ├── Optional Scoring
│   └── Linked Evidence
│
├── Critical Requirements (linked to Capabilities)
│   ├── Requirement (noun/resource)
│   ├── Type (personnel/equipment/logistics/etc.)
│   └── Linked Evidence
│
└── Critical Vulnerabilities (linked to Requirements)
    ├── Vulnerability (specific weakness)
    ├── Type (physical/cyber/human/etc.)
    ├── Required Scoring (I/A/F)
    ├── Composite Score (calculated)
    ├── Priority Rank (calculated)
    └── Linked Evidence
```

### Network Analysis

**Edge List Generation:**
- COG → Capability (relationship: "enables")
- Capability → Requirement (relationship: "requires")
- Requirement → Vulnerability (relationship: "exposes")

**Centrality Measures:**
- Degree Centrality: Number of connections
- Betweenness Centrality: Frequency on shortest paths
- Closeness Centrality: Average distance to all nodes
- Eigenvector Centrality: Importance based on important connections

## Component Architecture

### 1. COG Form Component (`/components/frameworks/COGForm.tsx`)

**Sections:**
1. **Basic Info**: Title, Description
2. **Operational Context**: Guided questions workflow
3. **Scoring System Selector**: Linear vs Logarithmic
4. **COG Management**:
   - Add/edit/remove COGs
   - Select actor category and DIMEFIL domain
   - Link evidence
5. **Capability Management**:
   - Hierarchically linked to COGs
   - Action-oriented (verbs)
6. **Requirement Management**:
   - Linked to capabilities
   - Resource-oriented (nouns)
7. **Vulnerability Management**:
   - Linked to requirements
   - Include Impact/Attainability/Follow-up scoring
   - Calculate composite scores
   - Show priority ranking

**Key Features:**
- Evidence linker integration for each entity
- Real-time composite score calculation
- Hierarchical cascade delete (removing COG removes all dependent entities)
- Scoring tooltips with descriptions
- Reference link to Irregularpedia

### 2. COG View Component (`/components/frameworks/COGView.tsx`)

**Display Sections:**
1. **Analysis Overview**: Title, description, operational context
2. **COG Summary Cards**: By actor category and domain
3. **Capabilities Tree View**: Expandable hierarchy
4. **Vulnerabilities Scorecard**:
   - Sorted by composite score (highest priority first)
   - Color-coded by score range
   - Show I/A/F breakdown
5. **Network Visualization**:
   - Force-directed graph
   - Node sizes based on centrality
   - Edge weights from composite scores
6. **Centrality Metrics Panel**:
   - Top nodes by degree centrality
   - Betweenness centrality rankings
   - Key vulnerability identification
7. **Export Options**:
   - Edge list CSV
   - Full report (Markdown/PDF)
   - Network diagram (PNG/SVG)

### 3. Integration Points

**Evidence System:**
```typescript
// Each COG entity can link to evidence
interface CenterOfGravity {
  linked_evidence: string[]  // Evidence IDs
  // ...
}

// When viewing, fetch and display evidence badges
<EvidenceLinker
  onLink={(selected) => updateEntity({ linked_evidence: [...existing, ...newIds] })}
/>
```

**Entity System (Actors/Places/Events):**
```typescript
// COGs can reference actors
interface CenterOfGravity {
  actor_id?: string  // Link to Actor entity
  actor_name?: string
  // ...
}
```

**Network Graph Integration:**
```typescript
import { generateEdgeList, calculateCentralityMeasures } from '@/types/cog-analysis'

// Generate network data
const edges = generateEdgeList(cogAnalysis)
const centrality = calculateCentralityMeasures(edges)

// Pass to NetworkGraphCanvas component
<NetworkGraphCanvas
  nodes={convertToNodes(cogAnalysis)}
  links={edges}
  highlightMetric="betweenness_centrality"
/>
```

## Scoring Guide Reference

**Linear Scoring (1-5):**
```
Impact on COG:
1 = Negligible impact
2 = Minor disruption
3 = Moderate degradation
4 = Major impairment
5 = Critical failure

Attainability:
1 = Very difficult (extraordinary resources)
2 = Difficult (significant resources)
3 = Moderate (standard resources)
4 = Easy (readily available)
5 = Very easy (minimal resources)

Follow-Up Potential:
1 = None
2 = Limited
3 = Moderate
4 = Significant
5 = Extensive opportunities
```

**Logarithmic Scoring (1, 3, 5, 8, 12):**
```
Impact on COG:
1 = Negligible impact
3 = Minor disruption
5 = Moderate degradation
8 = Major impairment
12 = Critical/mission failure

Attainability:
1 = Extreme difficulty
3 = Significant challenge
5 = Moderate effort
8 = Readily achievable
12 = Easily achievable

Follow-Up Potential:
1 = No follow-up potential
3 = Limited opportunities
5 = Moderate strategic advantage
8 = Significant cascading effects
12 = Transformational advantage
```

## Workflow Example

1. **Start Analysis**: Create new COG analysis
2. **Define Context**: Answer operational context questions
3. **Choose Scoring**: Select linear or logarithmic
4. **Identify COGs**:
   - Add Friendly COG (e.g., "Military - Coalition Unity")
   - Add Adversary COG (e.g., "Information - Propaganda Network")
5. **Map Capabilities**:
   - For Adversary Info COG: "Influence Public Opinion" (capability)
6. **Identify Requirements**:
   - For "Influence" capability: "Social Media Platforms" (requirement)
7. **Find Vulnerabilities**:
   - For "Platforms" requirement: "Platform Policy Enforcement" (vulnerability)
   - Score: Impact=8, Attainability=5, Follow-up=8 (Total: 21)
8. **Link Evidence**: Attach evidence to each entity
9. **View Network**: Generate and analyze network diagram
10. **Export**: Download edge list and report

## API Endpoints

```typescript
// Save COG Analysis
POST /api/frameworks
{
  framework_type: 'cog',
  title: string,
  description: string,
  data: COGAnalysis,
  status: 'active'
}

// Get COG Analysis
GET /api/frameworks?id={id}&framework_type=cog

// Link Evidence
POST /api/framework-evidence
{
  framework_type: 'cog',
  framework_id: string,
  framework_item_id: string,  // COG/Capability/Requirement/Vulnerability ID
  entity_type: 'evidence',
  entity_id: string
}

// Export Network Data
GET /api/cog-network-export?framework_id={id}
Response: { edges: NetworkEdge[], centrality: CentralityMeasures }
```

## Deployment Steps

1. ✅ Create type definitions (`/types/cog-analysis.ts`)
2. ✅ Update framework config (`/config/framework-configs.ts`)
3. ⏳ Complete COG Form component
4. ⏳ Create COG View component
5. ⏳ Update routing in `/pages/frameworks/index.tsx`
6. ⏳ Add network visualization integration
7. ⏳ Create export functionality
8. ⏳ Add i18n translations

## Testing Scenarios

1. **Basic Analysis**:
   - Create COG analysis with 1 COG, 2 capabilities, 3 requirements, 4 vulnerabilities
   - Verify hierarchical relationships
   - Test cascade delete

2. **Scoring**:
   - Test linear scoring (1-5)
   - Test logarithmic scoring (1,3,5,8,12)
   - Verify composite score calculation
   - Check priority ranking

3. **Evidence Integration**:
   - Link evidence to COG
   - Link evidence to vulnerability
   - Verify evidence display in view mode

4. **Network Analysis**:
   - Generate edge list
   - Calculate centrality measures
   - Export network data
   - Visualize in network graph

5. **Workflow**:
   - Complete full guided workflow
   - Export report
   - Edit existing analysis

## Future Enhancements

1. **AI-Assisted Analysis**:
   - GPT-5 powered COG identification suggestions
   - Automated vulnerability scoring based on evidence
   - Natural language query for network analysis

2. **Advanced Network Features**:
   - Community detection (identify clusters)
   - Path analysis (critical paths through network)
   - What-if scenarios (simulate removing nodes)

3. **Collaboration**:
   - Multi-user COG analysis
   - Comments on vulnerabilities
   - Version control and comparison

4. **Integration**:
   - Import from PMESII-PT analysis
   - Export to planning tools
   - Link to mission planning frameworks

## References

- [Irregularpedia COG Analysis Guide](https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide)
- Joint Publication 3-0: Joint Campaigns and Operations
- Joint Publication 5-0: Joint Planning
- RAND Corporation: Vulnerability Assessment Method
