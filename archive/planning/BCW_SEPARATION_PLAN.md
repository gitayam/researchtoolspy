# COM-B/BCW Framework Separation Plan

## Problem Statement

**Current Implementation is WRONG:** I've mixed objective behavior analysis with target-audience-specific COM-B assessment.

**Key Insight:** You cannot assess Capability, Opportunity, or Motivation without knowing **WHO** you're assessing. COM-B is inherently target-audience-specific.

---

## Correct Framework Architecture

### Framework 1: Behavior Analysis (OBJECTIVE)

**Purpose:** Document and analyze a behavior in a specific area/location WITHOUT bias toward any target audience.

**Sections Should Include:**
1. **Basic Information**
   - Behavior description
   - Location/area
   - Context/environment

2. **Behavior Timeline** ✅ Already correct
   - When behavior occurs
   - Sequence of events
   - Duration
   - Forks (alternative paths)

3. **Environmental Factors** (NOT individual capability)
   - Physical environment (infrastructure, resources available)
   - Social environment (cultural norms in the area)
   - Economic factors
   - Political/legal environment

4. **Barriers and Facilitators** (OBJECTIVE)
   - Environmental obstacles (NOT "target audience can't...")
   - Structural facilitators
   - Systemic factors

5. **Consequences and Outcomes**
   - What happens when behavior is performed
   - Rewards/costs (objective, not individual motivation)

6. **Symbols and Signals**
   - Cultural symbols associated with behavior
   - Social signals

7. **Observed Patterns**
   - Who performs the behavior (demographics/description)
   - Frequency
   - Variations

8. **Target Audience Identification** (LIST only, no assessment)
   - Primary audiences
   - Secondary audiences
   - Enablers
   - Opposers
   - Beneficiaries

**REMOVE FROM BEHAVIOR ANALYSIS:**
- ❌ Physical Capability sections (TA-specific)
- ❌ Psychological Capability sections (TA-specific)
- ❌ Physical Opportunity sections (TA-specific)
- ❌ Social Opportunity sections (TA-specific)
- ❌ Reflective Motivation sections (TA-specific)
- ❌ Automatic Motivation sections (TA-specific)
- ❌ COM-B deficit assessment
- ❌ BCW intervention recommendations

---

### Framework 2: COM-B Analysis (NEW - TARGET AUDIENCE SPECIFIC)

**Purpose:** Assess a SPECIFIC target audience's capability, opportunity, and motivation to perform a behavior, then generate BCW intervention recommendations.

**Required Inputs:**
1. **Link to Behavior Analysis** (dropdown/selector)
2. **Select Target Audience** (from behavior analysis or create new)

**Sections:**

#### 1. Analysis Setup
- **Linked Behavior:** [Select from Behavior Analysis framework]
- **Target Audience:** [Select or define]
  - Name/description
  - Demographics
  - Psychographics
  - Current relationship to behavior

#### 2. COM-B Assessment (FOR THIS SPECIFIC AUDIENCE)

**Physical Capability**
- Question: Does this audience have the physical skills, strength, stamina to perform the behavior?
- Assessment: Adequate / Deficit / Major Barrier
- Evidence/Notes: Why?

**Psychological Capability**
- Question: Does this audience have the knowledge, cognitive skills, comprehension needed?
- Assessment: Adequate / Deficit / Major Barrier
- Evidence/Notes: Why?

**Physical Opportunity**
- Question: Does this audience have access to environmental factors, time, resources, infrastructure?
- Assessment: Adequate / Deficit / Major Barrier
- Evidence/Notes: Why?

**Social Opportunity**
- Question: Do cultural norms, social cues, peer influence support this audience?
- Assessment: Adequate / Deficit / Major Barrier
- Evidence/Notes: Why?

**Reflective Motivation**
- Question: Do this audience's beliefs, intentions, goals, identity align with the behavior?
- Assessment: Adequate / Deficit / Major Barrier
- Evidence/Notes: Why?

**Automatic Motivation**
- Question: Do this audience's emotions, impulses, habits, desires support the behavior?
- Assessment: Adequate / Deficit / Major Barrier
- Evidence/Notes: Why?

#### 3. BCW Recommendations (AUTO-GENERATED)
- Feasibility assessment
- Intervention function recommendations (based on deficits)
- Policy category recommendations
- Implementation roadmap

---

## Migration Strategy

### Phase 1: Create New COM-B Analysis Framework

**New Files to Create:**
```
src/config/framework-configs.ts
  └─ Add 'comb-analysis' framework config

src/pages/frameworks/COMBAnalysisPage.tsx
  └─ New list page for COM-B analyses

src/components/frameworks/COMBAnalysisForm.tsx (optional)
  └─ Or use GenericFrameworkForm with special handling

src/types/comb-analysis.ts
  └─ Extend BehaviorAnalysisWithBCW types
```

**Framework Config Structure:**
```typescript
'comb-analysis': {
  type: 'comb-analysis',
  title: 'COM-B Analysis (Behaviour Change Wheel)',
  description: 'Assess target audience capability, opportunity, motivation for a specific behavior',
  sections: [
    {
      key: 'setup',
      label: 'Analysis Setup',
      // Behavior selector + TA definition
    },
    {
      key: 'physical_capability',
      label: 'Physical Capability Assessment',
      hasDeficitAssessment: true,
      comBComponent: 'physical_capability'
    },
    // ... rest of COM-B components
  ]
}
```

### Phase 2: Strip COM-B from Behavior Analysis

**Files to Modify:**
```
src/config/framework-configs.ts
  └─ Remove COM-B sections from 'behavior' framework
  └─ Remove hasDeficitAssessment flags
  └─ Remove comBComponent references

src/components/frameworks/GenericFrameworkForm.tsx
  └─ Remove deficit assessment UI
  └─ Remove BCWRecommendations component usage

src/components/frameworks/GenericFrameworkView.tsx
  └─ Remove BCWRecommendations component usage

src/lib/report-generator.ts
  └─ Remove COM-B export logic from behavior framework
  └─ Keep for comb-analysis framework
```

**New Behavior Framework Structure:**
```typescript
'behavior': {
  type: 'behavior',
  title: 'Behavior Analysis',
  description: 'Objective analysis of behaviors in a location/area',
  sections: [
    {
      key: 'basic_info',
      label: 'Basic Information',
      description: 'Behavior and environmental context',
    },
    {
      key: 'timeline',
      label: 'Behavior Timeline',
      description: 'When, where, and how the behavior occurs',
    },
    {
      key: 'environmental_factors',
      label: 'Environmental Factors',
      description: 'Physical, social, economic, political environment',
    },
    {
      key: 'barriers_facilitators',
      label: 'Barriers and Facilitators',
      description: 'Objective environmental obstacles and enablers',
    },
    {
      key: 'consequences',
      label: 'Consequences and Outcomes',
      description: 'What happens when behavior is performed',
    },
    {
      key: 'symbols_signals',
      label: 'Symbols and Signals',
      description: 'Cultural symbols, gestures, codes',
    },
    {
      key: 'observed_patterns',
      label: 'Observed Patterns',
      description: 'Who performs, frequency, variations',
    },
    {
      key: 'target_audiences',
      label: 'Target Audience Identification',
      description: 'List potential audiences (no assessment)',
    }
  ]
}
```

### Phase 3: Link Behaviors to COM-B Analyses

**Database/API Considerations:**
- COM-B Analysis should reference a Behavior Analysis ID
- One Behavior Analysis can have multiple COM-B Analyses (different TAs)
- UI should show "Create COM-B Analysis" button when viewing a Behavior Analysis

**UI Flow:**
1. User creates Behavior Analysis (objective)
2. User views Behavior Analysis
3. User clicks "Create COM-B Analysis for Target Audience"
4. Form pre-fills linked behavior
5. User selects/defines target audience
6. User assesses that TA's COM-B components
7. System generates BCW recommendations

---

## Data Migration

**Existing Behavior Analyses with COM-B Data:**

Option A: **Convert to COM-B Analyses**
- Migrate `com_b_deficits` data to new COM-B Analysis records
- Link back to parent Behavior Analysis (if exists)
- Clear COM-B data from Behavior Analysis records

Option B: **Keep as-is, deprecate gradually**
- Mark old records as "legacy"
- New records use correct separation
- Provide migration tool for users

**Recommended:** Option A with careful data migration script

---

## Implementation Checklist

### Week 1: New COM-B Analysis Framework
- [ ] Create COM-B Analysis types
- [ ] Add COM-B Analysis framework config
- [ ] Create COM-B Analysis page/routes
- [ ] Update navigation to include COM-B Analysis
- [ ] Test CRUD operations

### Week 2: Behavior Analysis Cleanup
- [ ] Remove COM-B sections from Behavior config
- [ ] Remove deficit assessment UI from forms
- [ ] Remove BCW recommendations from Behavior views
- [ ] Update report exports (remove BCW from Behavior)
- [ ] Add "Environmental Factors" section
- [ ] Add "Observed Patterns" section

### Week 3: Linking and Integration
- [ ] Add behavior selector to COM-B Analysis form
- [ ] Add "Create COM-B Analysis" button to Behavior view
- [ ] Show linked COM-B analyses when viewing a Behavior
- [ ] Update types to support behavior_id reference

### Week 4: Testing and Documentation
- [ ] End-to-end testing
- [ ] Update framework descriptions
- [ ] Create user documentation explaining difference
- [ ] Data migration (if needed)

---

## Benefits of Proper Separation

✅ **Conceptual Clarity:** Behavior analysis is objective, COM-B is audience-specific

✅ **Reusability:** One behavior analysis → Multiple COM-B analyses for different audiences

✅ **Accuracy:** Can't accidentally assess "barriers" without knowing who faces them

✅ **Methodology Compliance:** Follows Michie et al. (2011) BCW methodology correctly

✅ **Flexibility:** Can analyze same behavior for multiple target audiences (youth, elderly, etc.)

---

## Example Workflow

**Behavior Analysis:**
- Title: "Solar Panel Installation in Rural Texas"
- Timeline: Installation process, maintenance
- Environmental Factors: High sunlight, grid infrastructure, local policies
- Barriers: Upfront cost, technical complexity
- Target Audiences: Homeowners, Businesses, Schools

**COM-B Analysis #1:**
- Linked Behavior: "Solar Panel Installation in Rural Texas"
- Target Audience: "Rural Homeowners (age 50+)"
- Physical Capability: DEFICIT (lack technical skills)
- Psychological Capability: DEFICIT (don't understand ROI)
- Physical Opportunity: MAJOR BARRIER (high upfront cost)
- Social Opportunity: ADEQUATE (neighbors supportive)
- Reflective Motivation: ADEQUATE (want independence)
- Automatic Motivation: DEFICIT (habit of utility payments)
- **BCW Recommendations:** Training, Education, Fiscal Measures, Enablement

**COM-B Analysis #2:**
- Linked Behavior: "Solar Panel Installation in Rural Texas"
- Target Audience: "Local Businesses"
- Physical Capability: ADEQUATE (can hire installers)
- Psychological Capability: ADEQUATE (understand finances)
- Physical Opportunity: DEFICIT (cash flow constraints)
- Social Opportunity: ADEQUATE (seen as progressive)
- Reflective Motivation: MAJOR BARRIER (focus on quarterly profits)
- Automatic Motivation: ADEQUATE (motivated by cost savings)
- **BCW Recommendations:** Incentivisation, Fiscal Measures, Persuasion

Same behavior, different audiences, different deficits, different interventions!

---

## References

- Michie, S., van Stralen, M. M., & West, R. (2011). The behaviour change wheel: A new method for characterising and designing behaviour change interventions. *Implementation Science, 6*(1), 42.
- U.S. Army Field Manual TM 3-53.11 (Behavior Analysis)
