# Intelligence Entity System - Comprehensive Integration Plan

**Project**: ResearchToolsPy - Intelligence Analysis Platform
**Module**: Entity Management & Deception Detection Integration
**Version**: 1.0
**Date**: October 2, 2025
**Status**: PLANNING PHASE

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [System Architecture](#system-architecture)
4. [Entity Types & Schemas](#entity-types--schemas)
5. [Deception Detection Integration](#deception-detection-integration)
6. [Actor Management System](#actor-management-system)
7. [Network Analysis & Visualization](#network-analysis--visualization)
8. [Collaboration & Sharing](#collaboration--sharing)
9. [Database Schema](#database-schema)
10. [API Design](#api-design)
11. [UI/UX Design](#uiux-design)
12. [Implementation Phases](#implementation-phases)
13. [Security & Access Control](#security--access-control)
14. [References](#references)

---

## Executive Summary

### Vision

Transform the deception detection framework into a comprehensive intelligence entity management system that tracks actors, sources, evidence, events, places, and behaviors with full deception assessment capabilities, collaborative workspaces, and analyst notebook-style network visualization.

### Key Objectives

1. **Entity Integration**: Link deception detection (MOM-POP-MOSES-EVE) to specific entity types
2. **Actor Management**: Track people, organizations, units, governments with deception patterns
3. **Network Analysis**: Visualize relationships like Analyst Notebook/Palantir
4. **Collaboration**: Team workspaces, sharing, public library with voting
5. **Cross-linking**: Connect actors, evidence, sources, events, places, behaviors
6. **Framework Integration**: Link to Causeway, COG, and other frameworks

### Scope

**Phase 1** (Foundation): Database schema, core entity types, basic CRUD
**Phase 2** (Integration): Deception detection per entity, framework linking
**Phase 3** (Networks): Network visualization, relationship mapping
**Phase 4** (Collaboration): User workspaces, sharing, library system
**Phase 5** (Advanced): Public library, voting, clone/fork, advanced analytics

**Estimated Total**: 60-80 hours across 5 phases

---

## Current State Analysis

### Existing Systems

#### 1. Deception Detection Framework ✅
- MOM-POP-MOSES-EVE methodology implemented
- Scoring, AI analysis, reports, predictions
- **Gap**: Not linked to specific entities

#### 2. Evidence System ✅
- Evidence collection with 10 types
- Credibility ratings
- **Gap**: No EVE (Evaluation of Evidence) integration

#### 3. Frameworks ✅
- 16 frameworks including Causeway, COG
- **Gap**: No actor-framework linkage

#### 4. Citation Library ✅
- Citation management with zbib-style interface
- **Gap**: No source credibility tracking

### Missing Components

❌ **Actor Management System**
❌ **Datasets/Sources with MOSES integration**
❌ **Network Visualization**
❌ **Entity Relationship Mapping**
❌ **User Workspaces**
❌ **Collaboration Features**
❌ **Public Library System**
❌ **Events, Places, Behaviors entities**

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
├─────────────────────────────────────────────────────────────┤
│  Actor Profile  │  Network Graph  │  Evidence Library       │
│  Source Manager │  Deception Dashboard  │  Workspace View  │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Entity Manager  │  Relationship Engine  │  Deception AI   │
│  Collaboration   │  Access Control  │  Analytics Engine    │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
├─────────────────────────────────────────────────────────────┤
│  /api/actors     │  /api/sources    │  /api/evidence       │
│  /api/networks   │  /api/workspaces │  /api/library        │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (D1/KV)                        │
├─────────────────────────────────────────────────────────────┤
│  Entities  │  Relationships  │  Deception Assessments       │
│  Users     │  Workspaces     │  Library Items               │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Entity-Centric**: Everything revolves around core entity types
2. **Relationship-Rich**: Entities are connected via typed relationships
3. **Deception-Aware**: Track deception patterns for each entity type
4. **Collaborative**: Multi-user workspaces with sharing
5. **Open Library**: Community-contributed knowledge base
6. **Framework-Integrated**: Link to existing analytic frameworks

---

## Entity Types & Schemas

### Core Entity Types

#### 1. Actors

**Definition**: People, organizations, units, governments, groups

**Attributes**:
```typescript
interface Actor {
  id: string
  type: 'PERSON' | 'ORGANIZATION' | 'UNIT' | 'GOVERNMENT' | 'GROUP' | 'OTHER'

  // Basic Information
  name: string
  aliases: string[]
  description: string

  // Classification
  category: string  // e.g., "Military", "Political", "Intelligence"
  role: string      // e.g., "Commander", "Minister", "Operative"
  affiliation: string  // e.g., "Russian Federation", "Wagner Group"

  // Deception Assessment (MOM-POP)
  deception_profile: {
    mom: {
      motive: number        // 0-5
      opportunity: number   // 0-5
      means: number         // 0-5
      notes: string
    }
    pop: {
      historical_pattern: number      // 0-5
      sophistication_level: number    // 0-5
      success_rate: number            // 0-5
      notes: string
    }
    overall_assessment: DeceptionAssessment
    last_updated: string
  }

  // Network Position
  relationships: Relationship[]

  // Links to Frameworks
  causeway_analysis_id?: string  // Link to Causeway framework analysis
  cog_analysis_id?: string       // Link to COG framework analysis

  // Metadata
  created_by: string
  created_at: string
  updated_at: string
  workspace_id: string
  is_public: boolean
  votes: number
}
```

#### 2. Sources/Datasets

**Definition**: Information sources with MOSES assessment

**Attributes**:
```typescript
interface Source {
  id: string
  type: 'HUMINT' | 'SIGINT' | 'IMINT' | 'OSINT' | 'GEOINT' | 'MASINT' | 'TECHINT' | 'CYBER'

  // Basic Information
  name: string
  description: string
  source_type: string  // e.g., "Agent", "Intercept", "Satellite"

  // MOSES Assessment
  moses_assessment: {
    source_vulnerability: number      // 0-5
    manipulation_evidence: number     // 0-5
    access_level: 'EXCLUSIVE' | 'LIMITED' | 'SHARED' | 'OPEN'
    reliability: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
    notes: string
  }

  // Relationships
  controlled_by?: string  // Actor ID
  provides_evidence: string[]  // Evidence IDs

  // Metadata
  created_by: string
  created_at: string
  updated_at: string
  workspace_id: string
  is_public: boolean
  votes: number
}
```

#### 3. Evidence (Enhanced)

**Definition**: Individual pieces of intelligence with EVE assessment

**Attributes**:
```typescript
interface Evidence {
  id: string
  // ... existing evidence fields ...

  // EVE Assessment (NEW)
  eve_assessment: {
    internal_consistency: number       // 0-5 (INVERTED)
    external_corroboration: number     // 0-5 (INVERTED)
    anomaly_detection: number          // 0-5
    notes: string
    assessed_at: string
  }

  // Source Linkage
  source_id?: string  // Link to Source entity

  // Actor Linkage
  related_actors: string[]  // Actor IDs mentioned/involved

  // Event Linkage
  event_id?: string

  // Existing fields...
  created_by: string
  workspace_id: string
  is_public: boolean
  votes: number
}
```

#### 4. Events

**Definition**: Incidents, operations, activities in time

**Attributes**:
```typescript
interface Event {
  id: string

  // Basic Information
  name: string
  description: string
  event_type: 'OPERATION' | 'INCIDENT' | 'MEETING' | 'ACTIVITY' | 'OTHER'

  // Temporal
  date_start: string
  date_end?: string
  duration?: number

  // Spatial
  location_id?: string  // Link to Place entity
  coordinates?: { lat: number; lng: number }

  // Relationships
  actors_involved: string[]  // Actor IDs
  evidence_supporting: string[]  // Evidence IDs

  // Analysis
  significance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  confidence: 'CONFIRMED' | 'PROBABLE' | 'POSSIBLE' | 'DOUBTFUL'

  // Framework Links
  timeline_id?: string  // Link to timeline analysis

  // Metadata
  created_by: string
  created_at: string
  updated_at: string
  workspace_id: string
  is_public: boolean
  votes: number
}
```

#### 5. Places

**Definition**: Locations, facilities, geographic areas

**Attributes**:
```typescript
interface Place {
  id: string

  // Basic Information
  name: string
  description: string
  place_type: 'FACILITY' | 'CITY' | 'REGION' | 'COUNTRY' | 'INSTALLATION' | 'OTHER'

  // Geographic
  coordinates: { lat: number; lng: number }
  address?: string
  country: string
  region?: string

  // Relationships
  controlled_by?: string  // Actor ID
  events_at_location: string[]  // Event IDs

  // Intelligence Value
  strategic_importance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

  // Metadata
  created_by: string
  created_at: string
  updated_at: string
  workspace_id: string
  is_public: boolean
  votes: number
}
```

#### 6. Behaviors

**Definition**: Patterns of activity, tactics, techniques

**Attributes**:
```typescript
interface Behavior {
  id: string

  // Basic Information
  name: string
  description: string
  behavior_type: 'TTP' | 'PATTERN' | 'TACTIC' | 'TECHNIQUE' | 'PROCEDURE'

  // Pattern Details
  indicators: string[]  // Observable indicators
  frequency: 'CONTINUOUS' | 'FREQUENT' | 'OCCASIONAL' | 'RARE'
  first_observed: string
  last_observed: string

  // Relationships
  exhibited_by: string[]  // Actor IDs
  observed_in: string[]   // Event IDs

  // Analysis
  sophistication: 'ADVANCED' | 'INTERMEDIATE' | 'BASIC'
  effectiveness: 'HIGHLY_EFFECTIVE' | 'EFFECTIVE' | 'MODERATELY_EFFECTIVE' | 'INEFFECTIVE'

  // Link to Behavior Framework
  behavior_analysis_id?: string

  // Metadata
  created_by: string
  created_at: string
  updated_at: string
  workspace_id: string
  is_public: boolean
  votes: number
}
```

---

## Deception Detection Integration

### Integration Points

#### 1. Actors → MOM-POP

**Rationale**: Actors have motive, opportunity, means and historical patterns

**Implementation**:
```typescript
// Actor Profile includes deception assessment
actor.deception_profile = {
  mom: {
    motive: 4,  // High motive to deceive
    opportunity: 5,  // Complete information control
    means: 5,  // Sophisticated capabilities
    notes: "Russian military doctrine emphasizes maskirovka..."
  },
  pop: {
    historical_pattern: 5,  // Documented deception history
    sophistication_level: 5,  // World-class capabilities
    success_rate: 4,  // High success in past operations
    notes: "Operation Fortitude, Soviet deceptions in WWII..."
  },
  overall_assessment: calculateActorDeceptionLikelihood(mom, pop)
}
```

**UI Location**: Actor Profile → "Deception Assessment" tab

#### 2. Sources → MOSES

**Rationale**: Sources have vulnerability to manipulation

**Implementation**:
```typescript
// Source includes MOSES assessment
source.moses_assessment = {
  source_vulnerability: 4,  // High vulnerability
  manipulation_evidence: 3,  // Some indicators
  access_level: 'LIMITED',  // Adversary may have access
  reliability: 'C',  // Fair reliability
  notes: "Source has contact with adversary-controlled individuals..."
}
```

**UI Location**: Source/Dataset Profile → "Reliability Assessment" tab

#### 3. Evidence → EVE

**Rationale**: Evidence quality assessed via internal consistency, corroboration, anomalies

**Implementation**:
```typescript
// Evidence includes EVE assessment
evidence.eve_assessment = {
  internal_consistency: 2,  // Low (INVERTED - indicates issues)
  external_corroboration: 1,  // Very low (INVERTED - no corroboration)
  anomaly_detection: 4,  // High anomalies detected
  notes: "Information contradicts known facts, no independent confirmation..."
}
```

**UI Location**: Evidence Detail → "Quality Assessment" panel

#### 4. Full Deception Analysis

**Combining All Factors**:
```typescript
function analyzeDeception(scenario: {
  actors: Actor[]
  sources: Source[]
  evidence: Evidence[]
}) {
  // Aggregate MOM from actors
  const mom_scores = actors.map(a => a.deception_profile.mom)
  const avg_mom = calculateAverage(mom_scores)

  // Aggregate POP from actors
  const pop_scores = actors.map(a => a.deception_profile.pop)
  const avg_pop = calculateAverage(pop_scores)

  // Aggregate MOSES from sources
  const moses_scores = sources.map(s => s.moses_assessment)
  const avg_moses = calculateAverage(moses_scores)

  // Aggregate EVE from evidence
  const eve_scores = evidence.map(e => e.eve_assessment)
  const avg_eve = calculateAverage(eve_scores)

  // Calculate overall deception likelihood
  return calculateDeceptionLikelihood({
    ...avg_mom,
    ...avg_pop,
    ...avg_moses,
    ...avg_eve
  })
}
```

---

## Actor Management System

### Actor Profile Components

#### 1. Basic Information Tab
- Name, aliases, description
- Type (Person/Org/Unit/Government)
- Category, role, affiliation
- Photo/logo upload
- Classification level

#### 2. Deception Assessment Tab

**MOM Analysis**:
- Motive slider (0-5) with tooltip
- Opportunity slider (0-5) with tooltip
- Means slider (0-5) with tooltip
- Notes field for detailed analysis

**POP Analysis**:
- Historical Pattern slider (0-5)
- Sophistication Level slider (0-5)
- Success Rate slider (0-5)
- Notes field with historical examples

**Assessment Display**:
- Overall deception likelihood gauge (0-100%)
- Risk level badge
- Confidence level
- Historical trend chart (if multiple assessments)

#### 3. Network Tab
- Visual network graph showing relationships
- Actor connections (allies, adversaries, subordinates, superiors)
- Relationship types and strengths
- Timeline of relationship changes

#### 4. Activity Timeline Tab
- Chronological list of events involving this actor
- Evidence associated with this actor
- Behavior patterns exhibited
- Framework analyses referencing this actor

#### 5. Framework Analysis Tab
- Links to Causeway analyses
- Links to COG analyses
- Links to other relevant frameworks
- Quick actions to create new framework analysis

#### 6. Intelligence Collection Tab
- Sources reporting on this actor
- Evidence collection priorities
- Information gaps
- Collection recommendations

### Actor List & Search

**Features**:
- Search by name, alias, affiliation
- Filter by type, category, deception risk level
- Sort by last updated, deception likelihood, votes
- Grid/list view toggle
- Deception risk badges in list view

**List Card Display**:
```
┌─────────────────────────────────────────────┐
│ [Photo] Actor Name              [85% Risk] │
│         Organization/Unit        [HIGH]     │
│         Last Updated: Oct 2, 2025           │
│                                             │
│  MOM: ████████░░ 8.5/15                    │
│  POP: ███████░░░ 7.0/15                    │
│                                             │
│  [View] [Edit] [Network] [...]             │
└─────────────────────────────────────────────┘
```

---

## Network Analysis & Visualization

### Network Graph Implementation

**Inspiration**: Analyst Notebook, Palantir, Linkurious

**Technology Stack**:
- **Library**: D3.js, Cytoscape.js, or Vis.js
- **Layout**: Force-directed, hierarchical, or custom
- **Rendering**: Canvas or SVG based on data size

### Node Types

```typescript
interface NetworkNode {
  id: string
  type: 'ACTOR' | 'SOURCE' | 'EVIDENCE' | 'EVENT' | 'PLACE' | 'BEHAVIOR'
  label: string

  // Visual properties
  size: number  // Based on importance/connections
  color: string  // Based on deception risk or type
  icon: string  // Icon representing entity type

  // Deception coloring
  deception_risk?: number  // 0-100 for actors/sources

  // Metadata
  data: Actor | Source | Evidence | Event | Place | Behavior
}
```

### Edge Types

```typescript
interface NetworkEdge {
  id: string
  source: string  // Node ID
  target: string  // Node ID
  type: RelationshipType

  // Visual properties
  weight: number  // Relationship strength
  color: string
  style: 'solid' | 'dashed' | 'dotted'
  label?: string

  // Temporal
  start_date?: string
  end_date?: string

  // Metadata
  confidence: 'CONFIRMED' | 'PROBABLE' | 'POSSIBLE' | 'SUSPECTED'
  evidence_supporting: string[]  // Evidence IDs
}

type RelationshipType =
  | 'CONTROLS'
  | 'REPORTS_TO'
  | 'ALLIED_WITH'
  | 'ADVERSARY_OF'
  | 'MEMBER_OF'
  | 'LOCATED_AT'
  | 'PARTICIPATED_IN'
  | 'PROVIDED_BY'
  | 'EXHIBITS'
  | 'CORROBORATES'
  | 'CONTRADICTS'
  | 'CUSTOM'
```

### Network Visualization Features

#### 1. Interactive Graph
- **Pan/Zoom**: Navigate large networks
- **Drag nodes**: Manually position entities
- **Click nodes**: Open entity detail panel
- **Click edges**: Show relationship details
- **Multi-select**: Select multiple nodes for bulk operations

#### 2. Layout Algorithms
- **Force-directed**: Physics-based natural clustering
- **Hierarchical**: Top-down org chart style
- **Circular**: Circular layout highlighting central nodes
- **Geographic**: Map-based if entities have locations
- **Custom**: User-defined positioning

#### 3. Filtering & Highlighting
- **Filter by type**: Show only actors, only events, etc.
- **Filter by risk**: Show high deception risk entities
- **Path highlighting**: Highlight connection paths between entities
- **Time filtering**: Show network state at specific time
- **Search highlighting**: Highlight search results in graph

#### 4. Analysis Tools
- **Shortest path**: Find connections between entities
- **Centrality analysis**: Identify key nodes (betweenness, degree, closeness)
- **Community detection**: Identify clusters/groups
- **Link analysis**: Predict missing links
- **Timeline playback**: Animate network evolution over time

#### 5. Export & Sharing
- **Export image**: PNG, SVG
- **Export data**: JSON, GraphML, CSV
- **Share view**: Save current view state
- **Embed**: Embeddable network widget

### Network Use Cases

**Intelligence Analysis**:
1. **Identify key actors**: Central nodes with high betweenness
2. **Find connections**: Shortest path between suspects
3. **Deception networks**: Visualize actors with high deception risk
4. **Source networks**: Map source relationships and vulnerabilities
5. **Event reconstruction**: Link actors, places, events temporally

**Example Query**: "Show me all actors with >70% deception likelihood who are connected to Source-X within 2 degrees"

---

## Collaboration & Sharing

### User Workspace System

#### Workspace Types

**1. Personal Workspace**
- Private to individual user
- Full CRUD on all entities
- Not visible to others
- Can promote items to team/public

**2. Team Workspace**
- Shared among team members
- Role-based permissions (Admin, Editor, Viewer)
- Real-time collaboration
- Activity feed showing team changes

**3. Public Library**
- Community-contributed knowledge
- Voting system for quality
- Moderation by admins
- Clone/fork functionality

### Workspace Schema

```typescript
interface Workspace {
  id: string
  name: string
  description: string
  type: 'PERSONAL' | 'TEAM' | 'PUBLIC'

  // Ownership
  owner_id: string
  created_at: string

  // Team workspaces
  members?: WorkspaceMember[]

  // Settings
  is_public: boolean
  allow_cloning: boolean

  // Statistics
  entity_count: {
    actors: number
    sources: number
    evidence: number
    events: number
    places: number
    behaviors: number
  }

  // Library features (for public workspaces)
  votes?: number
  stars?: number
  forks?: number
  views?: number
}

interface WorkspaceMember {
  user_id: string
  role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  joined_at: string
  permissions: string[]  // Fine-grained permissions
}
```

### Collaboration Features

#### 1. Real-time Editing
- **Presence indicators**: Show who's viewing/editing
- **Conflict resolution**: Handle simultaneous edits
- **Change notifications**: Alert team of updates
- **Activity feed**: Stream of recent changes

#### 2. Comments & Annotations
- **Entity comments**: Discuss specific actors, evidence, etc.
- **Network annotations**: Comment on relationships
- **Threaded discussions**: Reply to comments
- **@mentions**: Tag team members

#### 3. Version History
- **Entity versioning**: Track changes over time
- **Diff view**: Compare versions
- **Restore previous**: Roll back changes
- **Audit log**: Who changed what when

#### 4. Sharing & Permissions

**Share Actions**:
- **Share workspace**: Invite users to team workspace
- **Share entity**: Share specific actor/evidence with link
- **Share network**: Share network view with filters
- **Share analysis**: Share deception analysis results

**Permission Levels**:
```typescript
type Permission =
  | 'workspace.view'
  | 'workspace.edit'
  | 'workspace.admin'
  | 'entity.create'
  | 'entity.read'
  | 'entity.update'
  | 'entity.delete'
  | 'network.view'
  | 'network.edit'
  | 'analysis.run'
  | 'export.data'
```

### Public Library System

#### Library Features

**1. Contribution**
- **Publish to library**: Promote personal/team entities to public
- **Quality guidelines**: Standards for public contributions
- **Moderation**: Admin review before publication
- **Attribution**: Credit to original creator

**2. Discovery**
- **Search library**: Full-text search across entities
- **Browse categories**: Actors by type, sources by reliability, etc.
- **Trending**: Most viewed/voted this week
- **Curated collections**: Admin-curated sets

**3. Quality Control
**
- **Voting system**: Upvote/downvote useful contributions
- **Star rating**: 1-5 star quality rating
- **Reviews**: Written reviews of entities
- **Flagging**: Report low-quality or incorrect data

**4. Clone & Fork**
- **Clone entity**: Copy to personal workspace
- **Fork workspace**: Copy entire workspace
- **Track provenance**: Show relationship to original
- **Upstream updates**: Option to sync with original

**5. Library Entity Schema**
```typescript
interface LibraryItem {
  id: string
  entity_id: string
  entity_type: 'ACTOR' | 'SOURCE' | 'EVIDENCE' | 'EVENT' | 'PLACE' | 'BEHAVIOR'

  // Publishing
  published_by: string
  published_at: string
  workspace_id: string  // Original workspace

  // Quality metrics
  votes: number
  stars: number  // Average star rating
  views: number
  clones: number

  // Moderation
  status: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED'
  reviewed_by?: string
  reviewed_at?: string

  // Discovery
  tags: string[]
  categories: string[]

  // Attribution
  original_creator: string
  contributors: string[]
  license?: string
}
```

---

## Database Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,

  -- Profile
  full_name TEXT,
  organization TEXT,
  role TEXT,

  -- Settings
  preferences JSON,

  -- Metadata
  created_at TEXT NOT NULL,
  last_login TEXT,
  is_active INTEGER DEFAULT 1,
  is_admin INTEGER DEFAULT 0
);
```

#### workspaces
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK(type IN ('PERSONAL', 'TEAM', 'PUBLIC')) NOT NULL,

  -- Ownership
  owner_id TEXT NOT NULL,

  -- Settings
  is_public INTEGER DEFAULT 0,
  allow_cloning INTEGER DEFAULT 1,

  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (owner_id) REFERENCES users(id)
);
```

#### workspace_members
```sql
CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('ADMIN', 'EDITOR', 'VIEWER')) NOT NULL,
  permissions JSON,

  joined_at TEXT NOT NULL,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, user_id)
);
```

#### actors
```sql
CREATE TABLE actors (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('PERSON', 'ORGANIZATION', 'UNIT', 'GOVERNMENT', 'GROUP', 'OTHER')) NOT NULL,

  -- Basic Info
  name TEXT NOT NULL,
  aliases JSON,  -- Array of strings
  description TEXT,

  -- Classification
  category TEXT,
  role TEXT,
  affiliation TEXT,

  -- Deception Profile (JSON)
  deception_profile JSON,

  -- Framework Links
  causeway_analysis_id TEXT,
  cog_analysis_id TEXT,

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (causeway_analysis_id) REFERENCES frameworks(id),
  FOREIGN KEY (cog_analysis_id) REFERENCES frameworks(id)
);
```

#### sources
```sql
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('HUMINT', 'SIGINT', 'IMINT', 'OSINT', 'GEOINT', 'MASINT', 'TECHINT', 'CYBER')) NOT NULL,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT,

  -- MOSES Assessment (JSON)
  moses_assessment JSON,

  -- Relationships
  controlled_by TEXT,  -- Actor ID

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (controlled_by) REFERENCES actors(id) ON DELETE SET NULL
);
```

#### evidence (enhanced)
```sql
-- Add columns to existing evidence table
ALTER TABLE evidence ADD COLUMN eve_assessment JSON;
ALTER TABLE evidence ADD COLUMN source_id TEXT REFERENCES sources(id);
ALTER TABLE evidence ADD COLUMN event_id TEXT REFERENCES events(id);
ALTER TABLE evidence ADD COLUMN workspace_id TEXT NOT NULL;
ALTER TABLE evidence ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE evidence ADD COLUMN votes INTEGER DEFAULT 0;
```

#### events
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT CHECK(event_type IN ('OPERATION', 'INCIDENT', 'MEETING', 'ACTIVITY', 'OTHER')) NOT NULL,

  -- Temporal
  date_start TEXT NOT NULL,
  date_end TEXT,
  duration INTEGER,

  -- Spatial
  location_id TEXT,
  coordinates JSON,  -- {lat, lng}

  -- Analysis
  significance TEXT CHECK(significance IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  confidence TEXT CHECK(confidence IN ('CONFIRMED', 'PROBABLE', 'POSSIBLE', 'DOUBTFUL')),

  -- Framework Links
  timeline_id TEXT,

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (location_id) REFERENCES places(id) ON DELETE SET NULL
);
```

#### places
```sql
CREATE TABLE places (
  id TEXT PRIMARY KEY,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  place_type TEXT CHECK(place_type IN ('FACILITY', 'CITY', 'REGION', 'COUNTRY', 'INSTALLATION', 'OTHER')) NOT NULL,

  -- Geographic
  coordinates JSON NOT NULL,  -- {lat, lng}
  address TEXT,
  country TEXT,
  region TEXT,

  -- Analysis
  strategic_importance TEXT CHECK(strategic_importance IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),

  -- Relationships
  controlled_by TEXT,  -- Actor ID

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (controlled_by) REFERENCES actors(id) ON DELETE SET NULL
);
```

#### behaviors
```sql
CREATE TABLE behaviors (
  id TEXT PRIMARY KEY,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  behavior_type TEXT CHECK(behavior_type IN ('TTP', 'PATTERN', 'TACTIC', 'TECHNIQUE', 'PROCEDURE')) NOT NULL,

  -- Pattern Details
  indicators JSON,  -- Array of strings
  frequency TEXT CHECK(frequency IN ('CONTINUOUS', 'FREQUENT', 'OCCASIONAL', 'RARE')),
  first_observed TEXT,
  last_observed TEXT,

  -- Analysis
  sophistication TEXT CHECK(sophistication IN ('ADVANCED', 'INTERMEDIATE', 'BASIC')),
  effectiveness TEXT CHECK(effectiveness IN ('HIGHLY_EFFECTIVE', 'EFFECTIVE', 'MODERATELY_EFFECTIVE', 'INEFFECTIVE')),

  -- Framework Links
  behavior_analysis_id TEXT,

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (behavior_analysis_id) REFERENCES frameworks(id)
);
```

#### relationships
```sql
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,

  -- Entities
  source_entity_id TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,

  -- Relationship
  relationship_type TEXT NOT NULL,
  description TEXT,
  weight REAL DEFAULT 1.0,  -- Relationship strength

  -- Temporal
  start_date TEXT,
  end_date TEXT,

  -- Confidence
  confidence TEXT CHECK(confidence IN ('CONFIRMED', 'PROBABLE', 'POSSIBLE', 'SUSPECTED')),

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_relationships_source ON relationships(source_entity_id, source_entity_type);
CREATE INDEX idx_relationships_target ON relationships(target_entity_id, target_entity_type);
```

#### library_items
```sql
CREATE TABLE library_items (
  id TEXT PRIMARY KEY,

  entity_id TEXT NOT NULL,
  entity_type TEXT CHECK(entity_type IN ('ACTOR', 'SOURCE', 'EVIDENCE', 'EVENT', 'PLACE', 'BEHAVIOR')) NOT NULL,

  -- Publishing
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL,

  -- Quality
  votes INTEGER DEFAULT 0,
  stars REAL DEFAULT 0.0,
  views INTEGER DEFAULT 0,
  clones INTEGER DEFAULT 0,

  -- Moderation
  status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED')) DEFAULT 'PENDING',
  reviewed_by TEXT,
  reviewed_at TEXT,

  -- Discovery
  tags JSON,
  categories JSON,

  -- Attribution
  original_creator TEXT NOT NULL,
  contributors JSON,
  license TEXT,

  FOREIGN KEY (published_by) REFERENCES users(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (original_creator) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX idx_library_entity ON library_items(entity_id, entity_type);
CREATE INDEX idx_library_status ON library_items(status);
```

#### entity_links
```sql
-- Many-to-many relationship tables

CREATE TABLE actor_events (
  actor_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  role TEXT,  -- e.g., "Participant", "Organizer", "Target"
  PRIMARY KEY (actor_id, event_id),
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE evidence_actors (
  evidence_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  relevance TEXT,  -- e.g., "Mentioned", "Involved", "Author"
  PRIMARY KEY (evidence_id, actor_id),
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
);

CREATE TABLE source_evidence (
  source_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  PRIMARY KEY (source_id, evidence_id),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

CREATE TABLE actor_behaviors (
  actor_id TEXT NOT NULL,
  behavior_id TEXT NOT NULL,
  frequency TEXT,
  last_exhibited TEXT,
  PRIMARY KEY (actor_id, behavior_id),
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
  FOREIGN KEY (behavior_id) REFERENCES behaviors(id) ON DELETE CASCADE
);

CREATE TABLE event_evidence (
  event_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  relevance TEXT,
  PRIMARY KEY (event_id, evidence_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);
```

---

## API Design

### Authentication Endpoints

```typescript
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/refresh
```

### Workspace Endpoints

```typescript
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:id
PUT    /api/workspaces/:id
DELETE /api/workspaces/:id

GET    /api/workspaces/:id/members
POST   /api/workspaces/:id/members
DELETE /api/workspaces/:id/members/:userId

GET    /api/workspaces/:id/activity
```

### Entity Endpoints (Pattern applies to all entity types)

```typescript
// Actors
GET    /api/actors?workspace_id=...
POST   /api/actors
GET    /api/actors/:id
PUT    /api/actors/:id
DELETE /api/actors/:id

// Deception assessment
GET    /api/actors/:id/deception
PUT    /api/actors/:id/deception
POST   /api/actors/:id/deception/analyze  // AI analysis

// Relationships
GET    /api/actors/:id/relationships
POST   /api/actors/:id/relationships
DELETE /api/actors/:id/relationships/:relationshipId

// Network
GET    /api/actors/:id/network?depth=2

// Same pattern for:
// /api/sources
// /api/evidence (enhanced)
// /api/events
// /api/places
// /api/behaviors
```

### Network Endpoints

```typescript
GET    /api/network
  ?workspace_id=...
  &entity_types=actor,source
  &deception_risk_min=70
  &depth=3

POST   /api/network/analyze
  body: {
    algorithm: 'shortest_path' | 'centrality' | 'community'
    params: {...}
  }

GET    /api/network/path
  ?from=actor123
  &to=event456
  &max_hops=5
```

### Library Endpoints

```typescript
GET    /api/library
  ?entity_type=actor
  &category=military
  &sort=votes
  &page=1

POST   /api/library/publish
  body: {
    entity_id: '...'
    entity_type: 'actor'
    tags: [...]
    categories: [...]
  }

POST   /api/library/:id/vote
  body: { vote: 1 | -1 }

POST   /api/library/:id/star
  body: { stars: 1-5 }

POST   /api/library/:id/clone
  body: { workspace_id: '...' }
```

### Search Endpoint

```typescript
GET    /api/search
  ?q=query
  &type=actor,source
  &workspace_id=...
  &deception_min=70
  &limit=50
```

---

## UI/UX Design

### Navigation Structure

```
Dashboard
├── My Workspace
│   ├── Actors
│   ├── Sources/Datasets
│   ├── Evidence
│   ├── Events
│   ├── Places
│   └── Behaviors
├── Network View
│   └── Interactive Graph
├── Team Workspaces
│   ├── [Team 1]
│   └── [Team 2]
├── Library
│   ├── Browse
│   ├── Search
│   └── My Contributions
├── Analysis Frameworks
│   ├── Deception Detection
│   ├── Causeway
│   ├── COG
│   └── [Others...]
└── Settings
    ├── Profile
    ├── Workspaces
    └── Preferences
```

### Key UI Components

#### 1. Entity Card Component
```tsx
<EntityCard
  type="actor"
  data={actor}
  showDeceptionRisk={true}
  showRelationships={true}
  actions={['view', 'edit', 'delete', 'network']}
/>
```

#### 2. Deception Assessment Panel
```tsx
<DeceptionAssessmentPanel
  entityType="actor"
  entityId={actorId}
  scores={deceptionProfile}
  onUpdate={handleUpdate}
  showAIAnalysis={true}
/>
```

#### 3. Network Viewer Component
```tsx
<NetworkViewer
  workspaceId={workspaceId}
  filters={{
    entityTypes: ['actor', 'source'],
    deceptionRiskMin: 70
  }}
  layout="force-directed"
  onNodeClick={handleNodeClick}
/>
```

#### 4. Relationship Editor
```tsx
<RelationshipEditor
  sourceEntity={actor}
  targetEntity={event}
  relationshipType="PARTICIPATED_IN"
  confidence="PROBABLE"
  evidence={[evidence1, evidence2]}
  onSave={handleSave}
/>
```

#### 5. Workspace Switcher
```tsx
<WorkspaceSwitcher
  currentWorkspace={workspace}
  availableWorkspaces={workspaces}
  onSwitch={handleSwitch}
/>
```

### Page Layouts

#### Actor Profile Page
```
┌─────────────────────────────────────────────────────┐
│ [Photo] Actor Name                    [Edit] [⋮]   │
│         Organization | Type: Person                 │
│         [85% Deception Risk] [HIGH]                 │
├─────────────────────────────────────────────────────┤
│ [Info] [Deception] [Network] [Timeline] [Analysis] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  MOM Analysis                                       │
│  ├─ Motive:      ████████░░ 4/5                    │
│  ├─ Opportunity: █████████░ 5/5                    │
│  └─ Means:       █████████░ 5/5                    │
│                                                     │
│  POP Analysis                                       │
│  ├─ Pattern:     █████████░ 5/5                    │
│  ├─ Sophistication: █████████░ 5/5                 │
│  └─ Success:     ████████░░ 4/5                    │
│                                                     │
│  [Run AI Analysis] [View Full Assessment]          │
│                                                     │
│  Related Entities:                                  │
│  ├─ 15 Events                                       │
│  ├─ 8 Sources                                       │
│  ├─ 42 Evidence items                               │
│  └─ 23 Relationships                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Network View Page
```
┌─────────────────────────────────────────────────────┐
│ Network View                    [Filter] [Layout]   │
├─────────────────────────────────────────────────────┤
│                                          │          │
│                                          │  Legend  │
│                                          │  ● Actor │
│                                          │  ■ Source│
│          [Network Graph]                 │  ▲ Event │
│                                          │  ★ Place │
│                                          │          │
│                                          │  Risk:   │
│                                          │  🔴 High │
│                                          │  🟡 Med  │
│                                          │  🟢 Low  │
│                                          │          │
├──────────────────────────────────────────┴──────────┤
│ Selected: Actor-123                                 │
│ [View Profile] [Expand Network] [Hide]              │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (15-20 hours)

**Objective**: Database schema, basic entity CRUD, user auth

**Tasks**:
1. Database Schema
   - [ ] Create all core tables (users, workspaces, actors, sources, etc.)
   - [ ] Add migration scripts
   - [ ] Create indexes for performance

2. Authentication System
   - [ ] User registration/login
   - [ ] JWT token management
   - [ ] Session handling
   - [ ] Password reset flow

3. Workspace Management
   - [ ] Personal workspace creation (auto on user signup)
   - [ ] Workspace CRUD operations
   - [ ] Workspace switching UI

4. Basic Entity CRUD
   - [ ] Actors: Create, Read, Update, Delete
   - [ ] Sources: Create, Read, Update, Delete
   - [ ] Events, Places, Behaviors: Basic CRUD

**Deliverables**:
- ✅ Database schema deployed
- ✅ Auth system functional
- ✅ Basic entity management working
- ✅ Workspace creation/switching

---

### Phase 2: Deception Integration (12-15 hours)

**Objective**: Link MOM-POP-MOSES-EVE to entities

**Tasks**:
1. Actor Deception Assessment
   - [ ] Deception profile UI (MOM-POP sliders)
   - [ ] Real-time likelihood calculation
   - [ ] Save/load deception assessments
   - [ ] AI-powered actor analysis

2. Source MOSES Assessment
   - [ ] MOSES assessment UI for sources
   - [ ] Source vulnerability scoring
   - [ ] Reliability ratings
   - [ ] Link sources to evidence

3. Evidence EVE Assessment
   - [ ] EVE assessment panel in evidence detail
   - [ ] Consistency/corroboration/anomaly scoring
   - [ ] Evidence quality dashboard
   - [ ] Link evidence to sources

4. Combined Analysis
   - [ ] Aggregate deception analysis from multiple entities
   - [ ] Scenario builder (select actors, sources, evidence)
   - [ ] Generate comprehensive deception report

**Deliverables**:
- ✅ Actor profiles with MOM-POP assessment
- ✅ Source profiles with MOSES assessment
- ✅ Evidence with EVE assessment
- ✅ Combined deception analysis workflow

---

### Phase 3: Network Analysis (15-20 hours)

**Objective**: Network visualization and relationship mapping

**Tasks**:
1. Relationship System
   - [ ] Create relationship CRUD
   - [ ] Relationship types definition
   - [ ] Relationship editor UI
   - [ ] Bulk relationship import

2. Network Visualization
   - [ ] Choose and integrate graph library (D3/Cytoscape/Vis)
   - [ ] Implement force-directed layout
   - [ ] Node rendering (colored by deception risk)
   - [ ] Edge rendering (typed relationships)
   - [ ] Pan/zoom/drag interactions

3. Network Analysis Tools
   - [ ] Shortest path algorithm
   - [ ] Centrality calculation (betweenness, degree, closeness)
   - [ ] Community detection
   - [ ] Filter controls (entity type, deception risk, time)
   - [ ] Search and highlight

4. Network Export
   - [ ] Export as PNG/SVG
   - [ ] Export as GraphML/JSON
   - [ ] Share network view (save filter state)

**Deliverables**:
- ✅ Interactive network graph
- ✅ Relationship management
- ✅ Network analysis algorithms
- ✅ Export functionality

---

### Phase 4: Collaboration (10-15 hours)

**Objective**: Team workspaces, sharing, real-time collaboration

**Tasks**:
1. Team Workspaces
   - [ ] Create team workspace
   - [ ] Invite members (email invitations)
   - [ ] Role management (Admin/Editor/Viewer)
   - [ ] Permission system

2. Real-time Features
   - [ ] Presence indicators (who's online)
   - [ ] Activity feed (recent changes)
   - [ ] Real-time updates (WebSocket or polling)
   - [ ] Conflict resolution

3. Comments & Annotations
   - [ ] Entity comments
   - [ ] Threaded discussions
   - [ ] @mentions
   - [ ] Notification system

4. Version History
   - [ ] Entity versioning
   - [ ] Diff view
   - [ ] Restore previous version
   - [ ] Audit log

**Deliverables**:
- ✅ Team workspace creation and management
- ✅ Role-based permissions
- ✅ Activity feed
- ✅ Comments and annotations

---

### Phase 5: Public Library (8-12 hours)

**Objective**: Community contributions, voting, clone/fork

**Tasks**:
1. Library Publishing
   - [ ] Publish entity to library
   - [ ] Moderation queue (admin review)
   - [ ] Publication approval workflow
   - [ ] Unpublish/update published items

2. Discovery & Search
   - [ ] Library browse page
   - [ ] Advanced search filters
   - [ ] Category/tag system
   - [ ] Trending/popular sorting

3. Quality Control
   - [ ] Voting system (upvote/downvote)
   - [ ] Star ratings (1-5)
   - [ ] Review writing
   - [ ] Flag inappropriate content

4. Clone & Fork
   - [ ] Clone entity to workspace
   - [ ] Fork entire workspace
   - [ ] Track provenance (show original)
   - [ ] Sync with upstream (optional)

**Deliverables**:
- ✅ Public library system
- ✅ Voting and ratings
- ✅ Clone/fork functionality
- ✅ Community curation

---

## Security & Access Control

### Authentication

**Method**: JWT (JSON Web Tokens)
- Access token (short-lived, 15 min)
- Refresh token (long-lived, 7 days)
- Secure HTTP-only cookies
- CSRF protection

### Authorization

**Role-Based Access Control (RBAC)**:

**User Roles**:
- **Public**: No account (read-only public library)
- **User**: Registered account (personal workspace)
- **Team Member**: Member of team workspace (role-dependent permissions)
- **Admin**: System administrator (moderation, user management)

**Permissions Matrix**:

| Action | Public | User | Team Editor | Team Admin | System Admin |
|--------|--------|------|-------------|------------|--------------|
| View public library | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clone from library | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create personal entity | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create team entity | ❌ | ❌ | ✅ | ✅ | ✅ |
| Edit team entity | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete team entity | ❌ | ❌ | ❌ | ✅ | ✅ |
| Invite team members | ❌ | ❌ | ❌ | ✅ | ✅ |
| Publish to library | ❌ | ✅ | ✅ | ✅ | ✅ |
| Moderate library | ❌ | ❌ | ❌ | ❌ | ✅ |

### Data Privacy

**Workspace Isolation**:
- Personal workspaces: Private to user
- Team workspaces: Visible only to members
- Public library: Accessible to all (curated)

**Data Encryption**:
- HTTPS for all API calls
- Passwords hashed with bcrypt (cost factor 12)
- Sensitive fields encrypted at rest (optional)

**Audit Logging**:
- Log all create/update/delete operations
- Track who accessed what when
- Retention policy: 90 days

---

## References

### Intelligence Analysis

1. **Heuer, Richards J. Jr.** *Psychology of Intelligence Analysis*. CIA, 1999.
2. **Joint Chiefs of Staff.** *Joint Publication 2-0: Joint Intelligence*. 2013.
3. **Department of the Army.** *FM 2-0 Intelligence*. 2010.

### Network Analysis

4. **Krebs, Valdis.** "Mapping Networks of Terrorist Cells." *Connections* 24.3 (2002): 43-52.
5. **Wasserman, Stanley, and Katherine Faust.** *Social Network Analysis: Methods and Applications*. Cambridge, 1994.

### Analyst Tools

6. **i2 Analyst's Notebook** - IBM Intelligence Analysis Software
7. **Palantir Gotham** - Intelligence Platform
8. **Linkurious** - Graph Visualization Platform

### Technical

9. **D3.js** - Data-Driven Documents. https://d3js.org
10. **Cytoscape.js** - Graph Theory Library. https://js.cytoscape.org
11. **Vis.js** - Network Visualization. https://visjs.org

---

## Appendix: Example Workflows

### Workflow 1: Building an Actor Network

1. **Create Actor**: "Colonel Ivan Petrov"
   - Type: Person
   - Affiliation: Russian Military Intelligence (GRU)
   - Role: Field Commander

2. **Add Deception Assessment**:
   - MOM scores: Motive=5, Opportunity=4, Means=5
   - POP scores: Pattern=5, Sophistication=4, Success=4
   - Overall: 82% deception likelihood (HIGH risk)

3. **Create Related Entities**:
   - Source: "HUMINT Asset-42" reporting on Petrov
   - Event: "Operation Sunrise" (Petrov participated)
   - Place: "Kharkiv Forward Operating Base" (Petrov's location)

4. **Link Entities**:
   - Petrov PARTICIPATED_IN Operation Sunrise
   - Petrov LOCATED_AT Kharkiv FOB
   - Source-42 REPORTS_ON Petrov

5. **View Network**: Visualize Petrov's connections
   - See all related actors, sources, events, places
   - Identify pattern: High deception risk actors cluster around Petrov

6. **Generate Analysis**:
   - Run combined deception analysis
   - Export intelligence report (PDF)
   - Share with team workspace

### Workflow 2: Source Reliability Assessment

1. **Create Source**: "Intercept-2024-10-02"
   - Type: SIGINT
   - Source Type: "Radio Intercept"

2. **MOSES Assessment**:
   - Source Vulnerability: 2/5 (Low - technical collection)
   - Manipulation Evidence: 0/5 (None detected)
   - Access Level: EXCLUSIVE
   - Reliability: A (Completely reliable)

3. **Link Evidence**: Attach intercept transcript as evidence
   - EVE Assessment:
     - Internal Consistency: 5/5 (High - logically coherent)
     - External Corroboration: 4/5 (IMINT confirms)
     - Anomaly Detection: 1/5 (Minor timing oddity)

4. **View in Network**: See what actors/events this source supports

### Workflow 3: Team Collaboration

1. **Create Team Workspace**: "Ukraine Task Force"
2. **Invite Members**: Add 5 analysts (Editors), 1 supervisor (Admin)
3. **Import Entities**: Clone relevant actors from public library
4. **Divide Work**:
   - Analyst A: Focus on military actors
   - Analyst B: Focus on sources
   - Analyst C: Network analysis
5. **Real-time Updates**: Activity feed shows team changes
6. **Weekly Review**: Supervisor reviews deception assessments
7. **Publish Findings**: Promote vetted entities to public library

---

**END OF PLAN**

**Total Estimated Effort**: 60-80 hours across 5 phases
**Priority**: HIGH (extends core deception detection framework)
**Dependencies**: User authentication system, enhanced database schema
**Next Steps**: Review plan, prioritize phases, begin Phase 1 implementation
