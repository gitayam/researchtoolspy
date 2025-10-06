# Word Export Update Needed for Behavior Reports

**Date:** 2025-10-06
**File:** `/Users/sac/Git/researchtoolspy/frontend-react/src/lib/report-generator.ts`
**Lines:** 1391-1669 (behavior Word export section)

---

## ✅ Summary of Changes Completed

### 1. Markdown Report Generation (COMPLETE)
- ✅ Updated `generateBehaviorMarkdown()` (lines 161-372)
- ✅ Now generates OBJECTIVE reports by default
- ✅ Only includes BCW interventions when user marks deficits
- ✅ Added flow chart/timeline with decision points
- ✅ Added potential target audiences (objective analysis)

---

## ⏳ Pending: Word Export Must Match Markdown

**Current Status:** The Word export (lines 1391-1669) still uses the OLD structure:
- Always shows "COM-B Assessment Summary"
- Always shows "Behavior Change Feasibility"
- Always generates interventions (even without deficits)

**Required:** Update Word export to match the new markdown structure:

###Section Order (OBJECTIVE STRUCTURE):

1. **📋 Behavior Process Overview**
   - Description of the behavior

2. **✅ Requirements for Behavior Completion**
   - Capability Requirements (Physical & Psychological)
   - Opportunity Requirements (Physical & Social)
   - Motivation Factors (Reflective & Automatic)
   - Each component shows: Icon, Label, Description, Status

3. **👥 Potential Target Audiences** (OBJECTIVE)
   - To Increase Behavior (those with deficits)
   - To Decrease Behavior (those with adequate components)

4. **📅 Behavior Process Flow & Timeline** (Enhanced)
   - Step-by-step with decision points
   - Sub-steps, alternatives, resources

5. **🔧 BCW Interventions** (CONDITIONAL)
   - **ONLY if:** `hasMarkedDeficits = true`
   - Intervention recommendations
   - Policy recommendations

---

## 🔧 Implementation Guide

### Step 1: Replace Behavior Word Export Section

**Find:** Lines 1391-1669 in `report-generator.ts`

**Replace with structure:**

```typescript
} else if (frameworkType === 'behavior') {
  // NEW OBJECTIVE STRUCTURE

  // 1. Behavior Process Overview
  paragraphs.push(new Paragraph({
    text: '📋 Behavior Process Overview',
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 }
  }))

  if (data.description) {
    paragraphs.push(new Paragraph({
      text: data.description,
      spacing: { after: 400 }
    }))
  }

  // 2. Requirements for Behavior Completion
  if (data.com_b_deficits) {
    const deficits = data.com_b_deficits as ComBDeficits

    paragraphs.push(new Paragraph({
      text: '✅ Requirements for Behavior Completion',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 }
    }))

    paragraphs.push(new Paragraph({
      text: 'This section outlines the capabilities and opportunities necessary to perform the analyzed behavior.',
      spacing: { after: 300 },
      italics: true
    }))

    const componentNames: Record<string, { label: string; icon: string; desc: string }> = {
      physical_capability: {
        label: 'Physical Capability',
        icon: '💪',
        desc: 'Physical skills, strength, stamina required'
      },
      // ... (all 6 components with descriptions)
    }

    // CAPABILITY REQUIREMENTS
    paragraphs.push(new Paragraph({
      text: 'Capability Requirements',
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 300, after: 150 }
    }))

    Object.entries(deficits).forEach(([component, level]) => {
      if (component.includes('capability')) {
        const info = componentNames[component]
        const statusText = level === 'adequate'
          ? '✓ Generally Adequate'
          : level === 'deficit'
          ? '⚠ Some Limitations'
          : '✖ Significant Barriers'

        paragraphs.push(
          new Paragraph({ text: `${info.icon} ${info.label}`, bold: true, ... }),
          new Paragraph({ text: info.desc, italics: true, ... }),
          new Paragraph({ text: `Status: ${statusText}`, ... })
        )
      }
    })

    // OPPORTUNITY REQUIREMENTS (same pattern)
    // MOTIVATION FACTORS (same pattern)

    // 3. POTENTIAL TARGET AUDIENCES (OBJECTIVE)
    paragraphs.push(new Paragraph({
      text: '👥 Potential Target Audiences',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 }
    }))

    paragraphs.push(new Paragraph({
      text: 'Based on capability, opportunity, and motivation analysis',
      italics: true,
      spacing: { after: 300 }
    }))

    const hasDeficits = Object.values(deficits).some(d => d !== 'adequate')

    if (hasDeficits) {
      paragraphs.push(new Paragraph({ text: 'To Increase Behavior', heading: HeadingLevel.HEADING_3, ... }))
      paragraphs.push(new Paragraph({ text: 'Target audiences that currently have barriers...', ... }))

      Object.entries(deficits).forEach(([component, level]) => {
        if (level !== 'adequate') {
          const info = componentNames[component]
          paragraphs.push(new Paragraph({
            text: `• Individuals lacking ${info.label.toLowerCase()} (${info.desc.toLowerCase()})`,
            ...
          }))
        }
      })
    }

    paragraphs.push(new Paragraph({ text: 'To Decrease Behavior', ... }))
    // ... list adequ components

    // 4. BCW INTERVENTIONS (CONDITIONAL - ONLY IF DEFICITS MARKED)
    const hasMarkedDeficits = Object.values(deficits).some(d => d === 'deficit' || d === 'major_barrier')

    if (hasMarkedDeficits) {
      paragraphs.push(new Paragraph({
        text: '🔧 Behaviour Change Wheel - Intervention Recommendations',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      }))

      paragraphs.push(new Paragraph({
        text: 'Note: These recommendations are generated because COM-B deficits were identified.',
        italics: true,
        ...
      }))

      const interventionRecs = generateInterventionRecommendations(deficits)
      // ... generate intervention paragraphs

      // Policy Recommendations (only if interventions selected)
      if (data.selected_interventions && data.selected_interventions.length > 0) {
        // ... generate policy paragraphs
      }
    }
  }
}
```

### Step 2: Test the Update

1. Export a behavior report with NO deficits marked
   - Should show: Overview, Requirements, Audiences, Timeline
   - Should NOT show: BCW Interventions

2. Export a behavior report WITH deficits marked
   - Should show: All above + BCW Interventions section

---

## 🌐 Multi-Language Support (Also Needed)

The markdown report doesn't currently use i18n. To add Spanish support:

1. **Add language parameter** to `ReportOptions`
2. **Create translation keys** in `locales/en/common.json` and `locales/es/common.json`
3. **Update section headers** to use translated strings
4. **Pass language from ExportButton** component

**See:** `BEHAVIOR_MULTILANG_UPDATE.md` for complete details

---

## ✅ Verification Checklist

After making changes:

- [ ] Word export matches markdown structure
- [ ] Objective sections appear for all reports
- [ ] BCW interventions ONLY appear when deficits marked
- [ ] Timeline section includes decision points
- [ ] Potential audiences section is objective (not prescriptive)
- [ ] Export in English works
- [ ] Export in Spanish works (after i18n added)
- [ ] PDF export matches Word export
- [ ] PowerPoint export matches structure

---

**Current File Size:** ~2500 lines
**Section to Update:** Lines 1391-1669 (279 lines)
**Replacement Size:** ~400 lines (with new objective structure)

**Manual Edit Required:** Due to size of replacement, manual editing recommended.

1. Open `/Users/sac/Git/researchtoolspy/frontend-react/src/lib/report-generator.ts`
2. Find line 1391: `} else if (frameworkType === 'behavior') {`
3. Find line 1669: closing `}` for behavior section
4. Replace entire section with new objective structure
5. Use markdown generation (lines 161-372) as reference

---

*Created: 2025-10-06*
*Status: Documentation complete - manual code update required*
