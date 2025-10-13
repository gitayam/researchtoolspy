# Research Context Feature Implementation Plan

## Overview
Add flexible research context selection to make the Research Question Generator suitable for:
- Academic/Graduate Research
- Open Source Intelligence (OSINT)
- Private Investigation
- Business Research
- Investigative Journalism
- Personal/Hobby Research

## Phase 1: Research Context Selection (CURRENT)

### Frontend Changes

#### 1. Update ResearchQuestionGeneratorPage.tsx

**Data Models:**
```typescript
// ✅ DONE - Added to FormData interface
researchContext: 'academic' | 'osint' | 'investigation' | 'business' | 'journalism' | 'personal' | ''
teamSize: 'solo' | 'small-team' | 'large-team'
teamRoles: string[]
```

**Constants:**
```typescript
// ✅ DONE - Added RESEARCH_CONTEXTS array with:
- value, label, description, icon, emphasizes[] for each context
```

**Steps:**
```typescript
// ✅ DONE - Updated STEPS array:
Step 0: Quick Start
Step 1: Research Context (NEW)
Step 2: Topic & Purpose (was Step 1)
Step 3: The 5 W's (was Step 2)
Step 4: Resources & Constraints (was Step 3)
Step 5: Review & Generate (was Step 4)
```

#### 2. Create Step1ResearchContext Component

**TODO - Create new component:**
```tsx
function Step1ResearchContext({
  formData,
  updateFormData
}: {
  formData: FormData
  updateFormData: (updates: Partial<FormData>) => void
}) {
  return (
    <div className="space-y-6">
      {/* Research Context Selection */}
      <div>
        <h3>Select Research Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {RESEARCH_CONTEXTS.map(context => (
            <Card
              key={context.value}
              className={formData.researchContext === context.value ? 'border-purple-500' : ''}
              onClick={() => updateFormData({ researchContext: context.value })}
            >
              <CardHeader>
                <div className="text-4xl mb-2">{context.icon}</div>
                <CardTitle>{context.label}</CardTitle>
                <CardDescription>{context.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  <strong>Emphasizes:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {context.emphasizes.slice(0, 3).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Team Structure */}
      {formData.researchContext && (
        <div>
          <h3>Team Structure</h3>
          <RadioGroup
            value={formData.teamSize}
            onValueChange={(v) => updateFormData({ teamSize: v as any })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="solo" id="solo" />
              <Label htmlFor="solo">Solo Researcher</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="small-team" id="small-team" />
              <Label htmlFor="small-team">Small Team (2-5 people)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="large-team" id="large-team" />
              <Label htmlFor="large-team">Large Team (6+ people)</Label>
            </div>
          </RadioGroup>

          {/* Team Roles if not solo */}
          {formData.teamSize !== 'solo' && (
            <div className="mt-4">
              <Label>Team Roles (one per line)</Label>
              <Textarea
                placeholder="Lead Researcher&#10;Data Analyst&#10;Field Investigator"
                value={formData.teamRoles.join('\n')}
                onChange={(e) => updateFormData({
                  teamRoles: e.target.value.split('\n').filter(r => r.trim())
                })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

#### 3. Update Step Rendering

**TODO - Update currentStep checks:**
```tsx
{currentStep === 1 && (
  <Step1ResearchContext formData={formData} updateFormData={updateFormData} />
)}
{currentStep === 2 && (
  <Step2TopicContext formData={formData} updateFormData={updateFormData} />
)}
{currentStep === 3 && (
  <Step3FiveWs formData={formData} updateFormData={updateFormData} />
)}
{currentStep === 4 && (
  <Step4Resources formData={formData} updateFormData={updateFormData} />
)}
{currentStep === 5 && (
  <Step5Generate {...props} />
)}
```

#### 4. Update Navigation Logic

**TODO - Update validation:**
```tsx
disabled={
  (currentStep === 1 && !formData.researchContext) ||
  (currentStep === 2 && (!formData.topic || !formData.projectType)) ||
  (currentStep === 3 && (!formData.who.population || ...)) ||
  (currentStep === 4 && (!formData.duration || ...))
}
```

**TODO - Update navigation bounds:**
```tsx
{currentStep < 5 && currentStep !== 0 && (
  // navigation buttons
)}
```

### Backend Changes

#### 1. Update generate-plan.ts API

**TODO - Add context-aware plan generation:**
```typescript
interface GeneratePlanRequest {
  researchQuestionId: string
  researchQuestion: string
  duration: string
  resources: string[]
  experienceLevel: string
  projectType: string
  fiveWs: { ... }

  // NEW FIELDS:
  researchContext: 'academic' | 'osint' | 'investigation' | 'business' | 'journalism' | 'personal'
  teamSize: 'solo' | 'small-team' | 'large-team'
  teamRoles: string[]
}
```

**TODO - Update AI prompt based on context:**
```typescript
const getContextSpecificPrompt = (context: string) => {
  switch (context) {
    case 'osint':
      return `
        OSINT-Specific Requirements:
        - Source Verification Protocol
        - OPSEC Considerations
        - Digital Trail Management
        - Attribution Methodology
        - Threat Modeling
        - Open Source Tools & Platforms
      `
    case 'investigation':
      return `
        Investigation-Specific Requirements:
        - Legal Compliance Checklist
        - Evidence Chain of Custody
        - Client Reporting Schedule
        - Surveillance Protocols
        - Privacy/Confidentiality Measures
      `
    case 'business':
      return `
        Business Research Requirements:
        - ROI Projection
        - Stakeholder Analysis
        - Competitive Intelligence Methods
        - Risk Mitigation
        - Executive Summary Requirements
      `
    // ... other contexts
  }
}
```

**TODO - Modify ResearchPlan interface to be context-adaptive:**
```typescript
interface ResearchPlan {
  methodology: { ... }
  timeline: { ... }
  resources: { ... }

  // Context-specific sections (optional):
  literatureReview?: { ... }  // Academic
  sourceVerification?: { ... }  // OSINT
  legalCompliance?: { ... }  // Investigation
  roiAnalysis?: { ... }  // Business
  ethicsProtocol?: { ... }  // Journalism

  ethicalConsiderations: { ... }
  dissemination: { ... }

  // NEW: Team collaboration plan
  teamCollaboration?: {
    roles: Array<{ role: string, responsibilities: string[] }>
    communicationPlan: string
    taskDistribution: string[]
    collaborationTools: string[]
  }
}
```

## Phase 2: Workflow Integration (FUTURE)

### 1. Kanban Task Generation
- Generate tasks from research plan milestones
- Auto-assign tasks based on team roles
- Link tasks to Research Log entries

### 2. Research Log Structure
- Auto-create log sheets based on research context
- Context-specific fields (e.g., source metadata for OSINT)

### 3. SAT Recommendations
- Recommend Structured Analytic Techniques based on:
  - Research context
  - Complexity
  - Team size

## Phase 3: Content Drop Off Portal (FUTURE)

### Database Schema
```sql
CREATE TABLE content_submissions (
  id INTEGER PRIMARY KEY,
  investigation_id INTEGER,
  research_question_id INTEGER,
  submission_type TEXT, -- url, document, image, video, text, witness
  content TEXT,
  metadata JSON,
  submitted_at TIMESTAMP,
  submitted_by TEXT, -- email or anonymous
  status TEXT, -- pending, reviewed, integrated, rejected
  relevance_score REAL,
  ai_tags JSON,
  linked_entities JSON
)
```

### Features
- Anonymous submission portal
- Auto-triage with AI relevance scoring
- Auto-extract entities and link to investigation
- Link to specific research questions
- Evidence chain tracking

## Phase 4: Team Collaboration (FUTURE)

### Features
- Real-time collaborative editing
- Task assignments with notifications
- Progress tracking dashboard
- Team communication hub
- Role-based permissions

## Implementation Priority

### NOW (This PR):
1. ✅ Add research context data models
2. ✅ Add RESEARCH_CONTEXTS constant
3. ✅ Update STEPS array
4. ✅ Update FormData initialization
5. TODO: Create Step1ResearchContext component
6. TODO: Update step rendering logic
7. TODO: Update navigation validation
8. TODO: Update generate-plan API to accept new fields
9. TODO: Update AI prompts for context-specific plans
10. TODO: Test all workflows

### NEXT (Phase 2):
- Kanban task generation
- Research Log integration
- SAT recommendations

### FUTURE (Phase 3 & 4):
- Content Drop Off portal
- Team collaboration features

## Testing Checklist

- [ ] Quick Start → Start Wizard flows correctly to Step 1
- [ ] All research contexts render correctly
- [ ] Team size selection works
- [ ] Team roles textarea works (small/large teams only)
- [ ] Can complete wizard for each research context
- [ ] Research plans adapt to context
- [ ] Import Question still works
- [ ] AI Recommend still works
- [ ] Plans include team collaboration section (if team size > solo)
- [ ] Backend handles all new fields correctly

## Files to Modify

### Frontend:
1. ✅ `/src/pages/ResearchQuestionGeneratorPage.tsx` - Data models, constants, state
2. TODO: `/src/pages/ResearchQuestionGeneratorPage.tsx` - Add Step1ResearchContext component
3. TODO: `/src/pages/ResearchQuestionGeneratorPage.tsx` - Update step rendering
4. TODO: `/src/components/ui/radio-group.tsx` - May need to create if doesn't exist

### Backend:
1. TODO: `/functions/api/research/generate-plan.ts` - Update request interface
2. TODO: `/functions/api/research/generate-plan.ts` - Update AI prompts
3. TODO: `/functions/api/research/generate-plan.ts` - Add context-specific logic

### Documentation:
1. TODO: Update README with new research contexts
2. TODO: Add examples for each research type
