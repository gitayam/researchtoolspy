# Research Question Generator - Implementation Plan

## Overview
A guided tool to help researchers formulate high-quality research questions following best practices (SMART + FINER criteria), with AI-generated recommendations and hypothesis formulation.

---

## Research Best Practices Summary

### 1. SMART Criteria
- **S**pecific: Clear, focused, well-defined
- **M**easurable: Can be quantified or observed with data
- **A**chievable: Realistic given resources and constraints
- **R**elevant: Significant contribution to field/practice
- **T**ime-bound: Clear timeframe for completion

### 2. FINER Criteria
- **F**easible: Resources, time, expertise, data availability
- **I**nteresting: Important to researcher and field ("so what?" factor)
- **N**ovel: Fills gap in existing knowledge
- **E**thical: No harm to participants, follows ethical guidelines
- **R**elevant: Practical implications for real-world application

### 3. Measurability & Observability
- Variables must be quantifiable or observable
- Clear operational definitions
- Data collection methods must exist
- Outcomes can be measured or documented

### 4. Hypothesis Formulation
- **Null Hypothesis (H₀)**: No effect, no difference, no relationship
  - Always contains equality (=, ≤, ≥)
  - Default assumption to be tested
- **Alternative Hypothesis (H₁/Hₐ)**: Effect exists, difference exists, relationship exists
  - Uses inequality (<, >, ≠)
  - What researcher expects to find

---

## Phase 1: Research Question Generator (Current Implementation)

### User Flow

#### Step 1: Initial Context (Topic & Purpose)
**Questions:**
1. What is your general area of interest or research topic?
   - Free text input
   - Examples: "Social media impact on mental health", "Climate change adaptation in coastal cities"

2. What is the purpose of this research?
   - Options: Exploratory, Descriptive, Explanatory, Evaluative, Policy-oriented, Applied research, Academic research
   - Multi-select allowed

3. What type of project is this?
   - Options: Academic thesis/dissertation, Journal article, Policy report, Grant proposal, Consulting project, Internal research, Other
   - Single select

#### Step 2: The 5 W's (Who, What, Where, When, Why)

**Who - Population/Subjects**
1. Who or what is the focus of your research?
   - Examples: "Young adults aged 18-25", "Small businesses in urban areas", "Climate policy documents"
   - Free text with AI suggestions

2. Are there specific subgroups you want to compare?
   - Free text (optional)
   - Examples: "Compare male vs female", "Urban vs rural populations"

**What - Variables/Phenomena**
1. What specific variables, behaviors, or phenomena will you study?
   - Free text with examples
   - Prompt: "What will you measure, observe, or analyze?"

2. What is the expected relationship or outcome?
   - Free text (optional)
   - Examples: "Increased X leads to decreased Y", "A is associated with B"

**Where - Context/Location**
1. Where will this research take place?
   - Free text
   - Examples: "United States", "Online platforms", "Rural communities in Southeast Asia"

2. Are there specific settings or contexts?
   - Free text (optional)
   - Examples: "Healthcare facilities", "Educational institutions", "Online social networks"

**When - Timeframe**
1. What time period will your research cover?
   - Free text
   - Examples: "2020-2024", "Next 6 months", "Past decade"

2. Is this a longitudinal study or snapshot in time?
   - Options: Cross-sectional (one point in time), Longitudinal (over time), Historical analysis, Real-time monitoring

**Why - Motivation/Gap**
1. Why is this research important?
   - Free text
   - Prompt: "What gap in knowledge does this address? What problem does it solve?"

2. Who will benefit from this research?
   - Free text (optional)
   - Examples: "Policymakers", "Healthcare providers", "Educators", "General public"

#### Step 3: Constraints & Resources

**Duration & Timeline**
1. How long do you have to complete this research?
   - Dropdown: 1-3 months, 3-6 months, 6-12 months, 1-2 years, 2+ years, Flexible/No deadline

**Resources Available**
1. What resources do you have access to? (Check all that apply)
   - Checkboxes:
     - Existing datasets
     - Survey tools
     - Research assistants
     - Statistical software
     - Funding for data collection
     - Access to participants/subjects
     - Lab facilities
     - Institutional support
     - Other (specify)

2. What is your research experience level?
   - Options: Beginner, Intermediate, Advanced, Expert

**Constraints & Limitations**
1. Are there areas or topics you want to avoid?
   - Free text (optional)
   - Examples: "Sensitive personal data", "High-cost experiments", "Restricted populations"

2. Are there any ethical considerations?
   - Free text (optional)
   - Prompt: "Vulnerable populations, privacy concerns, potential harm, etc."

#### Step 4: Measurability Check

**Automated Assessment:**
1. Are the key variables measurable?
   - AI analyzes user inputs to identify:
     - Quantitative variables (numbers, scales, counts)
     - Qualitative variables (categories, themes, narratives)
     - Observable behaviors
     - Existing measurement tools

2. Can data be collected to answer this question?
   - AI checks feasibility:
     - Data availability
     - Collection methods
     - Resource requirements

#### Step 5: Review & Generate

**Display 5W Summary:**
- General Topic: [user input]
- Who: [population/subjects]
- What: [variables/phenomena]
- Where: [location/context]
- When: [timeframe]
- Why: [purpose/significance]
- Project Type: [type]
- Duration: [timeline]
- Resources: [available resources]
- Constraints: [limitations/areas to avoid]

**AI-Generated Research Questions (3 recommendations)**

For each question, display:
1. **Recommended Research Question** (formatted professionally)
2. **SMART Criteria Assessment**
   - Specific: ✓/✗ with explanation
   - Measurable: ✓/✗ with explanation
   - Achievable: ✓/✗ with explanation
   - Relevant: ✓/✗ with explanation
   - Time-bound: ✓/✗ with explanation
3. **FINER Criteria Assessment**
   - Feasible: ✓/✗ with explanation
   - Interesting: ✓/✗ with explanation
   - Novel: ✓/✗ with explanation
   - Ethical: ✓/✗ with explanation
   - Relevant: ✓/✗ with explanation
4. **Null Hypothesis (H₀)**
5. **Alternative Hypothesis (H₁)**
6. **Key Variables to Measure**
7. **Suggested Data Collection Methods**
8. **Potential Challenges**

**User Actions:**
- Select one of the 3 generated questions
- Edit/customize selected question
- Regenerate with different parameters
- Save to workspace
- Export to document

---

## Phase 2: Research Plan Generator (Future Implementation)

### Features (Post-MVP)

1. **Methodology Selection**
   - Quantitative, Qualitative, Mixed methods
   - Specific approaches (survey, experiment, case study, etc.)

2. **Timeline Generator**
   - Milestones and deadlines
   - Gantt chart visualization
   - Critical path identification

3. **Resource Planning**
   - Budget estimation
   - Personnel needs
   - Equipment/software requirements

4. **Literature Review Guidance**
   - Key databases to search
   - Suggested search terms
   - Citation management tips

5. **Data Analysis Plan**
   - Statistical tests needed
   - Qualitative analysis methods
   - Software recommendations

6. **Ethical Considerations Checklist**
   - IRB requirements
   - Consent forms
   - Data privacy measures

7. **Dissemination Strategy**
   - Target journals/conferences
   - Public communication plan
   - Stakeholder engagement

---

## Technical Implementation

### Frontend Components

1. **ResearchQuestionGeneratorPage.tsx** (Main component)
   - Multi-step form wizard
   - Progress indicator
   - Step navigation (back/forward)
   - Save draft functionality

2. **Step Components:**
   - `TopicContextStep.tsx`
   - `FiveWsStep.tsx`
   - `ResourceConstraintsStep.tsx`
   - `MeasurabilityCheckStep.tsx`
   - `GeneratedQuestionsStep.tsx`

3. **UI Components:**
   - `ResearchQuestionCard.tsx` - Display generated questions
   - `CriteriaAssessment.tsx` - Show SMART/FINER checklist
   - `HypothesisDisplay.tsx` - Show null/alternative hypotheses
   - `FiveWSummary.tsx` - Display 5W breakdown

### Backend API

**Endpoint:** `POST /api/research/generate-question`

**Request Payload:**
```typescript
interface GenerateQuestionRequest {
  // Step 1
  topic: string
  purpose: string[]
  projectType: string

  // Step 2 (5 W's)
  who: {
    population: string
    subgroups?: string
  }
  what: {
    variables: string
    expectedOutcome?: string
  }
  where: {
    location: string
    specificSettings?: string
  }
  when: {
    timePeriod: string
    studyType: 'cross-sectional' | 'longitudinal' | 'historical' | 'real-time'
  }
  why: {
    importance: string
    beneficiaries?: string
  }

  // Step 3
  duration: string
  resources: string[]
  experienceLevel: string
  constraints?: string
  ethicalConsiderations?: string
}
```

**Response:**
```typescript
interface GeneratedQuestion {
  question: string
  smartAssessment: {
    specific: { passed: boolean; explanation: string }
    measurable: { passed: boolean; explanation: string }
    achievable: { passed: boolean; explanation: string }
    relevant: { passed: boolean; explanation: string }
    timeBound: { passed: boolean; explanation: string }
  }
  finerAssessment: {
    feasible: { passed: boolean; explanation: string }
    interesting: { passed: boolean; explanation: string }
    novel: { passed: boolean; explanation: string }
    ethical: { passed: boolean; explanation: string }
    relevant: { passed: boolean; explanation: string }
  }
  nullHypothesis: string
  alternativeHypothesis: string
  keyVariables: string[]
  dataCollectionMethods: string[]
  potentialChallenges: string[]
  overallScore: number // 0-100
}

interface GenerateQuestionResponse {
  success: boolean
  questions: GeneratedQuestion[] // 3 recommendations
  summary: {
    topic: string
    who: string
    what: string
    where: string
    when: string
    why: string
  }
}
```

### AI Prompt Strategy

**System Prompt:**
```
You are an expert research methodologist specializing in formulating high-quality research questions. Your task is to generate research questions that follow SMART and FINER criteria, are measurable/observable, and include appropriate null and alternative hypotheses.

SMART Criteria: Specific, Measurable, Achievable, Relevant, Time-bound
FINER Criteria: Feasible, Interesting, Novel, Ethical, Relevant

Generate 3 distinct research questions that:
1. Are different in scope or focus but address the user's core interest
2. Range from broad to narrow in scope
3. Are professionally worded
4. Include operational definitions of key variables
5. Can be tested with available resources
6. Follow best practices for research question formulation

For each question, provide:
- SMART assessment (detailed explanations)
- FINER assessment (detailed explanations)
- Null hypothesis (H₀) with equality symbol
- Alternative hypothesis (H₁) with inequality symbol
- Key measurable variables
- Suggested data collection methods
- Potential challenges
```

**User Prompt Template:**
```
Generate 3 research questions based on the following information:

TOPIC: {topic}
PURPOSE: {purpose}
PROJECT TYPE: {projectType}

5 W'S:
- WHO: {who.population} {who.subgroups ? `(comparing ${who.subgroups})` : ''}
- WHAT: {what.variables} {what.expectedOutcome ? `(expected: ${what.expectedOutcome})` : ''}
- WHERE: {where.location} {where.specificSettings ? `(settings: ${where.specificSettings})` : ''}
- WHEN: {when.timePeriod} ({when.studyType})
- WHY: {why.importance}

CONSTRAINTS:
- Duration: {duration}
- Resources: {resources.join(', ')}
- Experience Level: {experienceLevel}
- Areas to Avoid: {constraints || 'None specified'}
- Ethical Considerations: {ethicalConsiderations || 'None specified'}

Generate 3 research questions with varying scope (broad, moderate, narrow) that are SMART and FINER compliant. Return as JSON.
```

### Database Schema

**Table: `research_questions`**
```sql
CREATE TABLE research_questions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  workspace_id TEXT NOT NULL,

  -- Input data
  topic TEXT NOT NULL,
  purpose TEXT, -- JSON array
  project_type TEXT,
  five_ws TEXT NOT NULL, -- JSON: who, what, where, when, why
  duration TEXT,
  resources TEXT, -- JSON array
  experience_level TEXT,
  constraints TEXT,
  ethical_considerations TEXT,

  -- Generated questions (JSON array of GeneratedQuestion)
  generated_questions TEXT NOT NULL,

  -- Selected question
  selected_question TEXT,
  custom_edits TEXT,

  -- Status
  status TEXT DEFAULT 'draft', -- draft, finalized

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_research_questions_user ON research_questions(user_id);
CREATE INDEX idx_research_questions_workspace ON research_questions(workspace_id);
CREATE INDEX idx_research_questions_status ON research_questions(status);
```

---

## UI/UX Design Principles

1. **Progressive Disclosure**
   - Show one step at a time
   - Clear progress indicator
   - Allow users to go back and edit

2. **Helpful Examples**
   - Show example inputs for each field
   - Tooltips with guidance
   - Best practice tips

3. **AI Transparency**
   - Explain why each criterion passed/failed
   - Show how the question was formulated
   - Allow users to understand the assessment

4. **Flexibility**
   - Allow skipping optional fields
   - Enable editing of generated questions
   - Save drafts for later

5. **Educational Value**
   - Teach users about SMART/FINER criteria
   - Explain null/alternative hypotheses
   - Provide guidance on measurability

---

## Success Metrics

1. **Completion Rate**: % of users who complete all steps
2. **Question Quality**: Average SMART+FINER score of generated questions
3. **User Satisfaction**: Feedback on question usefulness
4. **Adoption Rate**: % of users who save/use generated questions
5. **Time Saved**: Compared to manual question formulation

---

## Implementation Timeline

### Week 1-2: Phase 1 Core (8-12 hours)
- [ ] Create database migration for research_questions table
- [ ] Build multi-step form UI components
- [ ] Implement 5 W's input collection
- [ ] Create API endpoint structure

### Week 2-3: AI Integration (6-8 hours)
- [ ] Design AI prompt for question generation
- [ ] Implement SMART/FINER assessment logic
- [ ] Generate null/alternative hypotheses
- [ ] Test and refine prompts

### Week 3-4: UI Polish (4-6 hours)
- [ ] Build generated question cards
- [ ] Create assessment visualization
- [ ] Add editing/selection functionality
- [ ] Implement save/export features

### Week 4: Testing & Refinement (4-6 hours)
- [ ] Test with real research scenarios
- [ ] Refine AI prompts based on output quality
- [ ] Fix bugs and improve UX
- [ ] Deploy to production

**Total Estimated Time: 22-32 hours**

---

## Future Enhancements (Phase 2+)

1. **Research Plan Generator** (Phase 2)
2. **Literature Review Assistant** (Phase 3)
3. **Hypothesis Testing Guide** (Phase 4)
4. **Methodology Recommendation Engine** (Phase 5)
5. **Sample Size Calculator** (Phase 6)
6. **IRB Application Helper** (Phase 7)
7. **Research Collaboration Tools** (Phase 8)

---

## References

- SMART Criteria: Doran, G. T. (1981). "There's a S.M.A.R.T. way to write management's goals and objectives"
- FINER Criteria: Hulley et al. (2007). "Designing Clinical Research"
- Research Questions: Creswell, J. W. (2014). "Research Design: Qualitative, Quantitative, and Mixed Methods Approaches"
- Hypothesis Testing: Field, A. (2013). "Discovering Statistics Using IBM SPSS Statistics"
