# Starbursting Framework Improvement Plan
**Date Created**: 2025-10-11
**Framework Type**: Creative/Exploratory Analysis (5W1H Method)

---

## Current State Analysis

### ✅ Strengths (Already Implemented)
1. **AI Question Generation** - Uses `/api/ai/scrape-url` for automated question extraction
2. **Content Intelligence Integration** - Can launch from analyzed content
3. **Multi-Source Support** - Aggregates questions from multiple content analyses
4. **Categorized Structure** - Properly organized into 6 categories (Who, What, When, Where, Why, How)
5. **Q&A Format** - Each question can have an answer, priority, status tracking

### ❌ Gaps (Not Yet Implemented)
1. **No Entity Linking** - "Who" questions don't link to Actors
2. **No Place Linking** - "Where" questions don't link to Places
3. **No Event Linking** - "When" questions don't link to Events
4. **No Evidence Support** - Answers lack evidence backing
5. **Limited Question Templates** - No starter questions to guide users
6. **No Priority Visualization** - Can't easily see high-priority unanswered questions
7. **No Cross-Framework Intelligence** - Can't see if other frameworks answered similar questions

---

## Improvement Priorities

### 🔥 Priority 1: Entity Linking for "Who" Questions (2 hours)

**Goal**: Link "Who" questions to the Actors system for credibility tracking and cross-analysis.

**Implementation**:
```typescript
// Current Q&A Structure
{
  id: string
  question: string
  answer?: string
  category: 'who' | 'what' | 'when' | 'where' | 'why' | 'how'
  priority?: number
  status?: 'pending' | 'answered'
}

// After Entity Linking
{
  id: string
  question: string
  answer?: string
  category: 'who' | 'what' | 'when' | 'where' | 'why' | 'how'
  priority?: number
  status?: 'pending' | 'answered'
  linked_actors?: LinkedActor[]     // NEW - for "who" questions
  linked_places?: LinkedPlace[]     // NEW - for "where" questions
  linked_events?: LinkedEvent[]     // NEW - for "when" questions
  evidence_ids?: string[]           // NEW - supporting evidence
}
```

**UI Changes**:
- Add "Link Actors" button on "Who" questions
- Add "Link Places" button on "Where" questions
- Add "Link Events" button on "When" questions
- Display linked entities as badges next to answers
- Show entity credibility scores

**Value**:
- Analysts can pivot from questions to entity profiles
- Entity credibility informs answer reliability
- Track which actors are mentioned across multiple questions
- Build network graphs from question relationships

**Example Use Case**:
```
Q: Who are the key decision-makers in this situation?
A: Vladimir Putin (President), Sergei Lavrov (Foreign Minister)
🏛️ Vladimir Putin (President of Russia) [Credibility: Medium]
👤 Sergei Lavrov (Foreign Minister) [Credibility: Low]
```

---

### 🔥 Priority 2: Enhanced Question Templates & AI Suggestions (1 hour)

**Goal**: Provide guided question starters and AI-powered follow-up suggestions.

**Question Templates by Category**:

**Who Questions**:
- Who are the primary stakeholders?
- Who benefits from this situation?
- Who has the authority to make decisions?
- Who are the influencers or opinion leaders?
- Who might oppose this?
- Who are the experts on this topic?

**What Questions**:
- What is the core issue or problem?
- What are the stated objectives?
- What evidence supports this?
- What are the alternative explanations?
- What are the potential consequences?
- What assumptions are being made?

**When Questions**:
- When did this situation begin?
- When are key decisions being made?
- When have similar situations occurred?
- When is the critical timeframe?
- When will we see outcomes?
- When do deadlines occur?

**Where Questions**:
- Where is this occurring geographically?
- Where are the stakeholders located?
- Where could this spread or expand?
- Where are safe zones or areas of concern?
- Where is evidence being collected?
- Where should resources be deployed?

**Why Questions**:
- Why is this happening now?
- Why are actors motivated to act?
- Why is this significant?
- Why might deception be present?
- Why are some perspectives being emphasized?
- Why might this fail or succeed?

**How Questions**:
- How did this situation develop?
- How are actors coordinating?
- How can we verify claims?
- How might this evolve?
- How can we influence outcomes?
- How do we measure success?

**Implementation**:
1. Add "Suggested Questions" dropdown for each category
2. AI generates 3-5 custom questions based on framework context
3. One-click to add suggested question to framework
4. Track which questions came from AI vs user

---

### 🔥 Priority 3: Evidence Linking for Answers (1 hour)

**Goal**: Support answers with evidence items for credibility.

**Implementation**:
- Reuse existing EvidenceLinker component
- Add "Link Evidence" button next to each answer
- Display evidence count badge: 📎 3 evidence items
- Show aggregate evidence credibility
- Highlight answers with no evidence support

**Enhanced Answer Structure**:
```typescript
{
  question: "Who are the primary actors?",
  answer: "Three state-sponsored groups: APT28, APT29, APT32",
  linked_actors: [...],
  evidence_ids: ["evt_001", "evt_002", "evt_003"],
  evidence_summary: {
    count: 3,
    avg_credibility: 4.2,
    sources: ["Reuters", "NYT", "AP"]
  }
}
```

---

### 🔥 Priority 4: Smart Question Status Dashboard (1 hour)

**Goal**: Visualize question completion and priority at a glance.

**Dashboard Sections**:
1. **Progress Overview**
   - X of Y questions answered
   - Category breakdown (Who: 5/7, What: 3/4, etc.)
   - Priority distribution

2. **High-Priority Unanswered**
   - Quick list of critical pending questions
   - Sort by priority and category

3. **Recently Answered**
   - Show recent progress
   - Link to evidence

4. **AI Suggestions**
   - "You might want to ask..."
   - Based on answered questions, generate follow-ups

**Visual Indicators**:
- 🟢 Answered with evidence
- 🟡 Answered without evidence
- 🔴 Unanswered high-priority
- ⚪ Unanswered low-priority

---

### 💡 Priority 5: Cross-Framework Intelligence (2 hours)

**Goal**: Show when other frameworks have answered similar questions.

**Features**:
1. **Similar Question Detection**
   - Scan other frameworks for matching questions
   - Use semantic similarity (not just exact match)

2. **Answer Import**
   - "Copy answer from COG Analysis #42"
   - Preserve source attribution

3. **Question Relationship Graph**
   - Visualize which questions are interdependent
   - "If you answer X, you might be able to answer Y"

**Example**:
```
Question: "Who has the authority to make decisions?"
💡 Similar question answered in:
   - COG Analysis #42: "Decision Authority"
   - PMESII-PT #18: Political Leaders
   [Import Answers] button
```

---

### 💡 Priority 6: Export & Reporting Improvements (1 hour)

**Current Export**: Basic Q&A list

**Enhanced Export**:
1. **Categorized PDF Report**
   - Section per category
   - Show linked entities with icons
   - Include evidence references
   - Priority highlights

2. **Briefing Slides**
   - One slide per high-priority question
   - Visual entity relationships
   - Evidence snapshots

3. **Executive Summary**
   - Top 10 critical questions + answers
   - Entity network diagram
   - Evidence credibility breakdown

---

## Implementation Roadmap

### Phase 1: Entity Linking (Immediate - 2 hours)
- ✅ Reuse ActorLinker component from PMESII-PT
- ✅ Create PlaceLinker component (similar pattern)
- ✅ Create EventLinker component (similar pattern)
- Update Starbursting Q&A structure to include entity links
- Update GenericFrameworkForm to show entity linking for Starbursting

### Phase 2: Evidence Support (Short-term - 1 hour)
- Add evidence linking to Q&A items
- Display evidence badges
- Show credibility aggregates

### Phase 3: Enhanced Templates (Short-term - 1 hour)
- Add question templates to config
- Create AI suggestion API
- Build template picker UI

### Phase 4: Smart Dashboard (Medium-term - 1 hour)
- Build progress visualization
- Create priority filter
- Add status indicators

### Phase 5: Cross-Framework Intelligence (Long-term - 2 hours)
- Implement semantic search
- Build answer import UI
- Create relationship mapper

### Phase 6: Enhanced Export (Long-term - 1 hour)
- Upgrade PDF export
- Add slide generation
- Build executive summary

---

## Quick Win: Phase 1 Implementation

Since we just built ActorLinker for PMESII-PT, we can quickly add entity linking to Starbursting:

**Changes Needed**:
1. Update Starbursting Q&A TypeScript types to include entity links
2. Modify SectionCard component to detect question category and show appropriate linker
3. Add PlaceLinker and EventLinker components (copy ActorLinker pattern)
4. Update save logic to persist entity links
5. Update display to show entity badges next to answers

**Estimated Time**: 2 hours (can leverage 90% of PMESII-PT code)

**Immediate Value**:
- Analysts can track which actors appear in which questions
- Place and event tracking for situational awareness
- Cross-reference entities across frameworks

---

## Success Metrics

### Usability Metrics
- Time to complete a Starbursting analysis (target: 50% reduction)
- Questions generated per analysis (target: 30+ questions)
- Answer completion rate (target: 80%+)

### Quality Metrics
- Questions with evidence support (target: 60%+)
- Entity linking usage (target: 50% of "Who" questions)
- Cross-framework answer reuse (target: 20%)

### Adoption Metrics
- Starbursting analyses created per month
- Average questions per analysis
- User satisfaction rating

---

## Technical Notes

### Reusable Components
- ActorLinker (already built)
- EvidenceLinker (already exists)
- PlaceLinker (needs creation)
- EventLinker (needs creation)

### API Endpoints Needed
- `/api/entities/places` (search places)
- `/api/entities/events` (search events)
- `/api/frameworks/similar-questions` (semantic search)
- `/api/ai/suggest-questions` (AI follow-ups)

### Database Schema
- No schema changes needed for Phase 1
- Entity links stored in framework data JSON
- Phase 5 may need `framework_question_relationships` table

---

## Conclusion

Starbursting is already a strong framework with AI integration. The highest-value improvements are:

1. **Entity Linking** (2 hours) - Immediate tactical value
2. **Evidence Support** (1 hour) - Validates answers
3. **Question Templates** (1 hour) - Reduces cognitive load

These 4 hours of work would transform Starbursting from a basic Q&A tool into a fully integrated intelligence framework with entity tracking, evidence validation, and cross-framework intelligence.

**Recommendation**: Start with Phase 1 (Entity Linking) since we already have ActorLinker from PMESII-PT. This can be completed in a single session and provides immediate value.
