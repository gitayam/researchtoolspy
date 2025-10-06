# Nested Behavior Analysis & Library Enhancement Plan

## 🎯 Vision: Behavior Analysis as a Composable Library

Transform behavior analyses from standalone documents into a **linked, hierarchical library** where complex behaviors are composed of simpler sub-behaviors, creating a rich knowledge graph of human behavior patterns.

---

## 📊 Current System Review

### ✅ What Works Well:
1. **Basic Behavior Documentation**
   - Location context (where behaviors occur)
   - Temporal context (when/how often)
   - Settings (in-person, online, etc.)
   - Timeline with events

2. **Public Sharing**
   - Share tokens for public access
   - Clone to workspace or localStorage
   - View/clone counters

3. **Report Generation**
   - Markdown exports
   - AI enhancements (summary, insights, recommendations)
   - Multiple format exports

### ❌ Current Limitations:

**1. Flat Timeline Structure**
- Sub-steps are just text, not reusable behaviors
- No way to link to existing behavior analyses
- No hierarchical composition

**2. Limited Discovery/Filtering**
- Basic public view, but no browse/filter page
- Can't search by:
  - Capability requirements (physical, cognitive)
  - Location patterns (urban, rural, online)
  - Behavior type (civic, health, economic)
  - Setting (in-person, app-based, hybrid)
  - Frequency (daily, seasonal, one-time)

**3. Report Lacks Depth**
- Doesn't show behavioral chains/hierarchies
- Can't visualize how complex behaviors break down
- Missing behavior pattern library value

---

## 🏗️ Architecture: Nested Behavior Analysis

### Concept: Behaviors Contain Behaviors

```
🏛️ "Voting in USA General Election" (Complex Process)
  ├── 📋 "Voter Registration" (Simple Sequence)
  │   ├── 📝 "Fill Online Form" (Single Action)
  │   ├── 📧 "Receive Confirmation Email" (Single Action)
  │   └── 📬 "Verify Registration Status" (Single Action)
  │
  ├── 📚 "Research Candidates & Issues" (Complex Process)
  │   ├── 📰 "Read News Articles" (Single Action)
  │   ├── 🎥 "Watch Debates" (Single Action)
  │   └── 💬 "Discuss with Community" (Ongoing Practice)
  │
  ├── 🗳️ "Cast Ballot" (Simple Sequence)
  │   ├── 🚗 "Travel to Polling Station" (Single Action)
  │   ├── ⏳ "Wait in Line" (Single Action)
  │   ├── 🖊️ "Mark Ballot" (Single Action)
  │   └── 📤 "Submit Ballot" (Single Action)
  │
  └── ✅ "Verify Vote Counted" (Simple Sequence)
```

### Benefits:
- ✅ **Reusability**: "Fill Online Form" can be used across many behaviors
- ✅ **Composability**: Build complex behaviors from simpler ones
- ✅ **Knowledge Transfer**: Understand patterns across domains
- ✅ **Scalability**: Library grows exponentially with composition

---

## 💾 Data Model Changes

### 1. Enhanced TimelineEvent Type

```typescript
interface TimelineEvent {
  id: string
  label: string
  time?: string
  description?: string
  location?: string
  is_decision_point?: boolean

  // NEW: Nested behavior support
  linked_behavior_id?: string        // Link to existing behavior analysis
  linked_behavior_title?: string     // Cache for display
  linked_behavior_type?: string      // Cache: 'single_action' | 'simple_sequence' | 'complex_process' | 'ongoing_practice'

  // Traditional sub-steps (for simple text breakdowns)
  sub_steps?: TimelineSubStep[]

  // Forks (alternative paths)
  forks?: TimelineFork[]
}
```

### 2. Behavior Search Index

Add to framework_sessions:
```sql
-- Already have: location_context, behavior_settings, temporal_context, complexity
-- Add for better filtering:
ALTER TABLE framework_sessions ADD COLUMN capability_tags TEXT; -- JSON array: ['physical_low', 'cognitive_medium', 'digital_required']
ALTER TABLE framework_sessions ADD COLUMN behavior_type TEXT; -- 'civic', 'health', 'economic', 'social', 'environmental'
ALTER TABLE framework_sessions ADD COLUMN audience_tags TEXT; -- JSON array: ['elderly', 'urban', 'low_income']
```

---

## 🎨 UI/UX Enhancements

### 1. Timeline Event with Behavior Linking

**In Timeline Editor (`TimelineEditor.tsx`):**

```tsx
interface TimelineEventEditorProps {
  event: TimelineEvent
  onChange: (event: TimelineEvent) => void
}

// For each timeline event, show:
<Card>
  <CardHeader>
    <h4>{event.label}</h4>
    {event.linked_behavior_id && (
      <Badge variant="outline">
        <Link className="h-3 w-3 mr-1" />
        Linked: {event.linked_behavior_title}
      </Badge>
    )}
  </CardHeader>

  <CardContent>
    <Tabs>
      <TabsList>
        <TabsTrigger value="simple">Simple Sub-steps</TabsTrigger>
        <TabsTrigger value="linked">Link Behavior</TabsTrigger>
        <TabsTrigger value="create">Create New Behavior</TabsTrigger>
      </TabsList>

      <TabsContent value="simple">
        {/* Current sub-steps editor */}
        <SubStepsEditor subSteps={event.sub_steps} onChange={...} />
      </TabsContent>

      <TabsContent value="linked">
        <BehaviorSearchDialog
          onSelect={(behavior) => {
            onChange({
              ...event,
              linked_behavior_id: behavior.id,
              linked_behavior_title: behavior.title,
              linked_behavior_type: behavior.complexity
            })
          }}
        />
      </TabsContent>

      <TabsContent value="create">
        <Button onClick={() => {
          // Save current state
          // Open new behavior form with pre-filled title from event.label
          // On save, link it back
          navigate(`/frameworks/behavior/create?from_event=${event.id}&title=${event.label}`)
        }}>
          Create "{event.label}" as Behavior Analysis
        </Button>
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

### 2. Behavior Search/Filter Dialog

**New Component: `BehaviorSearchDialog.tsx`**

```tsx
interface BehaviorSearchDialogProps {
  onSelect: (behavior: BehaviorMetadata) => void
}

// Features:
- Search by title
- Filter by:
  - Location (specific cities/regions)
  - Setting (in-person, online, app, phone)
  - Complexity (single action → complex process)
  - Frequency (daily, weekly, seasonal, etc.)
  - Category (health, civic, economic)
  - Capability requirements

- Display:
  - Title + description
  - Location badges
  - Complexity badge
  - Setting icons
  - Preview button
```

### 3. Public Behavior Library Browse Page

**New Page: `PublicBehaviorLibraryPage.tsx`**

```tsx
// URL: /behaviors/library

Features:
1. Filter Panel (left sidebar)
   - Location search/filter
   - Setting checkboxes
   - Complexity slider
   - Frequency selector
   - Category tags
   - Capability tags

2. Results Grid
   - Card view with:
     - Title + description snippet
     - Location badges
     - Setting icons
     - Complexity indicator
     - View/clone counts
     - "View" and "Clone" buttons

3. Sort Options
   - Most viewed
   - Most cloned
   - Recently added
   - Alphabetical

4. Search Bar
   - Full-text search across title + description
   - Keyword highlighting
```

---

## 📄 Enhanced Report Generation

### 1. Hierarchical Behavior Report

```markdown
# Voting in USA General Election - Behavior Analysis Report

**Title:** Voting in USA General Election
**Complexity:** Complex Process
**Locations:** United States (National), Urban & Rural areas
**Settings:** In-person, Online (registration)
**Frequency:** Every 2-4 years

---

## 🗺️ Behavior Timeline (Hierarchical)

### 1. Voter Registration (Simple Sequence) 📋
**Estimated Time:** 10-20 minutes
**Setting:** Online

This step breaks down into:
- **1.1 Fill Online Form** (Single Action) → [View detailed behavior](/public/framework/abc123)
  - Access state voter registration website
  - Enter personal information (name, address, DOB)
  - Upload ID documentation

- **1.2 Receive Confirmation Email** (Single Action)
  - Check email within 24-48 hours
  - Verify registration details

- **1.3 Verify Registration Status** (Single Action) → [View detailed behavior](/public/framework/def456)
  - Return to website 1 week later
  - Confirm active registration

### 2. Research Candidates & Issues (Complex Process) 📚
**Estimated Time:** 2-4 weeks
**Setting:** Hybrid (Online, In-person, Social)

[View full "Research Candidates & Issues" behavior analysis →](/public/framework/ghi789)

Key sub-behaviors:
- Read news articles (Ongoing)
- Watch debates (Seasonal)
- Discuss with community (Ongoing)

### 3. Cast Ballot (Simple Sequence) 🗳️
**Estimated Time:** 30-90 minutes
**Setting:** In-person
**Location:** Local polling station

This step breaks down into:
- **3.1 Travel to Polling Station** → [View detailed behavior](/public/framework/jkl012)
- **3.2 Wait in Line** (Single Action)
- **3.3 Mark Ballot** → [View detailed behavior](/public/framework/mno345)
- **3.4 Submit Ballot** (Single Action)

---

## 🔗 Linked Behavior Tree

```
Voting in USA General Election
├── Voter Registration
│   ├── Fill Online Form
│   ├── Receive Confirmation Email
│   └── Verify Registration Status
├── Research Candidates & Issues
│   ├── Read News Articles
│   ├── Watch Debates
│   └── Discuss with Community
├── Cast Ballot
│   ├── Travel to Polling Station
│   ├── Wait in Line
│   ├── Mark Ballot
│   └── Submit Ballot
└── Verify Vote Counted
```

---

## 📊 Behavior Composition Insights

This complex behavior is composed of **4 major sequences** containing **15 sub-behaviors**:
- 🔵 5 Single Actions
- 🟢 3 Simple Sequences
- 🟡 2 Complex Processes
- 🟣 1 Ongoing Practice

**Reusability Potential:**
- "Fill Online Form" can be applied to: tax filing, benefit applications, permit requests
- "Travel to Location" can be applied to: healthcare visits, government services, shopping
- "Verify Status Online" can be applied to: package tracking, application status, account verification
```

### 2. Report Export with Linked Behaviors

- **PDF Export:** Include hyperlinks to linked behavior reports
- **Word Export:** Include references with page numbers
- **Web Export:** Interactive tree view with expandable nodes

---

## 🚀 Implementation Phases

### Phase 1: Data Model & Backend (Week 1)
✅ Already done:
- Database schema for public sharing
- Share/clone APIs
- Public view page

🔨 To do:
1. Update TimelineEvent type with linked_behavior fields
2. Add capability_tags, behavior_type, audience_tags to framework_sessions
3. Create `/api/behaviors/search` endpoint with filters
4. Update clone API to preserve behavior links

### Phase 2: Timeline Behavior Linking (Week 2)
1. Update TimelineEditor with 3 modes: simple sub-steps, link existing, create new
2. Create BehaviorSearchDialog component
3. Implement "Create New Behavior from Event" flow
4. Update timeline display to show linked behaviors

### Phase 3: Public Library & Discovery (Week 3)
1. Create PublicBehaviorLibraryPage
2. Implement advanced filtering:
   - Location search (city, state, country)
   - Setting filters (checkboxes)
   - Complexity range
   - Frequency selector
   - Capability tags
3. Add sort options (views, clones, date)
4. Add full-text search

### Phase 4: Enhanced Reporting (Week 4)
1. Update report generator to handle nested behaviors
2. Generate hierarchical markdown
3. Create behavior tree visualization
4. Add composition insights
5. Implement interactive web report with expandable tree

---

## 🎯 Success Metrics

1. **Library Growth**
   - Number of public behaviors
   - Number of linked behaviors
   - Average nesting depth
   - Reuse rate (behaviors linked >1 time)

2. **User Engagement**
   - Search queries per session
   - Clone rate from library
   - Filter usage patterns
   - Most cloned behaviors

3. **Knowledge Value**
   - Coverage of behavior types
   - Geographic diversity
   - Domain diversity (civic, health, economic)
   - Complexity distribution

---

## 🔍 Example Use Cases

### Use Case 1: Healthcare Worker Creating Vaccine Distribution Plan
1. Browse library for "Vaccine Administration" behaviors
2. Find "Flu Shot at Pharmacy" (USA, In-person)
3. Clone and adapt for COVID-19 context
4. Link timeline events to:
   - "Patient Check-in" (existing behavior)
   - "Verify Insurance" (existing behavior)
   - "Administer Injection" (create new, specific to COVID-19)
   - "Schedule Follow-up" (existing behavior)

### Use Case 2: Policy Researcher Analyzing Voter Participation
1. Search for "Voting" behaviors filtered by:
   - Location: Urban vs Rural
   - Setting: In-person vs Mail-in
2. Compare timelines and complexity
3. Identify common barriers (linked to capability deficits)
4. Generate comparative report showing behavior chains

### Use Case 3: UX Designer Researching Mobile App Behaviors
1. Filter behaviors by:
   - Setting: "app"
   - Complexity: "single_action" to "simple_sequence"
2. Study common patterns across domains
3. Clone "Fill Form on Mobile" behavior
4. Adapt for their specific use case
5. Share back to library

---

## 📝 Next Immediate Steps

1. ✅ Update types/behavior.ts with nested behavior fields
2. ✅ Create BehaviorSearchDialog component
3. ✅ Update TimelineEditor with linking tabs
4. ✅ Create /api/behaviors/search endpoint
5. ✅ Build PublicBehaviorLibraryPage
6. ✅ Update report generator for hierarchical display
