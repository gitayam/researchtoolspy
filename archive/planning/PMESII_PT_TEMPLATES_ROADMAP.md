# PMESII-PT Question Templates Roadmap
**Date Created**: 2025-10-11
**Priority**: High
**Estimated Effort**: 3-4 hours

---

## Overview

Enhance PMESII-PT framework with question templates based on analysis type, enabling analysts to quickly populate location-based analyses with structured questions tailored to specific operational goals.

## Current State

- Analyst creates PMESII-PT analysis manually
- Location data required (country, region, time period)
- Questions entered manually across 8 dimensions
- No guided templates or starting points
- Each analysis starts from scratch

## Proposed Enhancement

### Question Template System

**Template Types by Operational Goal:**
1. **Information Operations** - Media landscape, social dynamics, influence campaigns
2. **Military Operations** - Force disposition, logistics, infrastructure
3. **Diplomatic/Political** - Government structure, decision-makers, alliances
4. **Economic Analysis** - Trade patterns, sanctions impact, financial systems
5. **Humanitarian Assessment** - Population needs, infrastructure gaps, risks
6. **General Assessment** - Comprehensive baseline for any location

### User Flow

```
1. Analyst creates new PMESII-PT analysis
2. Fills in location context (country, region, city, time period)
3. Selects analysis type from dropdown:
   [ ] Information Operations
   [ ] Military Operations
   [ ] Diplomatic/Political
   [ ] Economic Analysis
   [ ] Humanitarian Assessment
   [ ] General Assessment
   [ ] Custom (no template)

4. System pre-populates questions based on template + location
5. Analyst answers questions, adds/removes as needed
6. Location context informs question customization
```

---

## Template Structure

### Political Domain Templates

**Information Operations Focus:**
- What government entities control media narratives?
- Who are the key influencers and opinion leaders?
- What are the current political tensions or controversies?
- How does government messaging align with public sentiment?
- What opposition voices exist and what platforms do they use?

**Military Operations Focus:**
- Who holds political authority over military forces?
- What are the civil-military relationships?
- How do political factions align with military units?
- What political constraints affect military operations?
- Who are the key decision-makers for military action?

**Diplomatic/Political Focus:**
- Who are the heads of state and government?
- What is the structure of the political system?
- Who are the key ministries and their leaders?
- What are the current coalition dynamics?
- What international relationships define foreign policy?

### Military Domain Templates

**Information Operations Focus:**
- What military units are present and their public visibility?
- How does military communicate with civilian population?
- What military activities are reported in local media?
- How is military perceived by local population?

**Military Operations Focus:**
- What military units are stationed in the area?
- What is the command structure and force disposition?
- What are the military capabilities and readiness levels?
- What logistics and supply networks exist?
- What are the known military plans or exercises?

**Humanitarian Assessment Focus:**
- What is the military's role in security provision?
- Are there checkpoints or restricted areas?
- How does military presence affect civilian movement?
- What security threats exist from military activity?

### Economic Domain Templates

**Economic Analysis Focus:**
- What are the primary economic sectors?
- What trade relationships exist with other countries?
- How are sanctions (if any) impacting the economy?
- What currency and financial systems are in use?
- What are the unemployment and inflation rates?

**Information Operations Focus:**
- What economic grievances exist in the population?
- How do economic conditions affect information receptivity?
- What economic narratives are being pushed?

**Military Operations Focus:**
- What economic infrastructure is critical for logistics?
- How would military action impact the local economy?
- What financial systems support military operations?

### Social Domain Templates

**Information Operations Focus:**
- What are the primary demographics (age, ethnicity, religion)?
- What social media platforms are most used?
- What are the key social grievances or movements?
- Who are the community leaders and influencers?
- What cultural sensitivities exist?

**Humanitarian Assessment Focus:**
- What vulnerable populations exist?
- What are the primary humanitarian needs?
- What social services are available?
- What community organizations provide support?
- What displacement or migration patterns exist?

### Information Domain Templates

**Information Operations Focus:**
- What media outlets are most trusted?
- What are the primary information consumption patterns?
- What disinformation or propaganda campaigns are active?
- What censorship or information controls exist?
- What languages are used in local media?

**All Focuses:**
- What telecommunications infrastructure exists?
- What internet penetration and access levels exist?
- What social media usage patterns are observed?

### Infrastructure Domain Templates

**Military Operations Focus:**
- What transportation networks exist (roads, rail, ports, airports)?
- What critical infrastructure could be targeted or defended?
- What utilities infrastructure exists (power, water, fuel)?
- What communications infrastructure exists?
- What logistics hubs and supply routes exist?

**Humanitarian Assessment Focus:**
- What health infrastructure exists (hospitals, clinics)?
- What education infrastructure exists?
- What water and sanitation infrastructure exists?
- What infrastructure is damaged or non-functional?

### Physical Environment Domain Templates

**Military Operations Focus:**
- What is the terrain and how does it affect operations?
- What are the key geographic chokepoints?
- What natural obstacles or advantages exist?
- What weather patterns affect operations?

**Humanitarian Assessment Focus:**
- What environmental hazards exist (flooding, earthquakes)?
- What seasonal factors affect population needs?
- What natural resources are available?

**All Focuses:**
- What is the climate and weather patterns?
- What geographic features define the area?

### Time Domain Templates

**All Focuses:**
- What historical events shaped current conditions?
- What are the key dates and anniversaries that matter locally?
- What future events or deadlines are anticipated?
- What seasonal patterns affect the situation?
- What is the expected timeline for change?

---

## Implementation Plan

### Phase 1: Template Definition (1 hour)
1. Create template configurations in `/config/pmesii-templates.ts`
2. Define question sets for each operational focus
3. Map questions to PMESII-PT dimensions

### Phase 2: UI Integration (1 hour)
1. Add "Analysis Type" dropdown to PMESII-PT form
2. Add "Load Template" button after location selection
3. Create template preview/selection modal
4. Pre-populate questions from selected template

### Phase 3: Location-Aware Customization (1 hour)
1. Use location data (country, region) to customize questions
2. Fetch relevant entities (actors, places, events) for location
3. Pre-link suggested entities to template questions
4. Add location-specific context to question hints

### Phase 4: Template Management (1 hour)
1. Allow users to save custom templates
2. Share templates across team/workspace
3. Template versioning and updates
4. Export/import template definitions

---

## Data Structure

### Template Configuration

```typescript
export interface PMESIIPTTemplate {
  id: string
  name: string
  description: string
  operational_focus: 'info_ops' | 'military' | 'diplomatic' | 'economic' | 'humanitarian' | 'general'
  questions: {
    political: QuestionTemplate[]
    military: QuestionTemplate[]
    economic: QuestionTemplate[]
    social: QuestionTemplate[]
    information: QuestionTemplate[]
    infrastructure: QuestionTemplate[]
    physical: QuestionTemplate[]
    time: QuestionTemplate[]
  }
  priority: 'essential' | 'recommended' | 'optional'
  tags: string[]
}

export interface QuestionTemplate {
  id: string
  question: string
  hint?: string
  suggested_entities?: string[] // Actor types to look for
  suggested_sources?: string[] // Source types that might answer
  priority: 'critical' | 'important' | 'useful'
}
```

### Location-Aware Question Customization

```typescript
// Base template question
"What government entities control media narratives?"

// After location selection (e.g., Ukraine)
"What government entities in Ukraine control media narratives?"
+ Suggested actors: [Ukrainian Government, Ministry of Information Policy]
+ Suggested sources: [Ukrainian media outlets, government websites]
+ Related events: [Recent media law changes, censorship events]
```

---

## Success Metrics

### Adoption Metrics
- % of PMESII-PT analyses using templates
- Most popular template types
- Average questions per analysis (with vs without templates)
- Template completion rate

### Quality Metrics
- % of template questions answered
- Evidence links per question
- Entity links per analysis
- Time to complete analysis (with vs without templates)

### User Feedback
- Template relevance rating
- "Was this template helpful?" survey
- Custom template creation rate
- Template modification rate (how much do users deviate?)

---

## Integration with Existing Systems

### Entity Linking (Already Implemented)
- Template questions can suggest entity types to link
- Pre-populate actor search with location-specific entities
- Auto-link known entities based on location

### Evidence System
- Template questions can suggest evidence types
- Link to relevant evidence from Content Intelligence
- Pull evidence from Investigation Packets for location

### Content Intelligence
- Use analyzed content to answer template questions
- Map content entities to PMESII dimensions
- Auto-populate answers from scraped sources

### AI Assistance
- Use GPT to customize template questions for specific location
- Generate follow-up questions based on initial answers
- Suggest relevant sources and entities

---

## Example Use Case

**Scenario**: Analyst needs to assess Ukraine's information environment for IO campaign planning

**Without Templates:**
1. Creates blank PMESII-PT analysis
2. Manually thinks of questions for each dimension
3. Spends 2-3 hours brainstorming questions
4. May miss important aspects
5. Inconsistent depth across analyses

**With Templates:**
1. Creates PMESII-PT analysis, enters location: Ukraine
2. Selects "Information Operations" template
3. System loads 50+ pre-built questions across dimensions
4. Questions already include Ukraine context
5. Suggested entities: Ukrainian gov, Russian actors, media outlets
6. Begins answering questions immediately
7. Adds/modifies questions as needed
8. Analysis complete in 1 hour with comprehensive coverage

---

## Future Enhancements

### AI-Powered Template Generation
- Analyze past successful analyses to create new templates
- Generate custom templates based on user's analysis history
- Learn which questions are most valuable for each goal

### Collaborative Templates
- Share templates across organization
- Rate and review templates
- Version control and update notifications
- Template marketplace for best practices

### Dynamic Templates
- Update templates based on real-time events
- Location-specific templates auto-update with current situation
- Integration with news/intel feeds for relevant questions

### Template Analytics
- Which questions get answered most?
- Which questions produce most insights?
- Which templates lead to best outcomes?
- Optimize templates based on usage data

---

## Implementation Priority

**HIGH PRIORITY** - This feature significantly reduces analyst cognitive load and ensures comprehensive location-based analysis. It aligns with the core value proposition of structured intelligence frameworks.

**Quick Win**: Can start with 2-3 template types and expand based on user feedback.

**Estimated Total Effort**: 3-4 hours for basic implementation, 8-10 hours for full feature set with AI customization.

---

## Next Steps

1. Review and approve template question sets
2. Validate with intelligence analysts
3. Build template configuration system
4. Integrate into PMESII-PT form
5. Deploy and gather user feedback
6. Iterate based on usage patterns
