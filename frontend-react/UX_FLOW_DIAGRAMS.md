# UX Flow Diagrams: Content-First Intelligence Platform

**Document Version:** 1.0
**Date:** 2025-10-08

---

## Flow 1: Non-Authenticated User - First Visit

```
┌─────────────────────────────────────────────────────────────┐
│                    Landing Page                             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [HERO SECTION]                                       │  │
│  │                                                       │  │
│  │  Analyze Intelligence Sources Instantly               │  │
│  │                                                       │  │
│  │  ┌────────────────────────────────────────┐          │  │
│  │  │  Enter URL to analyze...               │ [Analyze]│  │
│  │  └────────────────────────────────────────┘          │  │
│  │                                                       │  │
│  │  No account required • Save with bookmark hash       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ User enters URL, clicks "Analyze"
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Analysis Progress (Real-time)                  │
│                                                             │
│  ⏳ Extracting content... [████████░░] 80%                 │
│                                                             │
│  Quick Actions (available during processing):               │
│  [VirusTotal Security] [12ft.io Bypass] [Archive.is]       │
│                                                             │
│  Country Detection: 🇷🇺 Russia (Москва) - Hosted by ...   │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ Processing complete
                             ▼
┌─────────────────────────────────────────────────────────────┐
│             Content Analysis Results                        │
│                                                             │
│  📄 Russian Military Operations in Ukraine                 │
│  example.com • By John Doe • Jan 15, 2025                  │
│  Word Count: 3,500 | 👥 12 Actors | 📍 5 Locations         │
│                                                             │
│  [Tabs: Overview | Word Analysis | Entities | Q&A]         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🎯 Suggested Analysis Frameworks                    │   │
│  │                                                     │   │
│  │ ✓ PMESII-PT (92% confidence)                       │   │
│  │   Political, military, economic analysis detected  │   │
│  │   [Use This Framework] → Auto-populate fields      │   │
│  │                                                     │   │
│  │ ✓ DIME (85% confidence)                            │   │
│  │   Diplomatic, information, military, economic      │   │
│  │   [Use This Framework]                             │   │
│  │                                                     │   │
│  │ ✓ COG (78% confidence)                             │   │
│  │   Center of gravity analysis applicable            │   │
│  │   [Use This Framework]                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Extracted Entities                                  │   │
│  │                                                     │   │
│  │ 👥 People: Vladimir Putin (12×), Zelenskyy (8×)    │   │
│  │ 🏢 Orgs: Russian Armed Forces (25×)                │   │
│  │ 📍 Places: Kyiv (15×), Moscow (10×)                │   │
│  │                                                     │   │
│  │ [Save All to Workspace] ← Requires sign-in         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠️  Sign in to save this analysis permanently             │
│  Your analysis is saved temporarily with bookmark hash     │
│  [Create Account] [Sign In]                                │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ User clicks "Use This Framework" (PMESII-PT)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│        ⚠️  Account Required for Frameworks                  │
│                                                             │
│  To create and save analysis frameworks, you need an       │
│  account. Your current analysis is saved with a bookmark   │
│  hash and will be available after registration.            │
│                                                             │
│  [Create Free Account] [Sign In]                           │
│                                                             │
│  Or continue browsing:                                      │
│  [View Framework Templates] [Explore Public Library]       │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 2: Non-Authenticated User → Registration → Data Migration

```
┌─────────────────────────────────────────────────────────────┐
│  Non-Authenticated User has analyzed 5 URLs                 │
│  Bookmark Hash: temp_abc123...                              │
│  workspace_id: 'temp_abc123...'                             │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ User clicks "Create Account"
                             ▼
┌─────────────────────────────────────────────────────────────┐
│             Registration Form                               │
│                                                             │
│  Email: ___________________                                 │
│  Password: ________________                                 │
│  Confirm: _________________                                 │
│                                                             │
│  ✓ Migrate my 5 saved analyses to my account               │
│  ✓ Keep my bookmark hash as backup access                  │
│                                                             │
│  [Create Account]                                           │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ Account created, token issued
                             ▼
┌─────────────────────────────────────────────────────────────┐
│          🔄 Migrating Your Data...                          │
│                                                             │
│  ✓ Creating personal workspace                             │
│  ✓ Migrating 5 content analyses                            │
│  ✓ Migrating 12 extracted entities                         │
│  ✓ Migrating 2 saved links                                 │
│  ⏳ Updating workspace references...                        │
│                                                             │
│  Progress: [████████░░] 80%                                │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ Migration complete
                             ▼
┌─────────────────────────────────────────────────────────────┐
│          ✅ Welcome to ResearchTools!                       │
│                                                             │
│  Your temporary analyses have been migrated to your         │
│  personal workspace:                                        │
│                                                             │
│  • 5 content analyses                                       │
│  • 12 extracted entities (actors, places)                   │
│  • 2 saved links                                            │
│                                                             │
│  [Go to Dashboard] [View My Content]                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 3: Authenticated User - Landing Page → Framework Creation

```
┌─────────────────────────────────────────────────────────────┐
│             Landing Page (Authenticated)                    │
│                                                             │
│  Header: [Logo] [Analyze] [Dashboard] [Profile ▼]          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [HERO SECTION]                                       │  │
│  │                                                       │  │
│  │  ┌────────────────────────────────────────┐          │  │
│  │  │  Enter URL to analyze...               │ [Analyze]│  │
│  │  └────────────────────────────────────────┘          │  │
│  │                                                       │  │
│  │  Recent Analyses (Last 5):                           │  │
│  │  • Russian Military Ops (Oct 8)    [Re-analyze]      │  │
│  │  • US Defense Budget (Oct 7)       [Re-analyze]      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ User enters URL, clicks "Analyze"
                             ▼
┌─────────────────────────────────────────────────────────────┐
│        Analysis Results (Same as Flow 1)                    │
│                                                             │
│  ✅ Analysis auto-saved to workspace "Personal"            │
│  📊 Framework Suggestions: PMESII-PT, DIME, COG            │
│                                                             │
│  [Extracted Entities]                                       │
│  👥 Vladimir Putin, Zelenskyy, Russian Armed Forces        │
│  [Save All to Workspace] ← Now enabled!                    │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ User clicks "Save All to Workspace"
                             ▼
┌─────────────────────────────────────────────────────────────┐
│          ✅ Entities Saved                                  │
│                                                             │
│  Created 3 actors, 2 places in workspace "Personal"        │
│                                                             │
│  • Vladimir Putin → Actors                                  │
│  • Volodymyr Zelenskyy → Actors                            │
│  • Russian Armed Forces → Actors                           │
│  • Kyiv → Places                                            │
│  • Moscow → Places (merged with existing)                  │
│                                                             │
│  [View Actors] [Continue Analysis]                         │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ User clicks "Use This Framework" (PMESII-PT)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│      🤖 Auto-Populating PMESII-PT Framework...              │
│                                                             │
│  Analyzing content with GPT-5-mini...                       │
│  ✓ Political analysis extracted                            │
│  ✓ Military capabilities identified                        │
│  ⏳ Economic factors analyzing...                           │
│                                                             │
│  Progress: [██████░░░░] 60%                                │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ Auto-population complete
                             ▼
┌─────────────────────────────────────────────────────────────┐
│     PMESII-PT Framework - Russian Military Ops              │
│     (Review Auto-Populated Data)                            │
│                                                             │
│  ⚠️  This framework was auto-populated by AI. Review all   │
│  fields before saving. Yellow highlights = AI-generated.    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ POLITICAL (Confidence: 85%) [⚠️ AI-Generated]       │   │
│  │                                                     │   │
│  │ • Kremlin centralized decision-making under Putin  │   │
│  │   Source: Paragraph 3, 7 [View Context]           │   │
│  │                                                     │   │
│  │ • Diplomatic isolation from Western nations        │   │
│  │   Source: Paragraph 12 [View Context]             │   │
│  │                                                     │   │
│  │ [✓ Accept] [✗ Reject] [✎ Edit]                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ MILITARY (Confidence: 92%) [⚠️ AI-Generated]        │   │
│  │                                                     │   │
│  │ • 150,000+ troops deployed to Ukraine border       │   │
│  │   Source: Paragraph 5 [View Context]               │   │
│  │                                                     │   │
│  │ • Combined arms operations: armor, artillery, air  │   │
│  │   Source: Paragraph 9, 15 [View Context]           │   │
│  │                                                     │   │
│  │ [✓ Accept] [✗ Reject] [✎ Edit]                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [... 6 more PMESII-PT categories ...]                     │
│                                                             │
│  Overall Confidence: 82%                                    │
│  [Accept All & Save] [Review Field-by-Field]               │
│  [Discard & Start Fresh]                                   │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ User clicks "Accept All & Save"
                             ▼
┌─────────────────────────────────────────────────────────────┐
│     ✅ PMESII-PT Framework Created                          │
│                                                             │
│  Framework "Russian Military Operations Analysis" saved    │
│  to workspace "Personal"                                    │
│                                                             │
│  Linked to:                                                 │
│  • 1 content source (example.com article)                  │
│  • 5 actors (Putin, Zelenskyy, etc.)                       │
│  • 2 places (Kyiv, Moscow)                                 │
│                                                             │
│  [View Framework] [Export to PDF] [Share]                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 4: Content Usage Dashboard - Bidirectional Linking

```
┌─────────────────────────────────────────────────────────────┐
│         Content Analysis Details                            │
│         example.com/article                                 │
│                                                             │
│  [Tabs: Overview | Usage | Timeline | Export]              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ USAGE TAB                                           │   │
│  │                                                     │   │
│  │ This content is used in:                           │   │
│  │                                                     │   │
│  │ 📊 Frameworks (2):                                 │   │
│  │ ├─ PMESII-PT: Russian Military Ops (Oct 8)        │   │
│  │ │  Auto-populated: Political, Military, Economic  │   │
│  │ │  [View Framework]                               │   │
│  │ │                                                  │   │
│  │ └─ DIME: Ukraine Conflict Analysis (Oct 8)        │   │
│  │    Manual entry, cited as source                  │   │
│  │    [View Framework]                               │   │
│  │                                                     │   │
│  │ 📝 Evidence Items (3):                             │   │
│  │ ├─ "Russian troop deployment estimates"           │   │
│  │ │  Source: Paragraph 5 | Credibility: 4/6         │   │
│  │ │  [View Evidence]                                │   │
│  │ │                                                  │   │
│  │ ├─ "Economic sanctions impact"                    │   │
│  │ │  Source: Paragraph 11 | Credibility: 5/6        │   │
│  │ │  [View Evidence]                                │   │
│  │ │                                                  │   │
│  │ └─ "Diplomatic isolation assessment"              │   │
│  │    Source: Paragraph 12 | Credibility: 4/6        │   │
│  │    [View Evidence]                                │   │
│  │                                                     │   │
│  │ 👥 Entities Extracted (5):                         │   │
│  │ • Vladimir Putin (Actor - Person)                  │   │
│  │ • Russian Armed Forces (Actor - Organization)     │   │
│  │ • Kyiv (Place - City)                             │   │
│  │ • Moscow (Place - City)                           │   │
│  │ • Volodymyr Zelenskyy (Actor - Person)            │   │
│  │                                                     │   │
│  │ [View Entity Graph]                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Last accessed: Oct 8, 2025 11:30 AM                       │
│  Access count: 5 times                                      │
│                                                             │
│  [Re-analyze Content] [Delete Analysis]                    │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ User clicks "View Framework" (PMESII-PT)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│     PMESII-PT Framework View                                │
│     Russian Military Operations Analysis                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📎 SOURCE CONTENT                                   │   │
│  │                                                     │   │
│  │ 🔗 Russian Military Operations in Ukraine          │   │
│  │    example.com | Jan 15, 2025 | By John Doe       │   │
│  │    [View Full Content] [View Usage]                │   │
│  │                                                     │   │
│  │    Auto-populated fields:                          │   │
│  │    • Political (paragraphs 3, 7, 12)               │   │
│  │    • Military (paragraphs 5, 9, 15, 18)            │   │
│  │    • Economic (paragraphs 11, 14, 20)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Political] [Military] [Economic] [Social] [...]          │
│                                                             │
│  MILITARY Analysis:                                         │
│  • 150,000+ troops deployed 📎 Source: Para 5              │
│  • Combined arms operations 📎 Source: Para 9, 15          │
│  • Equipment losses: 500+ tanks 📎 Source: Para 18         │
│                                                             │
│  [Edit] [Export] [Share]                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 5: Entity Detail View - Reverse Content Lookup

```
┌─────────────────────────────────────────────────────────────┐
│         Actor Details: Vladimir Putin                       │
│                                                             │
│  Type: Person | Role: President | Affiliation: Russia      │
│  Workspace: Personal                                        │
│                                                             │
│  [Tabs: Overview | Content Sources | Relationships |       │
│         Deception Profile | Timeline]                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CONTENT SOURCES TAB                                 │   │
│  │                                                     │   │
│  │ Mentioned in 3 analyzed content sources:           │   │
│  │                                                     │   │
│  │ 1. Russian Military Operations in Ukraine          │   │
│  │    example.com | Oct 8, 2025                       │   │
│  │    Mentioned 12 times | Confidence: 95%            │   │
│  │    Context: "Putin ordered military operation..." │   │
│  │    [View Content]                                  │   │
│  │                                                     │   │
│  │ 2. Kremlin Decision-Making Analysis                │   │
│  │    kremlin-watch.org | Oct 5, 2025                 │   │
│  │    Mentioned 28 times | Confidence: 98%            │   │
│  │    Context: "Putin centralized power in Kremlin..."│   │
│  │    [View Content]                                  │   │
│  │                                                     │   │
│  │ 3. Russia-Ukraine Diplomacy Timeline               │   │
│  │    reuters.com | Oct 3, 2025                       │   │
│  │    Mentioned 7 times | Confidence: 92%             │   │
│  │    Context: "Putin rejected peace proposals..."    │   │
│  │    [View Content]                                  │   │
│  │                                                     │   │
│  │ Total mentions across all content: 47              │   │
│  │ Average confidence: 95%                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ FRAMEWORKS ANALYZING THIS ACTOR                     │   │
│  │                                                     │   │
│  │ • PMESII-PT: Russian Military Ops (Oct 8)          │   │
│  │   Mentioned in: Political, Military sections       │   │
│  │                                                     │   │
│  │ • COG: Russian Leadership (Oct 7)                  │   │
│  │   Role: Critical Capability - Decision Authority   │   │
│  │                                                     │   │
│  │ • Causeway: Ukraine Conflict Network (Oct 6)       │   │
│  │   Node type: Key Decision Maker                    │   │
│  │   Connections: 12 actors, 5 organizations          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 6: Content Update Alert - Stale Data Detection

```
┌─────────────────────────────────────────────────────────────┐
│         Dashboard Notifications                             │
│                                                             │
│  ⚠️  Content Update Alert                                   │
│                                                             │
│  The source content for framework "Russian Military Ops"   │
│  was analyzed 90 days ago. The source may have been        │
│  updated since then.                                        │
│                                                             │
│  Framework: PMESII-PT - Russian Military Ops                │
│  Source: example.com/article                                │
│  Last analyzed: July 10, 2025                              │
│  Age: 90 days (threshold: 90 days)                         │
│                                                             │
│  [Re-analyze Content] [Dismiss] [Update Settings]          │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ User clicks "Re-analyze Content"
                             ▼
┌─────────────────────────────────────────────────────────────┐
│      🔄 Re-analyzing Content...                             │
│                                                             │
│  Fetching latest version of example.com/article...         │
│  ✓ Content extracted (3,650 words - +150 from original)    │
│  ⏳ Comparing with previous version...                      │
│                                                             │
│  Changes detected:                                          │
│  • 3 new paragraphs added (updates on Oct 8 events)        │
│  • 1 paragraph modified (casualty estimates revised)       │
│  • 2 new entities mentioned (General Ivanov, Kherson)      │
│                                                             │
│  Progress: [████████░░] 80%                                │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ Analysis complete
                             ▼
┌─────────────────────────────────────────────────────────────┐
│      📊 Content Re-Analysis Complete                        │
│                                                             │
│  The source content has been updated. Your framework may   │
│  need revision based on these changes:                      │
│                                                             │
│  NEW INFORMATION:                                           │
│  • Military section: 2 new paragraphs on Oct 8 operations  │
│  • Economic section: Updated casualty estimates            │
│  • New entity: General Ivanov (Russian commander)          │
│  • New location: Kherson                                   │
│                                                             │
│  AFFECTED FRAMEWORKS:                                       │
│  • PMESII-PT: Russian Military Ops                         │
│    Sections to review: Military, Economic                  │
│                                                             │
│  [Update Framework Automatically] [Manual Review]          │
│  [Keep Current Version]                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsive Flow (Condensed)

```
┌──────────────────────┐
│  ResearchTools       │
│  [≡] [Profile]       │
├──────────────────────┤
│  Analyze Source      │
│                      │
│ ┌──────────────────┐ │
│ │ Enter URL...     │ │
│ │                  │ │
│ └──────────────────┘ │
│                      │
│ [Quick Analyze]      │
│                      │
│ Recent (2):          │
│ • Russian Mil...     │
│ • US Defense...      │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  ⏳ Analyzing...     │
│                      │
│ [████░░] 60%         │
│                      │
│ Quick Actions:       │
│ [🛡️ Security]        │
│ [🔓 Bypass]          │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  📄 Results          │
│                      │
│ Russian Military...  │
│ 3,500 words          │
│ 👥 12  📍 5          │
│                      │
│ [Summary]            │
│ [Entities]           │
│ [Frameworks]         │
│                      │
│ 🎯 Suggested:        │
│ • PMESII-PT (92%)    │
│   [Use] [Details]    │
│                      │
│ • DIME (85%)         │
│   [Use] [Details]    │
└──────────────────────┘
```

---

**End of UX Flow Diagrams**
