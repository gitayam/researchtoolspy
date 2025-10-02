# Framework Corrections Roadmap

**Created:** October 2, 2025
**Status:** 🔴 In Progress
**Priority:** Critical

---

## 🎯 Executive Summary

**Problem**: Multiple analysis frameworks in the Cloudflare React implementation are incorrect or oversimplified compared to the main branch implementations. These need to be corrected to match established military doctrine and CIA analytical methodologies.

**Solution**: Update framework configurations to match main branch implementations based on:
- TM 3-53.11 (Behavior Analysis)
- CIA SATS methodology (Deception Detection)
- Proper COG and Causeway structures

---

## 📊 Comparison Analysis

### 1. Deception Detection Framework ❌ INCORRECT

**Current Implementation** (cloudflare branch):
```typescript
{
  type: 'deception',
  title: 'Deception Detection',
  sections: [
    { key: 'behavioral_indicators', label: 'Behavioral Indicators' },
    { key: 'verbal_indicators', label: 'Verbal Indicators' },
    { key: 'contextual_indicators', label: 'Contextual Indicators' },
    { key: 'physiological_indicators', label: 'Physiological Indicators' }
  ]
}
```

**Correct Implementation** (main branch - CIA SATS):
```python
MOM_QUESTIONS = {
    "motive": "What are the goals and motives of the potential deceiver?",
    "channels": "What means are available to feed information to us?",
    "risks": "What consequences would the adversary suffer if deception was revealed?",
    "costs": "Would they need to sacrifice sensitive information for credibility?",
    "feedback": "Do they have a way to monitor the impact of the deception?"
}
POP_QUESTIONS = {
    "history": "What is the history of deception by this actor or similar actors?",
    "patterns": "Are there patterns or signatures in their previous deception attempts?",
    "success": "How successful have their previous deception operations been?"
}
MOSES_QUESTIONS = {
    "control": "How much control does the potential deceiver have over our sources?",
    "access": "Do they have access to our collection methods?",
    "vulnerability": "How vulnerable are our sources to manipulation?"
}
EVE_QUESTIONS = {
    "consistency": "Is the information internally consistent?",
    "corroboration": "Is it confirmed by multiple independent sources?",
    "gaps": "Are there gaps or missing information in the evidence?"
}
```

**Issue**: Current implementation uses generic deception indicators instead of the established CIA SATS (Structured Analytic Techniques) framework consisting of MOM, POP, MOSES, and EVE.

**Action Required**: Replace with SATS framework sections

---

### 2. Behavior Analysis Framework ❌ INCORRECT

**Current Implementation** (cloudflare branch):
```typescript
{
  type: 'behavior',
  title: 'Behavioral Analysis',
  sections: [
    { key: 'normal_patterns', label: 'Normal Patterns' },
    { key: 'anomalies', label: 'Anomalies' },
    { key: 'triggers', label: 'Triggers' },
    { key: 'predictions', label: 'Predictions' }
  ]
}
```

**Correct Implementation** (TM 3-53.11 based):
Based on the user-provided template:
- Behavior Timeline (instances, where, when, duration)
- Supporting Behaviors Required (chronological steps)
- Obstacles and Challenges Encountered
- Associated Symbols and Signals
- Required Capabilities (Physical, Cognitive, Social, Economic)
- Social Norms and Pressures
- Motivations and Drivers
- Consequences and Outcomes
- Environmental and Situational Factors
- Strategies That Have Impacted the Behavior
- Target Audience Refinement (Primary, Secondary, Engaging Actors, Beneficiaries, etc.)

**Issue**: Current implementation uses generic pattern analysis instead of the structured TM 3-53.11 Influence Process Activity template for behavior breakdown and analysis.

**Action Required**: Complete redesign to match TM 3-53.11 template

---

### 3. Center of Gravity (COG) ✅ VERIFY

**Current Implementation**:
```typescript
{
  type: 'cog',
  title: 'Center of Gravity Analysis',
  sections: [
    { key: 'center_of_gravity', label: 'Center of Gravity' },
    { key: 'critical_capabilities', label: 'Critical Capabilities' },
    { key: 'critical_requirements', label: 'Critical Requirements' },
    { key: 'critical_vulnerabilities', label: 'Critical Vulnerabilities' }
  ]
}
```

**Main Branch Implementation**: Similar structure with COG → CC → CR → CV hierarchy

**Status**: ✅ Appears correct but needs verification against main branch to ensure field structure matches

**Action Required**: Verify against main branch cog.py implementation

---

### 4. Causeway ⚠️ NOT IMPLEMENTED

**Current Implementation**: Using generic FrameworkListPage placeholder

**Main Branch**: Full causeway.py implementation with threat analysis

**Issue**: Not implemented in cloudflare branch

**Action Required**: Implement from main branch

---

## 🗺️ Implementation Plan

### Phase 1: Deception Detection (SATS) - HIGH PRIORITY ⚡

**Steps**:
1. Update framework-configs.ts with MOM/POP/MOSES/EVE sections
2. Create detailed question sets for each SATS component
3. Update form components to handle Q&A structure
4. Add scenario/context section
5. Add summary/assessment section

**Estimated Effort**: 4-6 hours

**Structure**:
```typescript
{
  type: 'deception',
  title: 'Deception Detection (SATS)',
  description: 'Structured Analytic Techniques for detecting deception based on CIA methodology',
  sections: [
    {
      key: 'scenario',
      label: 'Scenario',
      description: 'Describe the information or situation being analyzed',
      // ... fields
    },
    {
      key: 'mom',
      label: 'MOM (Motive, Opportunity, Means)',
      description: 'Assess whether the adversary has motive, opportunity, and means to deceive',
      questions: [...MOM_QUESTIONS]
    },
    {
      key: 'pop',
      label: 'POP (Patterns of Practice)',
      description: 'Examine historical deception patterns',
      questions: [...POP_QUESTIONS]
    },
    {
      key: 'moses',
      label: 'MOSES (My Own Sources)',
      description: 'Evaluate vulnerability of your sources',
      questions: [...MOSES_QUESTIONS]
    },
    {
      key: 'eve',
      label: 'EVE (Evaluation of Evidence)',
      description: 'Assess evidence consistency and corroboration',
      questions: [...EVE_QUESTIONS]
    }
  ]
}
```

---

### Phase 2: Behavior Analysis (TM 3-53.11) - HIGH PRIORITY ⚡

**Steps**:
1. Create comprehensive section structure based on TM 3-53.11
2. Implement timeline analysis components
3. Add supporting behaviors workflow
4. Build target audience refinement section
5. Implement COM-B analysis integration

**Estimated Effort**: 6-8 hours

**Structure**:
```typescript
{
  type: 'behavior',
  title: 'Action or Behavior Analysis',
  description: 'Based on TM 3-53.11 Influence Process Activity: Target Audience Analysis',
  sections: [
    {
      key: 'basic_info',
      label: 'Basic Information',
      fields: ['objective_effect', 'action_behavior', 'location']
    },
    {
      key: 'timeline',
      label: 'Behavior Timeline',
      fields: ['instances', 'where_occurred', 'when_occurred', 'duration']
    },
    {
      key: 'supporting_behaviors',
      label: 'Supporting Behaviors Required',
      description: 'Chronological steps needed to execute main behavior',
      type: 'ordered_list'
    },
    {
      key: 'obstacles',
      label: 'Obstacles and Challenges',
      fields: ['physical_barriers', 'legal_restrictions', 'social_opposition', 'resource_limitations']
    },
    {
      key: 'symbols',
      label: 'Associated Symbols and Signals',
      description: 'Cultural symbols, gestures, codes used',
      type: 'list'
    },
    {
      key: 'capabilities',
      label: 'Required Capabilities',
      fields: ['physical', 'cognitive', 'social', 'economic']
    },
    {
      key: 'social_norms',
      label: 'Social Norms and Pressures',
      fields: ['cultural_expectations', 'peer_pressure', 'traditional_practices']
    },
    {
      key: 'motivations',
      label: 'Motivations and Drivers',
      type: 'textarea'
    },
    {
      key: 'consequences',
      label: 'Consequences and Outcomes',
      fields: ['positive_outcomes', 'negative_repercussions']
    },
    {
      key: 'environmental_factors',
      label: 'Environmental and Situational Factors',
      fields: ['political_climate', 'economic_conditions', 'technological_availability']
    },
    {
      key: 'strategies',
      label: 'Strategies That Have Impacted Behavior',
      description: 'Document successful and unsuccessful influence strategies',
      type: 'list'
    },
    {
      key: 'target_audiences',
      label: 'Target Audience Refinement',
      fields: [
        'primary_audiences',
        'secondary_audiences',
        'engaging_actors',
        'beneficiaries',
        'harmed_parties',
        'influencers',
        'enablers',
        'opposers'
      ]
    }
  ]
}
```

---

### Phase 3: COG Verification - ✅ COMPLETE

**Review Results**:
- ✅ COG structure matches main branch cog.py
- ✅ Hierarchy correct: COG → CC → CR → CV
- ✅ Sections properly defined:
  - Center of Gravity (source of power)
  - Critical Capabilities (primary abilities)
  - Critical Requirements (essential conditions/resources)
  - Critical Vulnerabilities (weaknesses to exploit)

**Status**: No changes needed - COG framework is correctly implemented

---

### Phase 4: Causeway Implementation - FUTURE WORK

**Current State**: Using FrameworkListPage placeholder

**Main Branch Features**:
- Threat identification and scenario development
- Issue and location-based analysis
- AI-generated threat suggestions
- Manual threat selection
- Threat categorization and analysis

**Recommendation**: Causeway is a complex framework requiring significant custom logic beyond simple section-based forms. Suggest implementing as separate project phase after core frameworks are stable.

**Estimated Effort**: 12-15 hours (full implementation)
**Priority**: LOW - Can remain as placeholder for now

---

## ⚠️ What to Remove/Modify and Why

### Remove:
1. **Deception Detection - ALL current sections** ❌
   - `behavioral_indicators`
   - `verbal_indicators`
   - `contextual_indicators`
   - `physiological_indicators`

   **Why**: These are generic psychology-based deception indicators, not the CIA SATS methodology. SATS is a structured approach specifically designed for intelligence analysis to determine when to look for deception, whether deception is present, and how to avoid being deceived.

2. **Behavior Analysis - ALL current sections** ❌
   - `normal_patterns`
   - `anomalies`
   - `triggers`
   - `predictions`

   **Why**: These represent basic behavioral pattern analysis, not the comprehensive TM 3-53.11 behavior breakdown template. The TM 3-53.11 template is designed for military information operations to analyze specific behaviors in specific areas, identify supporting behaviors, capabilities required, obstacles, and target audiences. It's about understanding HOW a behavior is executed step-by-step, not just identifying patterns.

### Modify:
1. **COG - Potentially adjust field structures**
   - Keep overall structure (COG → CC → CR → CV)
   - May need to adjust question prompts or add fields

   **Why**: Structure appears correct but field details may not match main branch implementation

### Add:
1. **Deception Detection - SATS Components**
   - Scenario section
   - MOM (Motive, Opportunity, Means) - 5 questions
   - POP (Patterns of Practice) - 3 questions
   - MOSES (My Own Sources) - 3 questions
   - EVE (Evaluation of Evidence) - 3 questions
   - Summary/Assessment section

   **Why**: CIA SATS is the established intelligence community methodology for deception detection

2. **Behavior Analysis - TM 3-53.11 Structure**
   - Complete template as specified above (12 major sections)

   **Why**: TM 3-53.11 is current US Army doctrine for target audience analysis and behavior breakdown

---

## 📋 Implementation Checklist

### Deception Detection (SATS)
- [ ] Create SATS section definitions in framework-configs.ts
- [ ] Implement question-based form components
- [ ] Add scenario input section
- [ ] Build MOM section with 5 questions
- [ ] Build POP section with 3 questions
- [ ] Build MOSES section with 3 questions
- [ ] Build EVE section with 3 questions
- [ ] Add summary/assessment generation
- [ ] Test with sample scenarios
- [ ] Deploy and verify

### Behavior Analysis (TM 3-53.11)
- [ ] Create comprehensive section structure
- [ ] Implement basic info section
- [ ] Build timeline analysis component
- [ ] Create supporting behaviors ordered list
- [ ] Add obstacles section
- [ ] Implement symbols/signals list
- [ ] Build capabilities assessment (4 types)
- [ ] Add social norms section
- [ ] Create motivations analysis
- [ ] Add consequences section
- [ ] Implement environmental factors
- [ ] Build strategies impact tracker
- [ ] Create target audience refinement (8 categories)
- [ ] Test complete workflow
- [ ] Deploy and verify

### COG Verification
- [ ] Read main branch cog.py in detail
- [ ] Compare field structures
- [ ] Verify CR → CC → COG logic
- [ ] Test with main branch examples
- [ ] Make necessary adjustments
- [ ] Deploy if changes needed

### Causeway (Future)
- [ ] Design TypeScript port architecture
- [ ] Implement threat analysis
- [ ] Add environmental factors
- [ ] Create visualization
- [ ] Test and deploy

---

## 🎯 Success Criteria

1. **Deception Detection** matches CIA SATS methodology exactly
2. **Behavior Analysis** follows TM 3-53.11 template structure
3. **COG** verified against main branch implementation
4. All frameworks build without TypeScript errors
5. All frameworks deploy successfully
6. User can create, view, edit, and delete analyses
7. Data persists correctly in D1 database

---

## 📈 Timeline

- **Phase 1 (Deception Detection)**: 1 day
- **Phase 2 (Behavior Analysis)**: 1-2 days
- **Phase 3 (COG Verification)**: 0.5 days
- **Phase 4 (Causeway)**: 2 days (future work)

**Total Estimated Time**: 3-4 days for Phases 1-3

---

**Last Updated**: October 2, 2025
**Next Review**: After Phase 1 completion
