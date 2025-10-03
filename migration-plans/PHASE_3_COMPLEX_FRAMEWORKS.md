# Phase 3: Complex Frameworks Migration

**Phase:** 3 of 7
**Duration:** 2-3 weeks
**Status:** Pending
**Prerequisites:** Phase 2 (Framework CRUD) Complete
**Team Size:** 1-2 developers

---

## 🎯 Objectives

Migrate the most complex analysis frameworks that require advanced visualizations, nested data structures, and sophisticated user interactions.

### Success Criteria
- [ ] ACH Dashboard with hypothesis matrix fully functional
- [ ] Deception Detection with indicator tracking system
- [ ] COG (Center of Gravity) with Mermaid diagram generation
- [ ] Causeway Analysis with complex relationships
- [ ] PMESII-PT with nested multi-level factors
- [ ] All complex visualizations rendering correctly
- [ ] Data persistence for nested structures working
- [ ] Export functions handling complex data

---

## 📋 Complex Frameworks Priority

### Priority 1: ACH Dashboard (Week 1)
**Complexity:** Very High
**Original:** `frontend/src/app/(dashboard)/analysis-frameworks/ach-dashboard/`

**Features:**
- Hypothesis matrix (rows = hypotheses, columns = evidence)
- Consistency scoring (+2 to -2)
- Evidence weight calculation
- Overall hypothesis ranking
- Interactive matrix editing
- Color-coded cells based on scores

**Components Needed:**
- `AchMatrix.tsx` - Interactive matrix component
- `AchHypothesis.tsx` - Hypothesis row
- `AchEvidence.tsx` - Evidence column
- `AchScoreCell.tsx` - Individual score cell with editing
- `AchRanking.tsx` - Hypothesis ranking display
- `AchForm.tsx` - Create/edit form

**Data Structure:**
```typescript
interface AchData {
  hypotheses: Array<{
    id: string;
    text: string;
    description?: string;
  }>;
  evidence: Array<{
    id: string;
    text: string;
    description?: string;
    weight?: number; // 1-5
  }>;
  matrix: Record<string, Record<string, number>>; // hypothesisId -> evidenceId -> score
  analysis?: string;
}
```

**Time Estimate:** 3-4 days

---

### Priority 2: Deception Detection (Week 1-2)
**Complexity:** Very High
**Original:** `frontend/src/app/(dashboard)/analysis-frameworks/deception/`

**Features:**
- Multi-category indicator tracking
- Indicator confidence levels
- Pattern detection
- Timeline visualization
- Relationship mapping between indicators
- Risk assessment scoring

**Components Needed:**
- `DeceptionIndicatorList.tsx` - List of indicators by category
- `DeceptionIndicatorForm.tsx` - Add/edit indicators
- `DeceptionTimeline.tsx` - Timeline view
- `DeceptionPatternDetector.tsx` - Pattern analysis
- `DeceptionRiskMatrix.tsx` - Risk visualization
- `DeceptionRelationshipMap.tsx` - Indicator relationships

**Data Structure:**
```typescript
interface DeceptionData {
  indicators: Array<{
    id: string;
    category: 'environmental' | 'behavioral' | 'technical' | 'temporal';
    indicator: string;
    description?: string;
    confidence: 'low' | 'medium' | 'high' | 'confirmed';
    timestamp?: string;
    relatedIndicators?: string[]; // IDs of related indicators
  }>;
  patterns: Array<{
    id: string;
    name: string;
    indicatorIds: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;
  analysis: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
}
```

**Special Considerations:**
- Real-time pattern detection algorithm
- Complex relationship visualization
- Export must include all indicator relationships

**Time Estimate:** 4-5 days

---

### Priority 3: COG (Center of Gravity) (Week 2)
**Complexity:** High
**Original:** `frontend/src/app/(dashboard)/analysis-frameworks/cog/`

**Features:**
- Multiple COG identification
- Critical capabilities per COG
- Critical requirements per capability
- Critical vulnerabilities per requirement
- Mermaid diagram generation showing hierarchy
- Interactive diagram editing

**Components Needed:**
- `CogList.tsx` - List of COGs
- `CogForm.tsx` - Add/edit COG
- `CogCapabilityList.tsx` - Capabilities for a COG
- `CogRequirementList.tsx` - Requirements for a capability
- `CogVulnerabilityList.tsx` - Vulnerabilities for a requirement
- `CogDiagram.tsx` - Mermaid diagram renderer
- `CogDiagramEditor.tsx` - Visual diagram editor (optional)

**Data Structure:**
```typescript
interface CogData {
  cogs: Array<{
    id: string;
    name: string;
    description?: string;
    capabilities: Array<{
      id: string;
      name: string;
      description?: string;
      requirements: Array<{
        id: string;
        name: string;
        description?: string;
        vulnerabilities: Array<{
          id: string;
          name: string;
          description?: string;
          exploitability: 'low' | 'medium' | 'high';
        }>;
      }>;
    }>;
  }>;
  analysis?: string;
}
```

**Mermaid Diagram Generation:**
```typescript
const generateMermaidDiagram = (cog: Cog) => {
  let diagram = 'graph TD\n';
  diagram += `COG[${cog.name}]\n`;

  cog.capabilities.forEach(cap => {
    diagram += `COG --> CAP${cap.id}[${cap.name}]\n`;

    cap.requirements.forEach(req => {
      diagram += `CAP${cap.id} --> REQ${req.id}[${req.name}]\n`;

      req.vulnerabilities.forEach(vuln => {
        diagram += `REQ${req.id} --> VULN${vuln.id}[${vuln.name}]\n`;
      });
    });
  });

  return diagram;
};
```

**Time Estimate:** 3-4 days

---

### Priority 4: PMESII-PT (Week 2-3)
**Complexity:** High
**Original:** `frontend/src/app/(dashboard)/analysis-frameworks/pmesii-pt/`

**Features:**
- 8 domains (Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time)
- Nested factors within each domain
- Sub-factors within factors
- Interconnections between domains
- Impact assessment per factor
- Visualization of domain relationships

**Components Needed:**
- `PmesiiDomainList.tsx` - List of 8 domains
- `PmesiiDomain.tsx` - Single domain with factors
- `PmesiiFactor.tsx` - Single factor with sub-factors
- `PmesiiFactorForm.tsx` - Add/edit factors
- `PmesiiInterconnections.tsx` - Domain relationship map
- `PmesiiVisualization.tsx` - Domain impact visualization

**Data Structure:**
```typescript
interface PmesiiData {
  domains: Record<PmesiiDomain, {
    factors: Array<{
      id: string;
      name: string;
      description?: string;
      impact: 'low' | 'medium' | 'high';
      subFactors?: Array<{
        id: string;
        name: string;
        description?: string;
      }>;
      interconnections?: string[]; // IDs of related factors in other domains
    }>;
  }>;
  analysis?: string;
}

type PmesiiDomain =
  | 'political'
  | 'military'
  | 'economic'
  | 'social'
  | 'information'
  | 'infrastructure'
  | 'physical_environment'
  | 'time';
```

**UI Layout:**
- Tab-based navigation between domains
- Accordion for factors within domains
- Drag-and-drop for factor ordering
- Modal for interconnection mapping

**Time Estimate:** 4-5 days

---

### Priority 5: Causeway Analysis (Week 3)
**Complexity:** High
**Original:** `frontend/src/app/(dashboard)/analysis-frameworks/causeway/`

**Features:**
- Geographic analysis focus
- Avenue of approach identification
- Obstacle identification
- Key terrain identification
- Observation and fields of fire
- Cover and concealment assessment
- OAKOC (Observation, Avenues, Key terrain, Obstacles, Cover/concealment)

**Components Needed:**
- `CausewayOakocForm.tsx` - OAKOC analysis form
- `CausewayMap.tsx` - Map visualization (optional)
- `CausewayFactorList.tsx` - List factors by category
- `CausewayAssessment.tsx` - Overall assessment view

**Data Structure:**
```typescript
interface CausewayData {
  observation: {
    points: Array<{
      id: string;
      location: string;
      description: string;
      advantage: 'friendly' | 'enemy' | 'neutral';
    }>;
  };
  avenues: {
    approaches: Array<{
      id: string;
      name: string;
      description: string;
      suitability: 'high' | 'medium' | 'low';
      risks: string[];
    }>;
  };
  keyTerrain: {
    features: Array<{
      id: string;
      name: string;
      description: string;
      importance: 'critical' | 'important' | 'minor';
    }>;
  };
  obstacles: {
    items: Array<{
      id: string;
      name: string;
      type: 'natural' | 'man-made';
      description: string;
      breachable: boolean;
    }>;
  };
  cover: {
    areas: Array<{
      id: string;
      location: string;
      type: 'cover' | 'concealment' | 'both';
      description: string;
    }>;
  };
  analysis?: string;
}
```

**Time Estimate:** 3-4 days

---

## 🏗️ Shared Complex Framework Patterns

### Pattern 1: Nested Data Management
Many complex frameworks have deeply nested data. Create reusable utilities:

**File:** `src/lib/utils/nested-data.ts`
```typescript
export function addNestedItem<T>(
  data: T,
  path: string[],
  item: any
): T {
  const newData = JSON.parse(JSON.stringify(data));
  let current = newData;

  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]];
  }

  const lastKey = path[path.length - 1];
  if (Array.isArray(current[lastKey])) {
    current[lastKey].push(item);
  } else {
    current[lastKey] = item;
  }

  return newData;
}

export function updateNestedItem<T>(
  data: T,
  path: string[],
  itemId: string,
  updates: any
): T {
  const newData = JSON.parse(JSON.stringify(data));
  let current = newData;

  for (let i = 0; i < path.length; i++) {
    if (i === path.length - 1) {
      const items = current[path[i]] as any[];
      const index = items.findIndex(item => item.id === itemId);
      if (index !== -1) {
        items[index] = { ...items[index], ...updates };
      }
    } else {
      current = current[path[i]];
    }
  }

  return newData;
}

export function deleteNestedItem<T>(
  data: T,
  path: string[],
  itemId: string
): T {
  const newData = JSON.parse(JSON.stringify(data));
  let current = newData;

  for (let i = 0; i < path.length; i++) {
    if (i === path.length - 1) {
      const items = current[path[i]] as any[];
      current[path[i]] = items.filter(item => item.id !== itemId);
    } else {
      current = current[path[i]];
    }
  }

  return newData;
}
```

### Pattern 2: Matrix Components
For ACH and similar matrix-based frameworks:

**File:** `src/components/frameworks/shared/EditableMatrix.tsx`
```typescript
interface EditableMatrixProps {
  rows: Array<{ id: string; label: string }>;
  columns: Array<{ id: string; label: string }>;
  data: Record<string, Record<string, number>>;
  onChange: (rowId: string, colId: string, value: number) => void;
  min?: number;
  max?: number;
  colorScale?: (value: number) => string;
}

export function EditableMatrix({
  rows,
  columns,
  data,
  onChange,
  min = -2,
  max = 2,
  colorScale
}: EditableMatrixProps) {
  // Implementation with editable cells, color coding, etc.
}
```

### Pattern 3: Diagram Visualization
For COG and relationship-based frameworks:

**File:** `src/components/frameworks/shared/MermaidDiagram.tsx`
```typescript
import mermaid from 'mermaid';
import { useEffect, useRef } from 'react';

interface MermaidDiagramProps {
  diagram: string;
  id?: string;
}

export function MermaidDiagram({ diagram, id = 'mermaid-diagram' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      mermaid.initialize({ startOnLoad: true, theme: 'default' });
      mermaid.render(id, diagram).then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      });
    }
  }, [diagram, id]);

  return <div ref={containerRef} className="mermaid-container" />;
}
```

---

## 🔧 Technical Implementation

### Complex Form Handling

For frameworks with deeply nested data, use `useFieldArray` from React Hook Form:

```typescript
const { fields, append, remove, update } = useFieldArray({
  control,
  name: 'hypotheses'
});
```

### State Management for Complex Forms

Consider using Zustand for temporary form state:

**File:** `src/stores/ach-form.store.ts`
```typescript
import { create } from 'zustand';

interface AchFormStore {
  hypotheses: Hypothesis[];
  evidence: Evidence[];
  matrix: Matrix;
  addHypothesis: (hypothesis: Hypothesis) => void;
  removeHypothesis: (id: string) => void;
  updateScore: (hypId: string, evId: string, score: number) => void;
  reset: () => void;
}

export const useAchFormStore = create<AchFormStore>((set) => ({
  hypotheses: [],
  evidence: [],
  matrix: {},
  addHypothesis: (hypothesis) =>
    set((state) => ({
      hypotheses: [...state.hypotheses, hypothesis]
    })),
  // ... other actions
  reset: () => set({ hypotheses: [], evidence: [], matrix: {} })
}));
```

---

## ✅ Testing Strategy

### Unit Tests
- [ ] Nested data utilities work correctly
- [ ] Matrix score calculations accurate
- [ ] Mermaid diagram generation produces valid syntax
- [ ] Pattern detection algorithms work

### Integration Tests
- [ ] ACH matrix updates persist
- [ ] COG hierarchy saves correctly
- [ ] PMESII domain interconnections work
- [ ] Deception patterns detect correctly

### E2E Tests (Critical Paths)
- [ ] User can create ACH analysis with matrix
- [ ] User can build COG hierarchy
- [ ] User can add PMESII factors and interconnect
- [ ] Deception indicators track relationships

### Performance Tests
- [ ] Large ACH matrices (10x10) render smoothly
- [ ] COG diagrams with 50+ nodes render < 2s
- [ ] PMESII with 100+ factors loads < 3s

---

## 📦 Deliverables

1. **Components:**
   - [ ] 5 complex framework forms
   - [ ] Visualization components
   - [ ] Shared matrix/diagram components

2. **Pages:**
   - [ ] List/Create/Edit/View for each framework

3. **Utilities:**
   - [ ] Nested data helpers
   - [ ] Diagram generators
   - [ ] Pattern detection algorithms

4. **Documentation:**
   - [ ] Component usage docs
   - [ ] Data structure docs
   - [ ] Algorithm explanations

---

## 🚨 Risk Mitigation

### Risk: Complex visualizations slow performance
**Mitigation:**
- Implement virtualization for large matrices
- Use React.memo for expensive components
- Lazy load diagram libraries

### Risk: Deeply nested data causes form issues
**Mitigation:**
- Use Zustand for complex form state
- Implement autosave frequently
- Add form state recovery

### Risk: Export functions fail with complex data
**Mitigation:**
- Test exports early
- Implement data flattening for exports
- Add export previews

---

## 📚 External Dependencies

```json
{
  "mermaid": "^11.0.0",
  "react-virtualized": "^9.22.5",
  "immer": "^10.1.1"
}
```

---

**Phase Status:** Pending (Phase 2 prerequisite)
**Next Phase:** Phase 4 - Research Tools
**Estimated Completion:** 2-3 weeks after Phase 2 completion
