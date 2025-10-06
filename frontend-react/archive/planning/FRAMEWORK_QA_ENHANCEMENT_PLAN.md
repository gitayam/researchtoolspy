# Framework Q&A Enhancement Plan

## Executive Summary
Convert text-based frameworks to Question-Answer format to enable:
- **Structured Analysis**: Force analysts to answer specific questions rather than free-form text
- **Completeness Tracking**: Identify unanswered questions via summary reports
- **AI Follow-up Questions**: Generate contextual follow-up questions based on existing answers
- **Better Exports**: Enhanced report formatting with answered/unanswered summaries

## Current State Analysis

### Already Q&A Format ✅
- **DIME Framework** (4 sections)
- **Starbursting** (6 sections)

### Specialized Formats (Do Not Convert) 🔒
- **SWOT** - Quadrant format with text items
- **Stakeholder** - Power/Interest matrix
- **Deception (SATS)** - Methodology-specific structure

### Candidates for Q&A Conversion 🎯

## Recommended Conversions

### Tier 1: High Priority (Intelligence Analysis Frameworks)

#### 1. PMESII-PT Analysis ⭐⭐⭐
**Reasoning**: Environmental analysis framework where each dimension should answer specific assessment questions
**Sections**: 8 (Political, Military, Economic, Social, Information, Infrastructure, Physical, Time)
**Sample Questions**:
- Political: "What are the key political actors and their influence?", "How stable is the current government?"
- Military: "What military capabilities exist in the area?", "What are the threat force postures?"
- Economic: "What are the primary economic drivers?", "What resources are available?"

#### 2. Surveillance Framework (ISR) ⭐⭐⭐
**Reasoning**: ISR planning naturally frames as questions to be answered
**Sections**: 8 (Commander's Guidance, Intelligence Requirements, Collection Strategies, etc.)
**Sample Questions**:
- Commander's Guidance: "What are the priority information requirements?", "What decisions hinge on this intelligence?"
- Collection Strategies: "Which sensors/platforms will be used?", "What is the collection timeline?"

#### 3. Fundamental Flow Analysis ⭐⭐⭐
**Reasoning**: Intelligence cycle stages should answer "how is this done?" for each phase
**Sections**: 8 (Planning & Direction, Collection, Processing, Exploitation, etc.)
**Sample Questions**:
- Planning & Direction: "How are collection priorities established?", "Who validates intelligence requirements?"
- Collection: "What sources are being tasked?", "What collection methods are employed?"

#### 4. COG (Center of Gravity) ⭐⭐
**Reasoning**: Critical analysis where each element answers specific identification questions
**Sections**: 4 (Center of Gravity, Critical Capabilities, Critical Requirements, Critical Vulnerabilities)
**Sample Questions**:
- Center of Gravity: "What is the source of the adversary's power?", "What enables their freedom of action?"
- Critical Vulnerabilities: "What aspects are vulnerable to disruption?", "Which requirements have no redundancy?"

### Tier 2: Medium Priority (Capability Assessment Frameworks)

#### 5. DOTMLPF Analysis ⭐⭐
**Reasoning**: Military capability dimensions assessed through specific questions
**Sections**: 7 (Doctrine, Organization, Training, Material, Leadership, Personnel, Facilities)
**Sample Questions**:
- Doctrine: "What doctrinal gaps exist?", "How well are current TTPs documented?"
- Training: "What training deficiencies have been identified?", "What is the current readiness level?"

#### 6. Causeway Analysis ⭐⭐
**Reasoning**: Strategic threat analysis with specific PUTAR questions to answer
**Sections**: 5 (Scenario, PUTARs, Critical Capabilities, Critical Requirements, Proximate Targets)
**Sample Questions**:
- PUTAR: "What is the problem being addressed?", "Who is the undesired actor?", "What remedy is sought?"
- Proximate Targets: "What tangible targets can be influenced?", "Which targets offer leverage?"

### Tier 3: Lower Priority (Environmental Scanning)

#### 7. PEST Analysis ⭐
**Reasoning**: Environmental scanning that could benefit from structured questions
**Sections**: 4 (Political, Economic, Social, Technological)
**Sample Questions**:
- Political: "What political factors could impact operations?", "What regulatory changes are anticipated?"
- Technological: "What emerging technologies pose opportunities/threats?", "What is the technology adoption rate?"

#### 8. Behavior Analysis ⭐
**Reasoning**: Complex behavior analysis with many dimensions (12 sections) - could benefit but may be overwhelming
**Sections**: 12 (Basic Info, Timeline, Supporting Behaviors, Obstacles, etc.)
**Decision**: Keep as text format - too many sections would make Q&A overwhelming

## Implementation Priority

### Phase 1: Intelligence Frameworks (Immediate)
1. **PMESII-PT** - Convert to Q&A
2. **Surveillance (ISR)** - Convert to Q&A
3. **Fundamental Flow** - Convert to Q&A
4. **COG** - Convert to Q&A

### Phase 2: Capability Assessments (Next)
5. **DOTMLPF** - Convert to Q&A
6. **Causeway** - Convert to Q&A

### Phase 3: Environmental Scanning (Future)
7. **PEST** - Convert to Q&A (optional)

## Technical Implementation

### Changes Required

#### 1. Framework Configs (`src/config/framework-configs.ts`)
```typescript
// Add itemType: 'qa' to each framework
'pmesii-pt': {
  itemType: 'qa',  // Add this line
  // ... rest of config
}
```

#### 2. AI Prompts (`functions/api/ai/report-enhance.ts`)
- Update system messages for Q&A format
- Adjust prompts to generate questions and answers
- Ensure BLUF (Bottom Line Up Front) format

#### 3. AI Question Generation (`functions/api/ai/generate-questions.ts`)
- Already supports DIME and Starbursting
- Add support for new frameworks
- Create framework-specific question templates

## Benefits of Q&A Format

### 1. **Structured Analysis**
- Analysts must address specific aspects
- Reduces cognitive load by breaking analysis into discrete questions
- Ensures comprehensive coverage

### 2. **Progress Tracking**
- Visual indication of completion (answered vs unanswered)
- Summary reports show gaps
- Management visibility into analysis status

### 3. **AI Enhancement**
- Generate initial questions from description
- Create follow-up questions based on existing answers
- Suggest related questions

### 4. **Better Collaboration**
- Team members can divide questions
- Clear ownership of specific questions
- Easy to review and provide feedback

### 5. **Enhanced Exports**
- Reports clearly show answered questions first
- Unanswered questions summary for action items
- Better formatting in PDF, Word, PowerPoint, CSV

## Sample Q&A Structure

### PMESII-PT: Political Section
```json
{
  "political": [
    {
      "id": "uuid-1",
      "question": "What are the key political actors and their spheres of influence?",
      "answer": "Three main factions: Government coalition (45% support), Opposition alliance (35%), Independent tribal leaders (20%)"
    },
    {
      "id": "uuid-2",
      "question": "How stable is the current government structure?",
      "answer": "" // Unanswered - will appear in summary
    }
  ]
}
```

## Rollback Plan

If Q&A format proves problematic for any framework:
1. Change `itemType: 'qa'` back to default (text)
2. Existing Q&A data will still render (backwards compatible)
3. New entries will use text format

## Success Metrics

- **Adoption**: % of analyses using Q&A frameworks
- **Completion**: Average % of questions answered per analysis
- **Quality**: User feedback on Q&A vs text format
- **Efficiency**: Time to complete Q&A vs text analysis

## Recommendation

**Start with Phase 1** (4 intelligence frameworks) as they naturally align with Q&A format and will provide immediate value to intelligence analysts.

Monitor usage and feedback before proceeding to Phase 2.
