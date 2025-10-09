# COG Wizard Relationship Fix Plan

## Problem Statement

The COG wizard currently has broken relationships:
- ❌ All requirements link to only the FIRST capability (`caps[0]`)
- ❌ All vulnerabilities link to only the FIRST requirement (`reqs[0]`)
- ❌ No entity linking for COG

## Required Relationships

```
Entity (Actor/Organization)
  └─ COG (Center of Gravity)
      └─ Critical Capability 1
          ├─ Critical Requirement 1.1
          │   └─ Critical Vulnerability 1.1.1
          │   └─ Critical Vulnerability 1.1.2
          └─ Critical Requirement 1.2
              └─ Critical Vulnerability 1.2.1
      └─ Critical Capability 2
          └─ Critical Requirement 2.1
              └─ Critical Vulnerability 2.1.1
```

**Key Rules:**
1. **Vulnerability → Requirements**: 1:N (one vulnerability can exploit multiple requirements)
2. **Requirement → Capabilities**: 1:N (one requirement can support multiple capabilities)
3. **Capability → COG**: N:1 (many capabilities belong to one COG)
4. **COG → Entity**: 1:1 or 1:0 (one COG represents one entity, optional)

## Current Code Issues

### Issue 1: Requirements Link
```typescript
// CURRENT (WRONG)
const reqs: CriticalRequirement[] = requirements
  .filter((r) => r.requirement)
  .map((r, i) => ({
    id: i === 0 ? reqId : crypto.randomUUID(),
    capability_id: caps[0]?.id || capId,  // ❌ ALL link to first capability
    requirement: r.requirement,
    // ...
  }))
```

**Fix**: Add `capability_id` field to requirement form state

### Issue 2: Vulnerabilities Link
```typescript
// CURRENT (WRONG)
const vulns: CriticalVulnerability[] = vulnerabilities
  .filter((v) => v.vulnerability)
  .map((v) => ({
    id: crypto.randomUUID(),
    requirement_id: reqs[0]?.id || reqId,  // ❌ ALL link to first requirement
    vulnerability: v.vulnerability,
    // ...
  }))
```

**Fix**: Add `requirement_ids` field to vulnerability form state (array for multiple)

### Issue 3: Entity Link
```typescript
// MISSING
const cog: CenterOfGravity = {
  // ... no entity_id field
}
```

**Fix**: Add entity selector in COG step

## Implementation Plan

### Phase 1: Update Form State (30 min)

**File**: `src/components/frameworks/COGWizard.tsx`

1. Add capability IDs tracking:
```typescript
const [capabilityIds, setCapabilityIds] = useState<string[]>([])
```

2. Update requirements state:
```typescript
const [requirements, setRequirements] = useState<Array<{
  requirement: string
  type: string
  capability_id: string  // NEW: which capability does this support?
}>>([
  { requirement: '', type: 'other', capability_id: '' }
])
```

3. Update vulnerabilities state:
```typescript
const [vulnerabilities, setVulnerabilities] = useState<Array<{
  vulnerability: string
  description: string
  type: string
  expectedEffect: string
  recommendedActions: string
  requirement_ids: string[]  // NEW: which requirements does this exploit?
}>>([
  { vulnerability: '', description: '', type: 'other', expectedEffect: '', recommendedActions: '', requirement_ids: [] }
])
```

4. Add entity linking:
```typescript
const [cogEntityId, setCogEntityId] = useState<number | null>(null)
```

### Phase 2: Update UI (1 hour)

#### Requirements Step (Step 4)

Add capability selector to each requirement:

```tsx
<div>
  <Label>Supports Which Capability? *</Label>
  <Select
    value={req.capability_id}
    onValueChange={(value) => {
      const updated = [...requirements]
      updated[index].capability_id = value
      setRequirements(updated)
    }}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select capability..." />
    </SelectTrigger>
    <SelectContent>
      {capabilities
        .filter(c => c.capability)
        .map((cap, idx) => (
          <SelectItem key={idx} value={capabilityIds[idx]}>
            {cap.capability || `Capability ${idx + 1}`}
          </SelectItem>
        ))}
    </SelectContent>
  </Select>
</div>
```

#### Vulnerabilities Step (Step 5)

Add requirement multi-selector:

```tsx
<div>
  <Label>Exploits Which Requirements? *</Label>
  <div className="space-y-2 p-3 border rounded-lg">
    {requirements
      .filter(r => r.requirement)
      .map((req, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Checkbox
            checked={vuln.requirement_ids.includes(requirementIds[idx])}
            onCheckedChange={(checked) => {
              const updated = [...vulnerabilities]
              if (checked) {
                updated[vulnIndex].requirement_ids.push(requirementIds[idx])
              } else {
                updated[vulnIndex].requirement_ids = updated[vulnIndex].requirement_ids
                  .filter(id => id !== requirementIds[idx])
              }
              setVulnerabilities(updated)
            }}
          />
          <label className="text-sm flex-1">
            {req.requirement}
            <Badge variant="outline" className="ml-2 text-xs">
              {capabilities.find(c => capabilityIds[capabilities.indexOf(c)] === req.capability_id)?.capability || 'Unknown'}
            </Badge>
          </label>
        </div>
      ))}
  </div>
  {vuln.requirement_ids.length === 0 && (
    <p className="text-xs text-red-600">Select at least one requirement</p>
  )}
</div>
```

#### COG Step (Step 2)

Add entity selector (optional):

```tsx
<div>
  <Label>Entity/Actor (Optional)</Label>
  <p className="text-xs text-muted-foreground mb-2">
    Link this COG to a specific entity or organization from your intelligence database
  </p>
  <Button
    variant="outline"
    onClick={() => {
      // Open entity picker modal
      setShowEntityPicker(true)
    }}
  >
    {cogEntityId ? 'Change Entity' : 'Select Entity'}
  </Button>
  {cogEntityId && (
    <p className="text-sm text-green-600 mt-1">
      ✓ Linked to entity #{cogEntityId}
    </p>
  )}
</div>
```

### Phase 3: Update Data Submission (30 min)

Update the `handleSave` function:

```typescript
const handleSave = async () => {
  // Generate IDs
  const cogId = crypto.randomUUID()
  const capIds = capabilities.map(() => crypto.randomUUID())
  const reqIds = requirements.map(() => crypto.randomUUID())

  // Build capabilities with proper IDs
  const caps: CriticalCapability[] = capabilities
    .filter((c) => c.capability)
    .map((c, i) => ({
      id: capIds[i],
      cog_id: cogId,
      capability: c.capability,
      description: c.description,
      strategic_contribution: c.description,
      linked_evidence: [],
    }))

  // Build requirements with proper capability links
  const reqs: CriticalRequirement[] = requirements
    .filter((r) => r.requirement)
    .map((r, i) => ({
      id: reqIds[i],
      capability_id: r.capability_id,  // ✅ Use selected capability
      requirement: r.requirement,
      requirement_type: r.type as any,
      description: r.requirement,
      linked_evidence: [],
    }))

  // Build vulnerabilities with proper requirement links
  const vulns: CriticalVulnerability[] = vulnerabilities
    .filter((v) => v.vulnerability && v.requirement_ids.length > 0)
    .flatMap((v) =>
      // Create a vulnerability for EACH linked requirement
      v.requirement_ids.map((reqId) => ({
        id: crypto.randomUUID(),
        requirement_id: reqId,  // ✅ Use selected requirement
        vulnerability: v.vulnerability,
        vulnerability_type: v.type as any,
        description: v.description,
        expected_effect: v.expectedEffect,
        recommended_actions: v.recommendedActions
          ? v.recommendedActions.split(',').map((a) => a.trim())
          : [],
        confidence: 'medium' as const,
        scoring: {
          impact_on_cog: 3,
          attainability: 3,
          follow_up_potential: 3,
        },
        composite_score: 9,
        linked_evidence: [],
      }))
    )

  // Build COG with entity link
  const cog: CenterOfGravity = {
    id: cogId,
    entity_id: cogEntityId || undefined,  // ✅ Link to entity
    actor_category: cogActor,
    domain: cogDomain,
    description: cogDescription,
    rationale: cogRationale,
    // ... rest
  }

  // ... rest of save logic
}
```

### Phase 4: Validation (15 min)

Add validation checks:

```typescript
// Before proceeding from Step 4 (Requirements)
const validateRequirements = () => {
  const hasInvalidReqs = requirements.some(r =>
    r.requirement && !r.capability_id
  )
  return !hasInvalidReqs
}

// Before proceeding from Step 5 (Vulnerabilities)
const validateVulnerabilities = () => {
  const hasInvalidVulns = vulnerabilities.some(v =>
    v.vulnerability && v.requirement_ids.length === 0
  )
  return !hasInvalidVulns
}
```

### Phase 5: Visual Feedback (15 min)

Add visual indicators showing relationships:

#### In Requirements Step:
```tsx
<Badge variant="secondary" className="text-xs">
  → {capabilities.find(c => c.capability_id === req.capability_id)?.capability || 'Select capability'}
</Badge>
```

#### In Vulnerabilities Step:
```tsx
<div className="text-xs text-muted-foreground mt-1">
  Exploits: {vuln.requirement_ids.length > 0
    ? vuln.requirement_ids.map(id =>
        requirements.find(r => r.id === id)?.requirement
      ).join(', ')
    : 'None selected'}
</div>
```

#### In Review Step:
Show full hierarchy:
```tsx
<div className="space-y-4">
  <h3>COG: {cogDescription}</h3>
  {cogEntityId && <Badge>Linked to Entity #{cogEntityId}</Badge>}

  {capabilities.map(cap => (
    <div key={cap.id} className="ml-4">
      <h4>↳ Capability: {cap.capability}</h4>

      {requirements
        .filter(r => r.capability_id === cap.id)
        .map(req => (
          <div key={req.id} className="ml-4">
            <h5>→ Requirement: {req.requirement}</h5>

            {vulnerabilities
              .filter(v => v.requirement_ids.includes(req.id))
              .map(vuln => (
                <div key={vuln.id} className="ml-4">
                  <p>⚠️ Vulnerability: {vuln.vulnerability}</p>
                </div>
              ))}
          </div>
        ))}
    </div>
  ))}
</div>
```

## Database Schema

The existing schema already supports these relationships:

```sql
-- Already exists
critical_capabilities.cog_id → centers_of_gravity.id
critical_requirements.capability_id → critical_capabilities.id
critical_vulnerabilities.requirement_id → critical_requirements.id

-- Need to add (optional)
centers_of_gravity.entity_id → entities.id
```

If entity linking is required, add migration:

```sql
ALTER TABLE centers_of_gravity
ADD COLUMN entity_id INTEGER REFERENCES entities(id);

CREATE INDEX idx_cog_entity ON centers_of_gravity(entity_id);
```

## Testing Checklist

- [ ] Create COG with 2 capabilities
- [ ] Add 3 requirements: 2 for cap1, 1 for cap2
- [ ] Add 4 vulnerabilities: 2 for req1, 1 for req2, 1 for both req1+req3
- [ ] Verify all relationships in database after save
- [ ] Check that vulnerabilities appear under correct requirements in view
- [ ] Test entity linking (if implemented)
- [ ] Verify advanced mode receives correct data structure

## Timeline

- Phase 1: 30 min
- Phase 2: 1 hour
- Phase 3: 30 min
- Phase 4: 15 min
- Phase 5: 15 min
- Testing: 30 min
- **Total: ~3 hours**

## Priority

**HIGH** - This is a critical flaw in the COG analysis workflow that breaks the fundamental COG methodology.

---

**Created**: 2025-10-06
**Status**: Ready for Implementation
