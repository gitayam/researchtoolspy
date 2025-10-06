# Behavior Analysis Report - Requirements & Structure

## Purpose

The Behavior Analysis Report provides an **objective, analytical breakdown** of a target behavior using the COM-B (Capability, Opportunity, Motivation → Behavior) framework. This report is designed for analysts to understand the requirements, process, and potential audiences for a behavior **without prescribing interventions**.

---

## Key Principles

### ✅ WHAT THE REPORT SHOULD INCLUDE

1. **Objective Behavior Description**
   - What the behavior is
   - Why it's being analyzed
   - Context and background

2. **Process Documentation**
   - Step-by-step flow of how the behavior is performed
   - Timeline with decision points
   - Sub-steps and alternatives
   - Required resources, time, location

3. **Requirements Breakdown**
   - **Capability Requirements**: Physical and psychological capabilities needed
   - **Opportunity Requirements**: Environmental and social factors necessary
   - **Motivation Factors**: Reflective and automatic motivations involved

4. **Potential Target Audiences (Objective Analysis)**
   - Who currently CAN perform the behavior (adequate COM-B components)
   - Who currently CANNOT perform the behavior (deficits in COM-B components)
   - Neutral observation of population segments based on requirements

5. **Behavior Timeline/Flow Chart**
   - Visual or text-based representation of the complete behavior process
   - Decision points ("if X, then Y")
   - Parallel paths and alternatives
   - Dependencies between steps

---

### ❌ WHAT THE REPORT SHOULD NOT INCLUDE (Unless Explicitly Requested)

1. **NO Intervention Strategies**
   - Do NOT recommend how to change the behavior
   - Do NOT suggest training, education, or policy interventions
   - EXCEPTION: Only include Behaviour Change Wheel interventions if user has explicitly marked COM-B deficits

2. **NO Target Audience Recommendations**
   - Do NOT prescribe which audience to target
   - Do NOT suggest how to increase or decrease the behavior
   - ONLY provide objective analysis of who has capabilities/opportunities

3. **NO Normative Judgments**
   - Do NOT say whether the behavior is "good" or "bad"
   - Do NOT evaluate whether it should be promoted or discouraged
   - Remain neutral and analytical

---

## Report Structure

### Section 1: Behavior Process Overview
- High-level description of the analyzed behavior
- Purpose and context

### Section 2: Requirements for Behavior Completion

#### 2.1 Capability Requirements
- **💪 Physical Capability**
  - Physical skills, strength, stamina required
  - Status: Generally Adequate / Some Limitations / Significant Barriers

- **🧠 Psychological Capability**
  - Knowledge, cognitive skills, comprehension needed
  - Status: Generally Adequate / Some Limitations / Significant Barriers

#### 2.2 Opportunity Requirements
- **🌍 Physical Opportunity**
  - Environmental factors, time, resources, infrastructure
  - Status: Generally Available / Limited Availability / Significant Constraints

- **👥 Social Opportunity**
  - Cultural norms, social cues, peer influence
  - Status: Generally Available / Limited Availability / Significant Constraints

#### 2.3 Motivation Factors
- **🎯 Reflective Motivation**
  - Beliefs, intentions, goals, identity alignment
  - Status: Generally Present / Variable / Often Absent

- **⚡ Automatic Motivation**
  - Emotions, impulses, habits, desires
  - Status: Generally Present / Variable / Often Absent

### Section 3: Potential Target Audiences

*Objective analysis based on COM-B assessment*

#### To Increase Behavior
Target audiences that currently have barriers but could perform the behavior with appropriate support:
- List individuals lacking specific COM-B components

#### To Decrease Behavior
Target audiences currently performing the behavior:
- List individuals with adequate COM-B components

**Note:** This is descriptive, not prescriptive. It identifies who CAN vs. CANNOT do the behavior based on requirements.

### Section 4: Behavior Process Flow & Timeline

Step-by-step documentation of the complete behavior:

**Step 1: [First Action]**
- Description: What happens in this step
- ⏰ Time: When this occurs
- 📍 Location: Where this happens
- ⏱️ Duration: How long it takes
- 🔧 Resources: What's needed

**Sub-steps:**
  1. Detailed action 1
  2. Detailed action 2

**Decision Point:** If X, then Y

**Alternative Paths:**
- Option A leads to...
- Option B leads to...

---

*(Repeat for each step)*

---

### Section 5: Behaviour Change Wheel - Intervention Recommendations

**⚠️ CONDITIONAL SECTION - Only appears if:**
1. User has explicitly marked COM-B deficits (deficit or major_barrier)
2. System has identified specific barriers

If included, this section provides:
- Evidence-based intervention functions from BCW methodology
- Priority ratings (high/medium/low)
- Policy category recommendations
- Implementation considerations

**Note:** This section is clearly labeled as intervention-focused and separate from the objective analysis.

---

## Implementation in Code

### File Location
`/Users/sac/Git/researchtoolspy/frontend-react/src/lib/report-generator.ts`

### Key Function
`generateBehaviorMarkdown(data: any, aiEnhancements?: AIEnhancements): string`

### Logic Flow

```typescript
1. Generate Behavior Process Overview
2. Generate Requirements for Behavior Completion
   - Capability Requirements (objective status)
   - Opportunity Requirements (objective status)
   - Motivation Factors (objective status)
3. Generate Potential Target Audiences (objective)
   - To increase (those with deficits)
   - To decrease (those with adequate components)
4. IF user has marked deficits THEN
   - Generate Behaviour Change Wheel Interventions
   - Generate Policy Recommendations
5. Generate Behavior Process Flow & Timeline
6. Generate other framework-specific sections
```

### Conditional Intervention Logic

```typescript
const hasMarkedDeficits = Object.values(deficits).some(
  d => d === 'deficit' || d === 'major_barrier'
)

if (hasMarkedDeficits) {
  // Generate BCW intervention recommendations
  // Include policy categories if interventions selected
}
```

---

## Example Output (Objective Report - No Interventions)

```markdown
# Behavior Analysis Report: Using Public Transportation

## 📋 Behavior Process Overview

Analysis of the behavior of using public transportation for daily commuting.

## ✅ Requirements for Behavior Completion

This section outlines the capabilities and opportunities necessary to perform the analyzed behavior.

### Capability Requirements

**💪 Physical Capability**

*Physical skills, strength, stamina required*

Status: ✓ Generally Adequate

**🧠 Psychological Capability**

*Knowledge, cognitive skills, comprehension needed*

Status: ⚠ Some Limitations

### Opportunity Requirements

**🌍 Physical Opportunity**

*Environmental factors, time, resources, infrastructure*

Status: ✖ Significant Constraints

**👥 Social Opportunity**

*Cultural norms, social cues, peer influence*

Status: ✓ Generally Available

### Motivation Factors

**🎯 Reflective Motivation**

*Beliefs, intentions, goals, identity alignment*

Status: ⚠ Variable

**⚡ Automatic Motivation**

*Emotions, impulses, habits, desires*

Status: ✓ Generally Present

## 👥 Potential Target Audiences

*Based on capability, opportunity, and motivation analysis*

### To Increase Behavior

Target audiences that currently have barriers but could perform the behavior with appropriate support:

- Individuals lacking psychological capability (knowledge, cognitive skills, comprehension needed)
- Individuals lacking physical opportunity (environmental factors, time, resources, infrastructure)
- Individuals lacking reflective motivation (beliefs, intentions, goals, identity alignment)

### To Decrease Behavior

Target audiences currently performing the behavior:

- Individuals with adequate physical capability, social opportunity, automatic motivation

## 📅 Behavior Process Flow & Timeline

This section documents the step-by-step process to complete the behavior, including decision points, sub-steps, and requirements.

### Step 1: Plan Route

**Description:** Determine which bus/train to take and at what time

- ⏰ Time: 5-10 minutes before departure
- 📍 Location: Home or workplace
- ⏱️ Duration: 5-10 minutes
- 🔧 Resources: Transit map, smartphone app, schedule

**Sub-steps:**
  1. Check current location
  2. Identify destination
  3. Search for routes
  4. Compare travel times
  5. Select optimal route

**Decision Point:** If multiple routes available, choose based on time/cost preferences

---

### Step 2: Travel to Transit Stop

...

```

---

## Lessons Learned Integration

References to review:
- `/Users/sac/Git/researchtoolspy/frontend-react/lessonslearned-gpt-cloudflare-workers.md`
- `/Users/sac/Git/researchtoolspy/Lessons_Learned.md`

Key lessons applied:
1. **Use gpt-5-mini** for AI enhancements (per global CLAUDE.md)
2. **Avoid temperature parameter** (not supported in GPT-5 models)
3. **Conditional logic** for interventions (only when deficits marked)
4. **Objective tone** for default reports
5. **Clear sectioning** to separate analysis from recommendations

---

## Next Steps

1. ✅ Updated `generateBehaviorMarkdown()` function (COMPLETE)
2. ✅ Added objective requirements breakdown (COMPLETE)
3. ✅ Added potential audiences section (COMPLETE)
4. ✅ Enhanced timeline with decision points (COMPLETE)
5. ⏳ Update Word/PDF/PowerPoint exports to match new structure
6. ⏳ Test with real behavior analysis data
7. ⏳ Update UI to clarify when interventions will appear

---

*Last Updated: 2025-10-06*
*Status: Report generation logic updated, export formats pending*
