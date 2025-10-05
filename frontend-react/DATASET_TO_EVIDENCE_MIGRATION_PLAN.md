# Dataset Linking → Evidence Linking Migration Plan

## Problem
Framework sections currently have "Link Dataset" which only allows linking datasets. This should be "Link Evidence" allowing linking to **all evidence entities**: Data, Actors, Sources, and Events.

## Current State
- **Component**: SectionCard in GenericFrameworkForm.tsx
- **Button**: "Link Dataset"
- **Components Used**: DatasetSelector, DatasetBadge
- **State**: `sectionDataset: { [key: string]: Dataset[] }`
- **API**: `/api/framework-datasets`

## Target State
- **Component**: SectionCard in GenericFrameworkForm.tsx
- **Button**: "Link Evidence"
- **Components Used**: EvidenceLinker (already exists!), EvidenceBadge
- **State**: `sectionEvidence: { [key: string]: LinkedEvidence[] }`
- **API**: `/api/framework-evidence` (framework-evidence linking system)

## Evidence Infrastructure (Already Exists!)
✅ EvidenceLinker component - Multi-tab selector for Data/Actor/Source/Event
✅ EvidenceBadge component - Displays linked evidence with breakdown
✅ EvidencePanel component - Shows all linked evidence
✅ framework-evidence types - Complete type system
✅ LinkedEvidence interface - entity_type, entity_id, entity_data, relation, notes

## Implementation Steps

### Step 1: Update SectionCard to Use Evidence Linking
**File**: `src/components/frameworks/GenericFrameworkForm.tsx`

**Changes**:
1. Replace dataset props with evidence props:
   - `linkedDataset: Dataset[]` → `linkedEvidence: LinkedEvidence[]`
   - `onLinkDataset` → `onLinkEvidence`
   - `onRemoveDataset` → `onRemoveEvidence`

2. Update UI in SectionCard:
   - Change "Link Dataset" → "Link Evidence"
   - Replace DatasetBadge with EvidenceBadge
   - Update count display
   - Update empty state message

3. Import evidence components instead of dataset components:
   ```typescript
   import { EvidenceBadge } from '@/components/evidence'
   import type { LinkedEvidence } from '@/types/framework-evidence'
   ```

### Step 2: Update GenericFrameworkForm State Management
**File**: `src/components/frameworks/GenericFrameworkForm.tsx`

**Changes**:
1. Replace dataset state with evidence state:
   ```typescript
   // OLD
   const [sectionDataset, setSectionDataset] = useState<{ [key: string]: Dataset[] }>({})
   const [datasetSelectorOpen, setDatasetSelectorOpen] = useState(false)

   // NEW
   const [sectionEvidence, setSectionEvidence] = useState<{ [key: string]: LinkedEvidence[] }>({})
   const [evidenceLinkerOpen, setEvidenceLinkerOpen] = useState(false)
   ```

2. Update loading function:
   ```typescript
   // OLD: loadLinkedDataset()
   // NEW: loadLinkedEvidence()
   const loadLinkedEvidence = async () => {
     if (!frameworkId) return
     try {
       const response = await fetch(`/api/framework-evidence?framework_id=${frameworkId}&framework_type=${frameworkType}`)
       // Group by section using framework_item_id
     }
   }
   ```

3. Update handlers:
   ```typescript
   const openEvidenceLinker = (sectionKey: string) => {
     setActiveSection(sectionKey)
     setEvidenceLinkerOpen(true)
   }

   const handleEvidenceLink = async (selected: LinkedEvidence[]) => {
     // Link via API: POST /api/framework-evidence
   }

   const handleEvidenceRemove = async (sectionKey: string, evidence: LinkedEvidence) => {
     // Unlink via API: DELETE /api/framework-evidence
   }
   ```

4. Replace DatasetSelector with EvidenceLinker component:
   ```typescript
   <EvidenceLinker
     open={evidenceLinkerOpen}
     onClose={() => setEvidenceLinkerOpen(false)}
     onLink={handleEvidenceLink}
     alreadyLinked={activeSection ? sectionEvidence[activeSection] : []}
   />
   ```

### Step 3: Update All SectionCard Usages
**File**: `src/components/frameworks/GenericFrameworkForm.tsx`

Update all SectionCard component calls to use new evidence props:
```typescript
<SectionCard
  section={section}
  items={sectionData[section.key]}
  // ... other props ...
  linkedEvidence={sectionEvidence[section.key] || []}
  onLinkEvidence={() => openEvidenceLinker(section.key)}
  onRemoveEvidence={(evidence) => handleEvidenceRemove(section.key, evidence)}
/>
```

### Step 4: Remove Dataset Components
**Files**:
- Remove imports: `DatasetSelector`, `DatasetBadge`
- Remove from `src/components/datasets/DatasetSelector.tsx` usage
- Remove dataset-related code

### Step 5: Testing
1. Test linking evidence to framework sections
2. Test removing evidence from sections
3. Test evidence persistence across saves
4. Test evidence display in view mode
5. Test with different evidence types (Data, Actor, Source, Event)

## Benefits
✅ Unified evidence system across all frameworks
✅ Link any evidence type (not just datasets)
✅ Better integration with network graph
✅ Consistent UX with framework-level evidence linking
✅ Supports relation types (supports, contradicts, etc.)
✅ Evidence breakdown by type visible in badge

## Migration Strategy
- **Backwards Compatibility**: Old dataset links can remain (different API)
- **Data Migration**: Optionally migrate existing dataset links to evidence links
- **Gradual Rollout**: Can be deployed without breaking existing functionality

## API Notes
The framework-evidence API expects:
- `framework_type`: 'behavior', 'comb-analysis', 'ach', etc.
- `framework_id`: The ID of the specific analysis
- `framework_item_id`: Optional - for section-level linking (use section.key)
- `entity_type`: 'data', 'actor', 'source', 'event'
- `entity_id`: The ID of the evidence entity

For section-level linking, we'll use:
- `framework_item_id = section.key` (e.g., 'environmental_factors', 'timeline')
