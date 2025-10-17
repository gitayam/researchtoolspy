# Content Intelligence Layout - Integration Guide

## Overview
This guide shows how to replace the horizontal tab layout with the new sidebar navigation layout in ContentIntelligencePage.tsx.

## Benefits
- ✅ Scalable - Easy to add more sections
- ✅ Visual Hierarchy - Clear distinction between automatic vs framework sections
- ✅ Consistent Status Badges - All sections show status
- ✅ Mobile-Responsive - Drawer navigation on mobile, sidebar on desktop
- ✅ Better UX - Quick action buttons on framework sections

## Step 1: Update Imports

Add these imports to ContentIntelligencePage.tsx (after line 23):

```typescript
import { AnalysisLayout } from '@/components/content-intelligence/AnalysisLayout'
import type { AnalysisTab } from '@/components/content-intelligence/AnalysisSidebar'
```

Remove or comment out:
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

## Step 2: Create Section Configuration

Add this configuration after your state declarations (around line 100):

```typescript
// Section Configuration
const sections = [
  // Automatic Sections
  {
    id: 'overview' as AnalysisTab,
    label: 'Overview',
    icon: FileText,
    description: 'Summary, metadata, and key information',
    isAutomatic: true,
    status: 'complete' as const,
  },
  {
    id: 'entities' as AnalysisTab,
    label: 'Entities',
    icon: Users,
    description: 'People, organizations, locations, and more',
    isAutomatic: true,
    status: 'complete' as const,
  },
  {
    id: 'sentiment' as AnalysisTab,
    label: 'Sentiment',
    icon: SmileIcon,
    description: 'Emotional tone and sentiment analysis',
    isAutomatic: true,
    status: analysis?.sentiment_analysis ? ('complete' as const) : ('idle' as const),
  },
  {
    id: 'links' as AnalysisTab,
    label: 'Links',
    icon: Link2,
    description: 'External and internal link analysis',
    isAutomatic: true,
    status: 'complete' as const,
  },
  {
    id: 'word-analysis' as AnalysisTab,
    label: 'Word Analysis',
    icon: BarChart3,
    description: 'Word frequency and phrase analysis',
    isAutomatic: true,
    status: 'complete' as const,
  },

  // Framework Sections
  {
    id: 'claims' as AnalysisTab,
    label: 'Claims Analysis',
    icon: Shield,
    description: '6-method deception detection framework',
    isAutomatic: false,
    status: claimsLoading ? ('processing' as const) :
            (analysis?.claim_analysis || claimsAnalysis) ? ('complete' as const) :
            ('idle' as const),
  },
  {
    id: 'dime' as AnalysisTab,
    label: 'DIME Framework',
    icon: Grid3x3,
    description: 'Diplomatic, Information, Military, Economic',
    isAutomatic: false,
    status: dimeLoading ? ('processing' as const) :
            (analysis?.dime_analysis || dimeAnalysis) ? ('complete' as const) :
            ('idle' as const),
  },
  {
    id: 'starbursting' as AnalysisTab,
    label: 'Starbursting',
    icon: Star,
    description: '5W1H critical question generation',
    isAutomatic: false,
    status: starburstingStatus,
  },
  {
    id: 'qa' as AnalysisTab,
    label: 'Q&A',
    icon: MessageSquare,
    description: 'Ask questions about the content',
    isAutomatic: false,
    status: 'ready' as const,
  },
]
```

## Step 3: Add Framework Runner Function

Add this handler function to trigger framework analyses:

```typescript
// Framework Runner Handler
const handleRunFramework = async (framework: AnalysisTab) => {
  if (!analysis) return

  switch (framework) {
    case 'claims':
      await handleAnalyzeClaims()
      break
    case 'dime':
      await handleDimeAnalyze()
      break
    case 'starbursting':
      await handleStartStarbursting()
      break
    case 'qa':
      // Q&A is always ready - just switch to tab
      setActiveTab('qa')
      break
    default:
      toast({
        title: 'Coming Soon',
        description: `${framework} framework will be available soon.`,
      })
  }
}
```

## Step 4: Replace the Tabs Layout

Find the current tabs section (around line 2570):

**BEFORE:**
```typescript
{analysis && (
  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AnalysisTab)}>
    <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
      <TabsTrigger value="overview">...</TabsTrigger>
      {/* ... all other tabs ... */}
    </TabsList>

    <TabsContent value="overview">
      {/* Overview content */}
    </TabsContent>
    {/* ... other tab contents ... */}
  </Tabs>
)}
```

**AFTER:**
```typescript
{analysis && (
  <AnalysisLayout
    activeTab={activeTab}
    onTabChange={setActiveTab}
    sections={sections}
    onRunFramework={handleRunFramework}
  >
    {/* Overview Content */}
    {activeTab === 'overview' && (
      <Card className="p-6 space-y-4">
        {/* Your existing overview content */}
      </Card>
    )}

    {/* Word Analysis Content */}
    {activeTab === 'word-analysis' && (
      <Card className="p-6">
        {/* Your existing word analysis content */}
      </Card>
    )}

    {/* Sentiment Content */}
    {activeTab === 'sentiment' && (
      <Card className="p-6">
        {/* Your existing sentiment content */}
      </Card>
    )}

    {/* Entities Content */}
    {activeTab === 'entities' && (
      <Card className="p-6">
        {/* Your existing entities content */}
      </Card>
    )}

    {/* Links Content */}
    {activeTab === 'links' && (
      <Card className="p-6">
        {/* Your existing links content */}
      </Card>
    )}

    {/* Claims Content */}
    {activeTab === 'claims' && (
      <div className="space-y-4">
        {/* Your existing claims content */}
      </div>
    )}

    {/* Q&A Content */}
    {activeTab === 'qa' && (
      <Card className="p-6">
        {/* Your existing Q&A content */}
      </Card>
    )}

    {/* DIME Content */}
    {activeTab === 'dime' && (
      <Card className="p-6">
        {/* Your existing DIME content */}
      </Card>
    )}

    {/* Starbursting Content */}
    {activeTab === 'starbursting' && (
      <Card className="p-6">
        {/* Your existing starbursting content */}
      </Card>
    )}
  </AnalysisLayout>
)}
```

## Step 5: Update Type Imports

Make sure your type imports include the AnalysisTab type:

```typescript
import type {
  ContentAnalysis,
  ProcessingStatus,
  SavedLink,
  QuestionAnswer
} from '@/types/content-intelligence'
import type { AnalysisTab } from '@/components/content-intelligence/AnalysisSidebar'
```

## Visual Improvements

### Desktop Layout
```
┌──────────────┬─────────────────────────────────────┐
│   SIDEBAR    │         CONTENT AREA                │
│              │                                     │
│ AUTOMATIC    │   [Active Section Full Width]       │
│ ⚡ Overview   │                                     │
│ ⚡ Entities   │   Better use of horizontal space    │
│ ⚡ Sentiment  │   Cleaner, more focused content     │
│ ⚡ Links      │   No cramped tabs                   │
│ ⚡ Words      │                                     │
│              │                                     │
│ FRAMEWORKS   │                                     │
│ 🔧 Claims ✓  │                                     │
│ 🔧 DIME ⟳    │                                     │
│ 🔧 Q&A       │                                     │
│ 🔧 Starburst │                                     │
└──────────────┴─────────────────────────────────────┘
```

### Mobile Layout
```
┌──────────────────────────────┐
│  [≡] Current Section Name    │
│                              │
├──────────────────────────────┤
│  [Full Width Content Area]   │
│                              │
│  Tap hamburger menu to       │
│  open drawer navigation      │
│                              │
└──────────────────────────────┘
```

## Features Added

1. **Visual Grouping**: Automatic vs Framework sections clearly separated
2. **Status Badges**: All sections show their current state
3. **Quick Run**: Framework sections show a Play button on hover to trigger analysis
4. **Responsive**: Desktop sidebar, mobile drawer
5. **Descriptions**: Each section has a helpful description
6. **Scalable**: Easy to add new sections or frameworks

## Migration Checklist

- [ ] Add new imports (AnalysisLayout, AnalysisTab)
- [ ] Create sections configuration array
- [ ] Add handleRunFramework function
- [ ] Replace Tabs with AnalysisLayout wrapper
- [ ] Convert TabsContent to conditional rendering
- [ ] Test desktop view (sidebar visible)
- [ ] Test mobile view (drawer navigation)
- [ ] Test framework triggers (Claims, DIME, Starbursting)
- [ ] Verify status badges update correctly
- [ ] Check all existing functionality still works
