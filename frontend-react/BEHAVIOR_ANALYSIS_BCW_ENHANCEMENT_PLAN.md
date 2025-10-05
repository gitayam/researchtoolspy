# Behavior Analysis Framework - Behaviour Change Wheel Enhancement Plan

## Executive Summary

This plan enhances the Behavior Analysis (COM-B Model) framework to implement the **complete Behaviour Change Wheel (BCW)** methodology, including automated intervention recommendations based on COM-B deficits identified during analysis.

**Current State:** Framework has COM-B assessment sections (6 components)
**Target State:** Full BCW implementation with intervention recommendations, decision trees, and enhanced exports

---

## 1. The Behaviour Change Wheel - Complete Framework

### Three-Layer Structure

#### Layer 1: COM-B System (Inner Hub) ✅ **IMPLEMENTED**
Six components of behavior sources:

| Component | Code | Description | Current Implementation |
|-----------|------|-------------|----------------------|
| Physical Capability | C-Ph | Physical skills, strength, stamina | ✅ Section 3 |
| Psychological Capability | C-Ps | Knowledge, cognitive skills, comprehension | ✅ Section 4 |
| Physical Opportunity | O-Ph | Environmental factors, time, resources, infrastructure | ✅ Section 5 |
| Social Opportunity | O-So | Cultural norms, social cues, peer influence | ✅ Section 6 |
| Reflective Motivation | M-Re | Beliefs, intentions, goals, identity | ✅ Section 7 |
| Automatic Motivation | M-Au | Emotions, impulses, habits, desires | ✅ Section 8 |

#### Layer 2: Intervention Functions (Middle Ring) ❌ **NOT IMPLEMENTED**
Nine intervention types mapped to COM-B deficits:

| Function | Definition | Personal vs External |
|----------|------------|---------------------|
| **Education** | Increasing knowledge or understanding | Personal agency |
| **Persuasion** | Using communication to induce feelings or stimulate action | Personal agency |
| **Incentivisation** | Creating expectation of reward | Personal agency |
| **Training** | Imparting skills | Personal agency |
| **Enablement** | Increasing means/reducing barriers | Personal agency |
| **Coercion** | Creating expectation of punishment or cost | External influence |
| **Restriction** | Using rules to reduce opportunity | External influence |
| **Environmental Restructuring** | Changing physical or social context | External influence |
| **Modelling** | Providing example to aspire to or imitate | External influence |

#### Layer 3: Policy Categories (Outer Ring) ❌ **NOT IMPLEMENTED**
Seven policy types to implement interventions:

| Policy Category | Description | Examples |
|----------------|-------------|----------|
| **Communication/Marketing** | Mass media campaigns, social marketing | Public health campaigns, advertising |
| **Guidelines** | Creating recommendations, standards | Clinical guidelines, best practices |
| **Fiscal Measures** | Using taxes, subsidies, incentives | Sugar tax, solar panel subsidies |
| **Regulation** | Setting rules for products, services | Food labeling, safety standards |
| **Legislation** | Making laws, statutes | Smoking bans, seatbelt laws |
| **Environmental/Social Planning** | Designing built environment, social context | Urban planning, workplace design |
| **Service Provision** | Delivering services, programs | Healthcare, education programs |

---

## 2. COM-B to Intervention Function Mapping

Based on Michie et al. (2011) Implementation Science paper:

```
┌─────────────────────────────────────────────────────────────────────┐
│ COM-B Component → Applicable Intervention Functions                │
├─────────────────────────────────────────────────────────────────────┤
│ Physical Capability (C-Ph)                                          │
│   ├─ Training                                                       │
│   └─ Enablement                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Psychological Capability (C-Ps)                                     │
│   ├─ Education                                                      │
│   ├─ Training                                                       │
│   └─ Enablement                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Reflective Motivation (M-Re)                                        │
│   ├─ Education                                                      │
│   ├─ Persuasion                                                     │
│   ├─ Incentivisation                                                │
│   └─ Coercion                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ Automatic Motivation (M-Au)                                         │
│   ├─ Persuasion                                                     │
│   ├─ Incentivisation                                                │
│   ├─ Coercion                                                       │
│   ├─ Environmental Restructuring                                    │
│   ├─ Modelling                                                      │
│   └─ Enablement                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Physical Opportunity (O-Ph)                                         │
│   ├─ Restriction                                                    │
│   ├─ Environmental Restructuring                                    │
│   └─ Enablement                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Social Opportunity (O-So)                                           │
│   ├─ Restriction                                                    │
│   ├─ Environmental Restructuring                                    │
│   └─ Enablement                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Decision Tree Logic (Per User's Images)

### Capability Decision Tree
```
Start: Is target audience CAPABLE of performing behavior?
  ├─ YES → Identify enablers of capability → Continue to Opportunity
  └─ NO → What type of CAPABILITY limitation?
      ├─ Physical
      │   └─ Can physical capability be improved?
      │       ├─ YES → Recommend: Training, Enablement
      │       └─ NO → TA/Behavior Mismatch (reconsider target audience)
      └─ Psychological/Cognitive/Interpersonal
          └─ Can psychological capability be improved?
              ├─ YES → Recommend: Education, Training, Enablement
              └─ NO → TA/Behavior Mismatch (reconsider target audience)
```

### Opportunity Decision Tree
```
Start: Does OPPORTUNITY for behavior exist in area of operations (AO)?
  ├─ YES → Are there opportunity limitations?
  │   ├─ NO → Identify opportunities for action in AO → Continue to Motivation
  │   └─ YES → What type of OPPORTUNITY limitation?
  │       ├─ Physical
  │       │   └─ Can physical opportunity be changed?
  │       │       ├─ YES → Recommend: Restriction, Environmental Restructuring, Enablement
  │       │       └─ NO → TA/Behavior Mismatch (reconsider AO)
  │       └─ Social
  │           └─ Can social opportunity be changed?
  │               ├─ YES → Recommend: Restriction, Environmental Restructuring, Enablement
  │               └─ NO → TA/Behavior Mismatch (reconsider AO)
  └─ NO → Research AO restrictions, environmental factors
      └─ Can opportunity be created?
          ├─ YES → Recommend: Environmental Restructuring, Enablement
          └─ NO → TA/Behavior Mismatch (reconsider AO)
```

### Motivation Decision Tree
```
Start: Is target audience MOTIVATED to perform behavior?
  ├─ YES → Begin full target audience analysis for refined TA
  └─ NO → Would TA perform action if aware of benefits?
      ├─ YES → Can awareness be improved?
      │   ├─ YES → Recommend: Education, Persuasion
      │   └─ NO → Research TA root needs hierarchy
      └─ NO → What type of MOTIVATION limitation?
          ├─ Automatic (Habits, Emotions, Values, Traditions)
          │   └─ Can automatic motivation be overcome?
          │       ├─ YES → Recommend: Persuasion, Incentivisation, Coercion,
          │       │        Environmental Restructuring, Modelling, Enablement
          │       └─ NO → Possible TA/SPO Mismatch
          └─ Reflective (Identity, Beliefs, Worldview, Goals, Intentions)
              └─ Can reflective motivation be changed?
                  ├─ YES → Recommend: Education, Persuasion, Incentivisation, Coercion
                  └─ NO → Research TA root needs hierarchy
```

---

## 4. Integration with Maslow's Hierarchy (Per User's Image 7)

**Key Insight:** Target audience self-interest impacts motivation through needs hierarchy:

```
Overcoming Lack of Motivation with Self-Interest

Maslow's Hierarchy          COM-B System
─────────────────          ─────────────
Self-Actualization ─┐
                    ├──→ TA's Self-Interest ──→ MOTIVATION ──→ BEHAVIOR
Esteem             ─┤                               ↕
Love/Belonging     ─┤                          CAPABILITY
Safety             ─┤                               ↕
Physiological      ─┘                          OPPORTUNITY
```

**Recommendation Logic:**
- If automatic motivation is lacking, assess which need level is unmet
- Lower-level needs (physiological, safety) require stronger external interventions (coercion, restriction)
- Higher-level needs (esteem, self-actualization) respond better to personal agency interventions (education, persuasion)

---

## 5. Enhancement Plan - Phased Implementation

### Phase 1: COM-B Deficit Assessment Logic ⭐ **HIGH PRIORITY**

**Goal:** Automatically identify which COM-B components have deficits based on user input

**Implementation:**
1. Add "Deficit Assessment" toggle to each COM-B section
   - User marks: ✅ Adequate | ⚠️ Deficit | ❌ Major Barrier
2. Create assessment scoring system:
   - Count barriers/facilitators ratio
   - Flag sections with more barriers than facilitators
3. Store deficit flags in framework data structure

**New Field in Framework Data:**
```typescript
interface BehaviorAnalysisData {
  // ... existing fields
  com_b_deficits: {
    physical_capability: 'adequate' | 'deficit' | 'major_barrier'
    psychological_capability: 'adequate' | 'deficit' | 'major_barrier'
    physical_opportunity: 'adequate' | 'deficit' | 'major_barrier'
    social_opportunity: 'adequate' | 'deficit' | 'major_barrier'
    reflective_motivation: 'adequate' | 'deficit' | 'major_barrier'
    automatic_motivation: 'adequate' | 'deficit' | 'major_barrier'
  }
}
```

### Phase 2: Intervention Recommendation Engine ⭐ **HIGH PRIORITY**

**Goal:** Generate intervention recommendations based on COM-B deficits

**New Section:** "Recommended Interventions" (appears AFTER all COM-B sections)

**Recommendation Algorithm:**
```typescript
function generateInterventionRecommendations(deficits: ComBDeficits): InterventionRecommendation[] {
  const recommendations: InterventionRecommendation[] = []

  // Map deficits to intervention functions
  if (deficits.physical_capability !== 'adequate') {
    recommendations.push({
      component: 'Physical Capability',
      severity: deficits.physical_capability,
      interventions: [
        { name: 'Training', priority: 'high', description: 'Impart physical skills through practice and repetition' },
        { name: 'Enablement', priority: 'medium', description: 'Provide tools/resources to increase physical capability' }
      ]
    })
  }

  if (deficits.psychological_capability !== 'adequate') {
    recommendations.push({
      component: 'Psychological Capability',
      severity: deficits.psychological_capability,
      interventions: [
        { name: 'Education', priority: 'high', description: 'Increase knowledge and understanding' },
        { name: 'Training', priority: 'high', description: 'Impart cognitive skills and decision-making abilities' },
        { name: 'Enablement', priority: 'low', description: 'Provide cognitive aids or decision support tools' }
      ]
    })
  }

  // ... continue for all 6 COM-B components

  return recommendations
}
```

**UI Component:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>🎯 Recommended Interventions (Behaviour Change Wheel)</CardTitle>
    <CardDescription>
      Based on identified COM-B deficits, these evidence-based interventions are recommended
    </CardDescription>
  </CardHeader>
  <CardContent>
    {recommendations.map(rec => (
      <div className="mb-6">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          {rec.severity === 'major_barrier' ? '🔴' : '🟡'} {rec.component}
        </h3>
        <p className="text-sm text-gray-600 mb-3">Severity: {rec.severity}</p>
        <div className="space-y-2">
          {rec.interventions.map(intervention => (
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="font-medium">{intervention.name}</div>
              <div className="text-sm text-gray-600">{intervention.description}</div>
              <Badge variant={intervention.priority === 'high' ? 'default' : 'secondary'}>
                {intervention.priority} priority
              </Badge>
            </div>
          ))}
        </div>
      </div>
    ))}
  </CardContent>
</Card>
```

### Phase 3: Policy Category Recommendations 🟨 **MEDIUM PRIORITY**

**Goal:** Suggest policy mechanisms to implement interventions

**Implementation:**
1. For each recommended intervention function, suggest applicable policy categories
2. Use APEASE criteria (Affordability, Practicability, Effectiveness, Acceptability, Side-effects, Equity)

**Example Output:**
```
Intervention: Environmental Restructuring
  └─ Policy Categories:
      ├─ Environmental/Social Planning (High suitability)
      │   └─ Redesign physical spaces to make behavior easier
      ├─ Service Provision (Medium suitability)
      │   └─ Provide infrastructure or services that enable behavior
      └─ Regulation (Low suitability)
          └─ Mandate changes to product design or service delivery
```

### Phase 4: Enhanced Report Exports ⭐ **HIGH PRIORITY**

**Goal:** Create comprehensive reports with visual BCW diagrams and recommendations

**Export Enhancements:**

#### PDF Export
1. **COM-B Assessment Summary Page**
   - Visual wheel diagram showing deficit areas in red
   - Summary table of deficits

2. **Intervention Recommendations Page**
   - Priority matrix (high/medium/low)
   - Timeline for implementation
   - Resource requirements

3. **Policy Implementation Guide**
   - Suggested policy categories for each intervention
   - APEASE criteria assessment table

#### Word Export
1. Executive Summary with key findings
2. Detailed COM-B analysis by component
3. Intervention recommendations with evidence base
4. Implementation roadmap

#### PowerPoint Export
1. Slide 1: Analysis Overview
2. Slide 2: COM-B Wheel (visual)
3. Slide 3-8: Each COM-B component with findings
4. Slide 9: Recommended Interventions
5. Slide 10: Policy Categories
6. Slide 11: Implementation Roadmap

### Phase 5: Decision Tree Guided Workflow 🟨 **MEDIUM PRIORITY**

**Goal:** Interactive decision trees guide analysts through BCW methodology

**Implementation:**
1. Add "Guided Analysis" mode toggle
2. Present decision trees from user's images as step-by-step wizard
3. Automatically populate COM-B sections based on decision tree answers
4. Generate recommendations in real-time as user progresses

---

## 6. Technical Implementation Details

### New Types/Interfaces

```typescript
// src/types/behavior-change-wheel.ts

export type ComBComponent =
  | 'physical_capability'
  | 'psychological_capability'
  | 'physical_opportunity'
  | 'social_opportunity'
  | 'reflective_motivation'
  | 'automatic_motivation'

export type DeficitLevel = 'adequate' | 'deficit' | 'major_barrier'

export type InterventionFunction =
  | 'education'
  | 'persuasion'
  | 'incentivisation'
  | 'coercion'
  | 'training'
  | 'restriction'
  | 'environmental_restructuring'
  | 'modelling'
  | 'enablement'

export type PolicyCategory =
  | 'communication_marketing'
  | 'guidelines'
  | 'fiscal_measures'
  | 'regulation'
  | 'legislation'
  | 'environmental_social_planning'
  | 'service_provision'

export interface ComBDeficits {
  physical_capability: DeficitLevel
  psychological_capability: DeficitLevel
  physical_opportunity: DeficitLevel
  social_opportunity: DeficitLevel
  reflective_motivation: DeficitLevel
  automatic_motivation: DeficitLevel
}

export interface InterventionDetail {
  name: InterventionFunction
  priority: 'high' | 'medium' | 'low'
  description: string
  evidence_base: string
  implementation_considerations: string[]
  applicable_policies: PolicyCategory[]
}

export interface InterventionRecommendation {
  component: string // Human-readable component name
  com_b_code: ComBComponent
  severity: DeficitLevel
  interventions: InterventionDetail[]
}

export interface PolicyRecommendation {
  policy: PolicyCategory
  description: string
  suitable_for_interventions: InterventionFunction[]
  apease_assessment: {
    affordability: 'high' | 'medium' | 'low'
    practicability: 'high' | 'medium' | 'low'
    effectiveness: 'high' | 'medium' | 'low'
    acceptability: 'high' | 'medium' | 'low'
    side_effects: 'low' | 'medium' | 'high' // Lower is better
    equity: 'high' | 'medium' | 'low'
  }
}
```

### New Utility Functions

```typescript
// src/utils/behaviour-change-wheel.ts

import type {
  ComBDeficits,
  ComBComponent,
  InterventionFunction,
  InterventionRecommendation,
  PolicyRecommendation
} from '@/types/behavior-change-wheel'

// Mapping from COM-B components to intervention functions
export const COM_B_INTERVENTION_MAP: Record<ComBComponent, InterventionFunction[]> = {
  physical_capability: ['training', 'enablement'],
  psychological_capability: ['education', 'training', 'enablement'],
  reflective_motivation: ['education', 'persuasion', 'incentivisation', 'coercion'],
  automatic_motivation: ['persuasion', 'incentivisation', 'coercion', 'environmental_restructuring', 'modelling', 'enablement'],
  physical_opportunity: ['restriction', 'environmental_restructuring', 'enablement'],
  social_opportunity: ['restriction', 'environmental_restructuring', 'enablement']
}

// Intervention function descriptions
export const INTERVENTION_DESCRIPTIONS: Record<InterventionFunction, {
  name: string
  definition: string
  examples: string[]
}> = {
  education: {
    name: 'Education',
    definition: 'Increasing knowledge or understanding',
    examples: ['Public health campaigns', 'Informational websites', 'Training materials']
  },
  persuasion: {
    name: 'Persuasion',
    definition: 'Using communication to induce positive/negative feelings or stimulate action',
    examples: ['Motivational interviewing', 'Peer testimonials', 'Imagery-based messaging']
  },
  // ... (continue for all 9 functions)
}

// Generate recommendations based on deficits
export function generateInterventionRecommendations(
  deficits: ComBDeficits
): InterventionRecommendation[] {
  const recommendations: InterventionRecommendation[] = []

  Object.entries(deficits).forEach(([component, severity]) => {
    if (severity !== 'adequate') {
      const interventions = COM_B_INTERVENTION_MAP[component as ComBComponent].map(func => ({
        name: func,
        priority: determinePriority(component as ComBComponent, func, severity),
        description: INTERVENTION_DESCRIPTIONS[func].definition,
        evidence_base: getEvidenceBase(func),
        implementation_considerations: getImplementationConsiderations(func),
        applicable_policies: getApplicablePolicies(func)
      }))

      recommendations.push({
        component: formatComponentName(component as ComBComponent),
        com_b_code: component as ComBComponent,
        severity,
        interventions
      })
    }
  })

  return recommendations
}

// Determine intervention priority based on component, function, and severity
function determinePriority(
  component: ComBComponent,
  intervention: InterventionFunction,
  severity: DeficitLevel
): 'high' | 'medium' | 'low' {
  // Major barriers require high priority interventions
  if (severity === 'major_barrier') {
    // Training and education are high priority for capability deficits
    if (component.includes('capability') && ['training', 'education'].includes(intervention)) {
      return 'high'
    }
    // Environmental restructuring is high priority for opportunity deficits
    if (component.includes('opportunity') && intervention === 'environmental_restructuring') {
      return 'high'
    }
  }

  // Standard priority rules
  const PRIMARY_INTERVENTIONS: Record<ComBComponent, InterventionFunction[]> = {
    physical_capability: ['training'],
    psychological_capability: ['education', 'training'],
    physical_opportunity: ['environmental_restructuring'],
    social_opportunity: ['environmental_restructuring'],
    reflective_motivation: ['education', 'persuasion'],
    automatic_motivation: ['environmental_restructuring', 'modelling']
  }

  if (PRIMARY_INTERVENTIONS[component].includes(intervention)) {
    return severity === 'major_barrier' ? 'high' : 'medium'
  }

  return 'low'
}
```

### New Components

```typescript
// src/components/frameworks/BCWRecommendations.tsx

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InterventionRecommendation } from '@/types/behavior-change-wheel'

interface BCWRecommendationsProps {
  recommendations: InterventionRecommendation[]
}

export function BCWRecommendations({ recommendations }: BCWRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
            No Major Deficits Identified
          </h3>
          <p className="text-gray-500 dark:text-gray-500">
            All COM-B components are adequate. No specific interventions required.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎯 Recommended Interventions (Behaviour Change Wheel)
          </CardTitle>
          <CardDescription>
            Based on identified COM-B deficits, these evidence-based interventions are recommended
            according to the Behaviour Change Wheel methodology (Michie et al., 2011)
          </CardDescription>
        </CardHeader>
      </Card>

      {recommendations.map((rec, idx) => (
        <Card key={idx} className="border-l-4 border-l-blue-600">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {rec.severity === 'major_barrier' ? '🔴' : '🟡'}
                {rec.component}
              </CardTitle>
              <Badge variant={rec.severity === 'major_barrier' ? 'destructive' : 'default'}>
                {rec.severity === 'major_barrier' ? 'Major Barrier' : 'Deficit'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {rec.interventions.map((intervention, iIdx) => (
              <div key={iIdx} className="border-l-4 border-indigo-400 pl-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-r">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-lg">{intervention.name}</h4>
                  <Badge variant={
                    intervention.priority === 'high' ? 'default' :
                    intervention.priority === 'medium' ? 'secondary' :
                    'outline'
                  }>
                    {intervention.priority} priority
                  </Badge>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {intervention.description}
                </p>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Evidence:</strong> {intervention.evidence_base}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-green-600 dark:text-green-400">💡</div>
            <div className="text-sm text-green-900 dark:text-green-100">
              <p className="font-medium mb-1">Next Steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Review high-priority interventions first</li>
                <li>Consider APEASE criteria (Affordability, Practicability, Effectiveness, Acceptability, Side-effects, Equity)</li>
                <li>Select appropriate policy categories for implementation</li>
                <li>Develop specific intervention activities and timelines</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 7. Report Export Enhancements

### PDF Report Template

```
┌─────────────────────────────────────────────────────────────┐
│                  Behavior Analysis Report                   │
│              Behaviour Change Wheel Methodology             │
├─────────────────────────────────────────────────────────────┤
│ Title: [Analysis Title]                                     │
│ Date: [Date]                                               │
│ Analyst: [Name]                                            │
└─────────────────────────────────────────────────────────────┘

1. EXECUTIVE SUMMARY
   • Target Behavior: [Behavior]
   • COM-B Deficits Identified: [Count]
   • Priority Interventions: [List]

2. COM-B ASSESSMENT OVERVIEW

   [Visual: COM-B Wheel with deficits highlighted in red]

   Component Status Summary:
   ✅ Physical Capability: Adequate
   🟡 Psychological Capability: Deficit
   🔴 Physical Opportunity: Major Barrier
   ✅ Social Opportunity: Adequate
   🟡 Reflective Motivation: Deficit
   ✅ Automatic Motivation: Adequate

3. DETAILED COM-B ANALYSIS
   [For each component: findings, barriers, facilitators]

4. BEHAVIOR TIMELINE
   [Visual timeline with forks and sub-steps]

5. RECOMMENDED INTERVENTIONS (Behaviour Change Wheel)

   Based on Psychological Capability Deficit:
   ─────────────────────────────────────────────
   🔵 Education (High Priority)
      • Increase knowledge through training materials
      • Evidence: Effective for capability deficits (Michie et al., 2011)
      • Implementation: Develop curriculum, deliver workshops

   🔵 Training (High Priority)
      • Impart skills through hands-on practice
      • Evidence: Most effective for skill acquisition
      • Implementation: Practical exercises, coaching

   Based on Physical Opportunity Major Barrier:
   ─────────────────────────────────────────────
   🔴 Environmental Restructuring (High Priority)
      • Change physical context to enable behavior
      • Evidence: Essential when environment prevents behavior
      • Implementation: Modify facilities, provide resources

6. POLICY RECOMMENDATIONS

   To implement Education & Training:
   • Service Provision: Develop training programs
   • Guidelines: Create educational standards

   To implement Environmental Restructuring:
   • Environmental/Social Planning: Redesign spaces
   • Fiscal Measures: Fund infrastructure changes

7. IMPLEMENTATION ROADMAP

   Phase 1 (0-3 months): High Priority Interventions
   Phase 2 (3-6 months): Medium Priority Interventions
   Phase 3 (6-12 months): Sustainability & Evaluation

8. REFERENCES
   • Michie, S., van Stralen, M. M., & West, R. (2011). The behaviour
     change wheel: A new method for characterising and designing
     behaviour change interventions. Implementation Science, 6(1), 42.
```

---

## 8. Implementation Timeline

### Sprint 1 (Week 1-2): Core BCW Logic
- [ ] Create BCW types and interfaces
- [ ] Implement COM_B_INTERVENTION_MAP
- [ ] Build generateInterventionRecommendations() function
- [ ] Add deficit assessment fields to framework config
- [ ] Unit tests for recommendation logic

### Sprint 2 (Week 3-4): UI Components
- [ ] Build BCWRecommendations component
- [ ] Add deficit assessment toggles to each COM-B section
- [ ] Create intervention priority badges
- [ ] Implement collapsible intervention details

### Sprint 3 (Week 5-6): Report Exports
- [ ] Enhance PDF export with BCW recommendations
- [ ] Update Word export template
- [ ] Improve PowerPoint export with visual wheel
- [ ] Add CSV export for intervention tracking

### Sprint 4 (Week 7-8): Advanced Features
- [ ] Implement policy category recommendations
- [ ] Add APEASE criteria assessment
- [ ] Build decision tree guided workflow (optional)
- [ ] Create BCW visual wheel component

### Sprint 5 (Week 9-10): Testing & Refinement
- [ ] End-to-end testing with sample analyses
- [ ] User acceptance testing
- [ ] Documentation and training materials
- [ ] Deploy to production

---

## 9. Success Metrics

1. **Completeness:** All 9 intervention functions mapped to COM-B deficits
2. **Usability:** Analysts can generate intervention recommendations in <2 minutes
3. **Quality:** Recommendations align with published BCW methodology
4. **Adoption:** 80% of behavior analyses use intervention recommendation feature
5. **Export Quality:** Reports include visual BCW diagrams and actionable recommendations

---

## 10. References

1. Michie, S., van Stralen, M. M., & West, R. (2011). The behaviour change wheel: A new method for characterising and designing behaviour change interventions. *Implementation Science*, 6(1), 42. https://doi.org/10.1186/1748-5908-6-42

2. Michie, S., Atkins, L., & West, R. (2014). *The Behaviour Change Wheel: A Guide to Designing Interventions*. Silverback Publishing.

3. Cane, J., O'Connor, D., & Michie, S. (2012). Validation of the theoretical domains framework for use in behaviour change and implementation research. *Implementation Science*, 7(1), 37.

4. Maslow, A. H. (1970). *Motivation and Personality* (2nd ed.). Harper & Row.

---

## Appendix A: Quick Reference - COM-B to Interventions

| COM-B Deficit | Primary Interventions | Secondary Interventions |
|--------------|----------------------|------------------------|
| **C-Ph** | Training | Enablement |
| **C-Ps** | Education, Training | Enablement |
| **M-Re** | Education, Persuasion | Incentivisation, Coercion |
| **M-Au** | Environmental Restructuring, Modelling | Persuasion, Incentivisation, Coercion, Enablement |
| **O-Ph** | Environmental Restructuring | Restriction, Enablement |
| **O-So** | Environmental Restructuring | Restriction, Enablement |

## Appendix B: The 9 Intervention Functions Explained

**Personal Agency (5):**
1. **Education** - Impart knowledge (lectures, leaflets, tutorials)
2. **Persuasion** - Stimulate feelings/action (imagery, emotional appeals)
3. **Incentivisation** - Create reward expectations (points, prizes, payments)
4. **Training** - Impart skills (practice, coaching, apprenticeship)
5. **Enablement** - Reduce barriers (tools, resources, behavioral support)

**External Influence (4):**
6. **Coercion** - Create punishment expectations (fines, sanctions, penalties)
7. **Restriction** - Use rules to limit behavior (quotas, prohibitions, bans)
8. **Environmental Restructuring** - Change context (redesign spaces, alter defaults)
9. **Modelling** - Provide examples to imitate (demonstrations, testimonials, role models)
