# Behavior Analysis Framework Improvements Plan

## Core Concept: Behavior + Location Specificity

**Critical Insight:** Behavior Analysis documents **BEHAVIOR + LOCATION**, not just behavior in abstract.
- Example: "Voting" behavior has similarities but critical differences by location
- Example: "Solar panel adoption" varies by region (regulations, incentives, climate)
- Rarely truly global - even online behaviors vary by platform, language, culture

## Problems with Current Implementation

1. **No Location/Context Guidance**
   - Users don't know where to document WHERE the behavior occurs
   - No structured fields for location specificity
   - Missing critical context like: in-person vs online, eligibility requirements, etc.

2. **AI Context Not Used**
   - AI assistant doesn't have access to other filled sections
   - Each field generated in isolation
   - Missing opportunity for coherent, context-aware assistance

3. **Timeline Too Manual**
   - No AI assistance for generating timeline events
   - No guidance on sub-steps, forks, alternative paths
   - Users may miss critical sequence variations

4. **Lack of Structured Guidance**
   - Free-form sections are too open-ended
   - Users don't know what questions to answer
   - Missing prompts for critical contextual factors

## Proposed Improvements

### 1. Enhanced Basic Information Section

**Add Structured Fields (before free-form description):**

```typescript
interface BehaviorBasicInfo {
  // Core identification
  title: string
  description: string

  // NEW: Behavior + Location specificity
  location_context: {
    geographic_scope: 'local' | 'regional' | 'national' | 'international' | 'global'
    specific_locations?: string[] // City, state, country, region
    location_notes?: string
  }

  // NEW: Where does behavior occur?
  behavior_setting: ('in_person' | 'online' | 'hybrid' | 'phone' | 'mail')[]
  setting_details?: string

  // NEW: When does it occur?
  temporal_context: {
    frequency_pattern?: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'one_time' | 'irregular'
    time_of_day?: ('morning' | 'afternoon' | 'evening' | 'night' | 'any_time')[]
    duration_typical?: string // "5 minutes", "1 hour", etc.
  }

  // NEW: Who can perform this behavior?
  eligibility: {
    has_requirements: boolean
    age_requirements?: string
    legal_requirements?: string
    skill_requirements?: string
    resource_requirements?: string
    other_requirements?: string
  }

  // NEW: Is this a multi-step process?
  complexity: 'single_action' | 'simple_sequence' | 'complex_process' | 'ongoing_practice'
}
```

**UI Layout:**
1. Title & Description (existing)
2. **Location Context Card** (NEW)
   - Geographic scope dropdown
   - Specific locations (chip input)
   - Location notes textarea
3. **Behavior Settings Card** (NEW)
   - Multi-select checkboxes: In Person, Online, Hybrid, Phone, Mail
   - Setting details textarea
4. **Temporal Context Card** (NEW)
   - Frequency pattern dropdown
   - Time of day multi-select
   - Duration input
5. **Eligibility Requirements Card** (NEW)
   - Toggle: "Has eligibility requirements?"
   - Conditional fields for age, legal, skill, resource requirements
6. **Complexity Level** (NEW)
   - Radio buttons: Single Action, Simple Sequence, Complex Process, Ongoing Practice

### 2. AI Context Awareness

**Implement Context Aggregation:**

```typescript
// When user clicks AI assist on ANY field, gather context
function getFormContext(formData: BehaviorAnalysis): string {
  const context = []

  // Basic info
  if (formData.title) context.push(`Behavior: ${formData.title}`)
  if (formData.description) context.push(`Description: ${formData.description}`)

  // Location context
  if (formData.location_context?.geographic_scope) {
    context.push(`Geographic Scope: ${formData.location_context.geographic_scope}`)
  }
  if (formData.location_context?.specific_locations) {
    context.push(`Locations: ${formData.location_context.specific_locations.join(', ')}`)
  }

  // Settings
  if (formData.behavior_setting) {
    context.push(`Settings: ${formData.behavior_setting.join(', ')}`)
  }

  // Temporal
  if (formData.temporal_context?.frequency_pattern) {
    context.push(`Frequency: ${formData.temporal_context.frequency_pattern}`)
  }

  // Eligibility
  if (formData.eligibility?.has_requirements) {
    const reqs = []
    if (formData.eligibility.age_requirements) reqs.push(`Age: ${formData.eligibility.age_requirements}`)
    if (formData.eligibility.legal_requirements) reqs.push(`Legal: ${formData.eligibility.legal_requirements}`)
    context.push(`Requirements: ${reqs.join(', ')}`)
  }

  // All section data
  Object.keys(formData).forEach(key => {
    if (Array.isArray(formData[key]) && formData[key].length > 0) {
      context.push(`${key}: ${formData[key].map(item => item.text || item.description).join('; ')}`)
    }
  })

  return context.join('\n')
}

// Use in AI prompt
const prompt = `
You are helping analyze a behavior in a specific location/context.

Current Analysis Context:
${getFormContext(formData)}

Task: ${userRequest}

Provide contextually relevant suggestions that align with the behavior, location, and other details already documented.
`
```

### 3. AI-Generated Timeline Events

**New Feature: "AI Generate Timeline" Button**

```typescript
interface TimelineAIRequest {
  behavior_title: string
  behavior_description: string
  location_context: LocationContext
  behavior_setting: string[]
  complexity: string
  existing_timeline?: TimelineEvent[]
}

const aiGenerateTimeline = async (request: TimelineAIRequest) => {
  const prompt = `
You are analyzing a behavior to create a detailed timeline of how it unfolds.

Behavior: ${request.behavior_title}
Description: ${request.behavior_description}
Location: ${request.location_context.specific_locations?.join(', ')} (${request.location_context.geographic_scope})
Settings: ${request.behavior_setting.join(', ')}
Complexity: ${request.complexity}

Create a detailed timeline of this behavior including:
1. Main sequence of steps (in chronological order)
2. Sub-steps for complex actions
3. Decision points and forks (where behavior can take different paths)
4. Time estimates for each step
5. Location changes during the behavior

Format as JSON:
{
  "events": [
    {
      "label": "Step name",
      "time": "HH:MM or relative time",
      "description": "What happens",
      "location": "Where this step occurs",
      "is_decision_point": false,
      "sub_steps": [
        { "label": "Sub-step", "description": "Detail" }
      ],
      "forks": [
        {
          "condition": "If X happens",
          "path": [{ "label": "Alternative step", "time": "HH:MM", "description": "..." }]
        }
      ]
    }
  ]
}

Existing timeline to enhance (if any):
${JSON.stringify(request.existing_timeline, null, 2)}
`
}
```

### 4. Updated Framework Config Sections

**Revised Behavior Analysis Sections:**

1. **Basic Information** (ENHANCED)
   - Title, description (existing)
   - + Location context fields
   - + Behavior settings
   - + Temporal context
   - + Eligibility requirements
   - + Complexity level

2. **Behavior Timeline** (ENHANCED)
   - Interactive timeline (existing)
   - + AI Generate Timeline button
   - + Support for sub-steps
   - + Support for forks/branches
   - + Time estimates

3. **Environmental Factors** (existing, enhanced prompts)
   - "What physical infrastructure exists?"
   - "What resources are available?"
   - "What are the accessibility considerations?"
   - AI context-aware

4. **Social and Cultural Context** (existing, enhanced prompts)
   - "What are the cultural norms around this behavior?"
   - "What social influences exist?"
   - "Are there community leaders or influencers?"
   - AI context-aware

5. **Consequences and Outcomes** (existing, enhanced prompts)
   - "What are immediate consequences?"
   - "What are long-term outcomes?"
   - "What rewards or penalties exist?"
   - AI context-aware

6. **Symbols and Signals** (existing, enhanced prompts)
   - "What symbols are associated with this behavior?"
   - "What signals indicate the behavior?"
   - "Are there visual/auditory/social cues?"
   - AI context-aware

7. **Observed Patterns** (existing, enhanced prompts)
   - "What variations exist in how people perform this?"
   - "What are common sequences?"
   - "What alternative paths do people take?"
   - AI context-aware

8. **Potential Target Audiences** (existing, enhanced prompts)
   - "Who currently performs this behavior?"
   - "Who could perform it but doesn't?"
   - "What are the key audience segments?"
   - Links to COM-B Analysis creation

## Implementation Plan

### Phase 1: Enhanced Basic Information Section (Week 1)
- [ ] Update `src/types/behavior.ts` with new fields
- [ ] Create `BehaviorBasicInfoForm.tsx` component
- [ ] Add location context card
- [ ] Add behavior settings card
- [ ] Add temporal context card
- [ ] Add eligibility requirements card
- [ ] Add complexity selector
- [ ] Update framework config for behavior
- [ ] Test form save/load

### Phase 2: AI Context Aggregation (Week 1)
- [ ] Create `getFormContext()` utility function
- [ ] Update `AIFieldAssistant` to accept context
- [ ] Modify AI prompts to include context
- [ ] Test AI suggestions with context
- [ ] Add context preview in AI modal

### Phase 3: AI Timeline Generation (Week 2)
- [ ] Design timeline AI prompt template
- [ ] Create "AI Generate Timeline" button
- [ ] Implement timeline generation API call
- [ ] Parse AI response to TimelineEvent[]
- [ ] Support merging with existing timeline
- [ ] Add sub-steps support in BehaviorTimeline component
- [ ] Add forks/branches visualization
- [ ] Test timeline generation

### Phase 4: Enhanced Section Prompts (Week 2)
- [ ] Update framework config with guided questions
- [ ] Add inline helper text for each section
- [ ] Create example bullets in placeholders
- [ ] Add "What to document" tips
- [ ] Update AI prompts for each section

### Phase 5: Location Specificity Emphasis (Week 3)
- [ ] Add warning if location too vague
- [ ] Create location selector with common options
- [ ] Add "Behavior + Location" explainer
- [ ] Show location badge throughout analysis
- [ ] Add location comparison feature (future)

### Phase 6: Testing & Polish (Week 3)
- [ ] End-to-end testing with real examples
- [ ] User testing with sample behaviors
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Deploy to production

## Success Metrics

1. **User Guidance**: Users understand what to document (95%+ fill required fields)
2. **Location Specificity**: 90%+ analyses have specific location context
3. **AI Effectiveness**: 70%+ AI suggestions accepted by users
4. **Timeline Quality**: 80%+ analyses use timeline (up from ~30% estimated)
5. **COM-B Pipeline**: 50%+ behaviors lead to COM-B analyses

## Example Use Cases

### Example 1: Voting Behavior
**Before:**
- Title: "Voting"
- Description: "People vote in elections"
- Vague, no location context

**After:**
- Title: "Voting in Presidential Elections"
- Location: United States, [California, Texas, Florida]
- Geographic Scope: National (with state-level variations)
- Settings: In Person, Mail
- Eligibility: Age ≥18, U.S. Citizen, Registered
- Frequency: Every 4 years
- Complexity: Simple Sequence
- Timeline: [Register → Research Candidates → Vote → Confirm]
- Forks: [In-Person Branch, Mail-In Branch, Early Voting Branch]

### Example 2: Solar Panel Adoption
**Before:**
- Title: "Installing Solar Panels"
- Generic timeline

**After:**
- Title: "Residential Solar Panel Installation"
- Location: California, USA
- Geographic Scope: Regional (state-specific incentives)
- Settings: In Person, Online (research)
- Eligibility: Homeowner, Roof suitable, Credit check
- Frequency: One-time (with maintenance)
- Complexity: Complex Process
- Timeline: [Research → Get Quotes → Apply for Incentives → Installation → Inspection]
- Environmental Factors: Solar exposure, net metering, local regulations
- Symbols: Tesla Powerwall, solar panel visibility, green status

## Technical Requirements

### New TypeScript Types
```typescript
// src/types/behavior.ts
export interface LocationContext {
  geographic_scope: 'local' | 'regional' | 'national' | 'international' | 'global'
  specific_locations?: string[]
  location_notes?: string
}

export interface BehaviorSetting {
  settings: ('in_person' | 'online' | 'hybrid' | 'phone' | 'mail')[]
  setting_details?: string
}

export interface TemporalContext {
  frequency_pattern?: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'one_time' | 'irregular'
  time_of_day?: ('morning' | 'afternoon' | 'evening' | 'night' | 'any_time')[]
  duration_typical?: string
}

export interface EligibilityRequirements {
  has_requirements: boolean
  age_requirements?: string
  legal_requirements?: string
  skill_requirements?: string
  resource_requirements?: string
  other_requirements?: string
}

export type BehaviorComplexity = 'single_action' | 'simple_sequence' | 'complex_process' | 'ongoing_practice'
```

### New Components
- `BehaviorBasicInfoForm.tsx` - Enhanced basic info with structured fields
- `LocationContextCard.tsx` - Location specificity inputs
- `BehaviorSettingsCard.tsx` - Multi-select settings
- `TemporalContextCard.tsx` - When behavior occurs
- `EligibilityCard.tsx` - Requirements inputs
- `AITimelineGenerator.tsx` - AI timeline generation modal

### Updated Components
- `GenericFrameworkForm.tsx` - Special handling for behavior basic info
- `BehaviorTimeline.tsx` - Add sub-steps and forks support
- `AIFieldAssistant.tsx` - Accept and use form context

## Migration Strategy

1. **Backward Compatible**: Old analyses still work
2. **Progressive Enhancement**: New fields optional
3. **AI Migration**: Offer "Enhance with AI" for old analyses
4. **Data Migration**: Background job to populate location_context from descriptions
