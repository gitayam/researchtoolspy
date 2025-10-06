# COG and Causeway Framework Review

**Date:** October 2, 2025
**Branch:** cloudflare/react-nextjs-to-vite
**Reviewer:** Claude Code
**Status:** ✅ COG Correct | ⚠️ Causeway Incomplete

---

## Executive Summary

**COG Framework:** ✅ **CORRECT** - Current implementation matches military doctrine (JP 5-0)

**Causeway Framework:** ⚠️ **INCOMPLETE** - Placeholder only, needs full implementation based on main branch

---

## 🎯 Center of Gravity (COG) Analysis - CORRECT ✅

### Current Implementation (frontend-react)

**Location:** `src/config/framework-configs.ts` (lines 274-312)

**Structure:**
```typescript
'cog': {
  type: 'cog',
  title: 'Center of Gravity Analysis',
  description: 'Critical capabilities, requirements, and vulnerabilities',
  sections: [
    {
      key: 'center_of_gravity',
      label: 'Center of Gravity',
      description: 'Source of power that provides strength',
      icon: '🎯'
    },
    {
      key: 'critical_capabilities',
      label: 'Critical Capabilities',
      description: 'Primary abilities of the center of gravity',
      icon: '⚡'
    },
    {
      key: 'critical_requirements',
      label: 'Critical Requirements',
      description: 'Essential conditions and resources needed',
      icon: '📋'
    },
    {
      key: 'critical_vulnerabilities',
      label: 'Critical Vulnerabilities',
      description: 'Weaknesses that can be exploited',
      icon: '⚠️'
    }
  ]
}
```

### Doctrine Alignment

**This is the correct COG hierarchy from JP 5-0 (Joint Planning):**

1. **Center of Gravity (CoG)** - The source of power that provides moral or physical strength, freedom of action, or will to act

2. **Critical Capabilities (CC)** - The primary abilities which are essential to the accomplishment of the CoG's specified or assumed objective(s)

3. **Critical Requirements (CR)** - The essential conditions, resources, and means for a critical capability to be fully operational

4. **Critical Vulnerabilities (CV)** - Aspects of critical requirements that are deficient, vulnerable to neutralization, or seizure

### Verdict: ✅ NO CHANGES NEEDED

The COG framework implementation is doctrinally sound and matches standard military Center of Gravity analysis methodology.

---

## 🌊 Causeway Framework - INCOMPLETE ⚠️

### Current Implementation (frontend-react)

**Location:** `src/pages/frameworks/index.tsx` (lines 660-666)

```typescript
export const CausewayPage = () => (
  <FrameworkListPage
    title="Causeway Analysis"
    description="Causeway Terrain Analysis"  // ❌ INCORRECT DESCRIPTION
    frameworkType="causeway"
  />
)
```

**Status:** Placeholder only - No actual framework configuration exists in `framework-configs.ts`

**Issue:** The description "Causeway Terrain Analysis" is incorrect. Causeway is NOT about terrain analysis.

### Main Branch Implementation (Python)

**Location:** `frameworks/causeway.py`

**What Causeway Actually Is:**

Causeway is a **strategic threat analysis and influence operations framework** that uses a hierarchical COG-like approach to analyze hostile actors, threats, and influence targets.

**Structure (from main branch):**

1. **Scenario Development**
   - Issue: The concern being analyzed (e.g., "environmental sustainability", "free speech")
   - Location: Geographic area of concern
   - Threat: Phenomenon threatening the issue (e.g., "water pollution", "disinformation")

2. **PUTAR Identification**
   - Problem: The threat phenomenon
   - Undesired Actor: Entity responsible for the threat
   - Target Audience: Who influences or is influenced
   - Remedy: Solution to the problem
   - Story: Narrative connecting these elements

3. **Critical Capabilities**
   - For each PUTAR, identify critical capabilities needed to execute the threat

4. **Critical Requirements**
   - For each critical capability, identify essential requirements

5. **Proximate Targets**
   - For each requirement, identify tangible targets that can be influenced/attacked

### Key Differences from COG

- **Purpose:** COG analyzes friendly/enemy power sources; Causeway maps influence pathways for hostile actors
- **Output:** COG identifies vulnerabilities; Causeway creates a graph of influence relationships
- **Application:** COG for military planning; Causeway for information operations and influence campaigns

### Recommended Implementation

```typescript
'causeway': {
  type: 'causeway',
  title: 'Causeway Analysis',
  description: 'Strategic threat and influence operations framework using PUTAR methodology',
  sections: [
    {
      key: 'scenario',
      label: 'Scenario Development',
      description: 'Define Issue, Location, and Threat being analyzed',
      color: 'border-gray-500',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      icon: '📋'
    },
    {
      key: 'putars',
      label: 'PUTAR Identification',
      description: 'Problem, Undesired Actor, Target Audience, Remedy, Story',
      color: 'border-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      icon: '🎯'
    },
    {
      key: 'critical_capabilities',
      label: 'Critical Capabilities',
      description: 'Capabilities needed by actors to execute threats',
      color: 'border-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      icon: '⚡'
    },
    {
      key: 'critical_requirements',
      label: 'Critical Requirements',
      description: 'Requirements needed for each capability',
      color: 'border-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      icon: '📋'
    },
    {
      key: 'proximate_targets',
      label: 'Proximate Targets',
      description: 'Tangible targets that can be influenced or attacked',
      color: 'border-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      icon: '🎪'
    }
  ]
}
```

---

## 📊 Comparison Table

| Aspect | COG | Causeway |
|--------|-----|----------|
| **Status** | ✅ Fully Implemented | ⚠️ Placeholder Only |
| **Doctrine** | JP 5-0 Military Planning | Strategic Communication / Influence Ops |
| **Focus** | Power sources (friendly/enemy) | Threat actors and influence pathways |
| **Hierarchy** | CoG → CC → CR → CV | Scenario → PUTAR → CC → CR → Proximate Targets |
| **Output** | Vulnerabilities to exploit | Influence network graph |
| **Primary Use** | Military operations planning | Information operations, strategic communication |

---

## 🎯 Recommendations

### For COG Framework

**Action:** ✅ **NO CHANGES REQUIRED**

The current COG implementation is correct and follows standard military doctrine.

### For Causeway Framework

**Action:** ⚠️ **REQUIRES FULL IMPLEMENTATION**

**Priority:** Medium (functional placeholder exists, but framework not usable)

**Estimated Effort:** 4-6 hours

**Steps:**

1. **Add to framework-configs.ts** (30 min)
   - Add causeway configuration with 5 sections as shown above
   - Update description from "Causeway Terrain Analysis" to proper description

2. **Update index.tsx** (15 min)
   - Change from `FrameworkListPage` (placeholder) to `GenericFrameworkPage`
   - Update to: `export const CausewayPage = () => <GenericFrameworkPage frameworkKey="causeway" />`

3. **Test functionality** (30 min)
   - Create a test Causeway analysis
   - Verify all 5 sections display correctly
   - Test CRUD operations

4. **Optional: Enhanced Causeway Features** (3-4 hours)
   - Add hierarchical visualization (PUTAR → CC → CR → PT graph)
   - Add AI-powered threat suggestion (like main branch)
   - Add PMESII-PT dimension tagging
   - Add relationship mapping between PUTARs

---

## ✅ Action Items

### Immediate (Required)
- [ ] Add Causeway framework configuration to `framework-configs.ts`
- [ ] Update `CausewayPage` to use `GenericFrameworkPage` instead of placeholder
- [ ] Test Causeway CRUD operations
- [ ] Update roadmap to mark Causeway as complete

### Future Enhancements
- [ ] Add visualization for Causeway graph (like main branch has)
- [ ] Add AI threat suggestions
- [ ] Add PUTAR relationship mapping
- [ ] Add export to graph formats (GraphML, D3.js)

---

## 🔍 Testing Checklist

### COG (Already Correct)
- [x] COG configuration exists in framework-configs.ts
- [x] COG uses GenericFrameworkPage
- [x] All 4 sections render correctly
- [x] CRUD operations work

### Causeway (To Be Tested After Implementation)
- [ ] Causeway configuration exists in framework-configs.ts
- [ ] Causeway uses GenericFrameworkPage (not placeholder)
- [ ] All 5 sections render correctly
- [ ] Can create new Causeway analysis
- [ ] Can edit existing Causeway analysis
- [ ] Can delete Causeway analysis
- [ ] Section descriptions are accurate

---

## 📚 References

**COG Doctrine:**
- Joint Publication 5-0 (Joint Planning)
- FM 5-0 (Army Operations Process)
- Marine Corps Warfighting Publication (MCWP) 5-1

**Causeway Framework:**
- Main branch implementation: `frameworks/causeway.py`
- Academic: Strategic Communication and Influence Operations
- Related: PMESII-PT framework integration

---

**Status:** Review Complete
**Next Action:** Implement Causeway framework configuration
**Estimated Completion:** 1 hour for basic implementation
