# ACH Framework Improvement & Public Sharing Plan

## Executive Summary
The ACH (Analysis of Competing Hypotheses) framework is a powerful intelligence analysis tool, but it currently has several limitations in workflow, value delivery, and sharing capabilities. This plan addresses these issues with a comprehensive improvement strategy.

---

## 🔍 Current State Assessment

### What Works Well ✅
- **Solid Core Methodology:** Proper ACH implementation with hypotheses-first approach
- **Evidence Integration:** Links to Evidence Library for reusability
- **Matrix Visualization:** ACHMatrix component provides clear visual analysis
- **Scoring System:** Supports both logarithmic (Fibonacci) and linear scales
- **Status Tracking:** Draft → In Progress → Completed workflow
- **Database Design:** Well-structured with CASCADE deletes, proper indexes

### Current Limitations ❌

#### 1. **Workflow & UX Issues**
- **Hypothesis-Evidence-Matrix Flow Is Disconnected:** Users create analysis → add hypotheses → link evidence → navigate to matrix → score (too many steps)
- **No Inline Hypothesis Scoring:** Can't quickly assess hypotheses without opening matrix
- **Limited Guidance:** No AI-assisted hypothesis generation or diagnostic evidence identification
- **Rigid Evidence Selection:** Must select all evidence upfront, can't add incrementally during scoring
- **No Collaborative Features:** Can't share analysis with team members for joint scoring

#### 2. **Value & Insights**
- **Basic Analytics Only:** Simple score totals, no advanced diagnostics
- **No Confidence Intervals:** Can't see uncertainty in assessments
- **Missing Deception Detection:** No analysis of contradictory evidence patterns
- **No Historical Comparison:** Can't compare hypothesis strength over time
- **Limited Export Options:** No shareable reports or visualizations

#### 3. **Sharing & Collaboration**
- **Completely Private:** No public sharing capability
- **No Team Collaboration:** Can't invite co-analysts to score
- **No Public Repository:** Can't discover/clone other analyses
- **No Attribution:** Can't track who contributed what scores
- **No Version History:** Can't see how analysis evolved

---

## 🎯 Improvement Plan

### Phase 1: Enhanced Workflow & UX 🚀 (PRIORITY)

#### 1.1 Unified Analysis Dashboard
**Problem:** Too many navigation steps between analysis creation and scoring

**Solution:** Create `ACHAnalysisDashboard.tsx` that replaces the current separate pages

**Features:**
- **Top Section:** Analysis metadata (title, question, status, analyst)
- **Left Panel:** Hypotheses list with quick stats (supporting/contradicting evidence count)
- **Center Panel:** Evidence list with inline scoring
- **Right Panel:** Real-time diagnostic analysis and recommendations

**Benefits:**
- Reduce clicks from 5+ to 0 (everything on one screen)
- See analysis evolve in real-time as you score
- Immediate feedback on hypothesis strength

#### 1.2 AI-Assisted Hypothesis Generation
**Problem:** Users struggle to create diverse, mutually exclusive hypotheses

**Solution:** Add "Generate Hypotheses" AI feature

**API Endpoint:** `/api/ai/generate-hypotheses`

**Input:**
```typescript
{
  question: string,
  context: string, // description
  num_hypotheses: number, // 3-7
  existing_hypotheses?: string[]
}
```

**Output:**
```typescript
{
  hypotheses: [{
    text: string,
    rationale: string,
    type: 'primary' | 'alternative' | 'null'
  }]
}
```

**UI Location:** ACHAnalysisForm.tsx - Add button "AI Generate Hypotheses" next to hypothesis input

#### 1.3 Diagnostic Evidence Finder
**Problem:** Hard to identify which evidence is most diagnostic (eliminates most hypotheses)

**Solution:** AI-powered evidence diagnostic ranking

**API Endpoint:** `/api/ai/rank-diagnostic-evidence`

**Input:**
```typescript
{
  hypotheses: string[],
  evidence_pool: Evidence[],
  current_scores?: ACHScore[]
}
```

**Output:**
```typescript
{
  ranked_evidence: [{
    evidence_id: string,
    diagnosticity_score: number, // 0-100
    reason: string,
    eliminates_hypotheses: number
  }]
}
```

**UI Location:** ACHMatrix.tsx - Sort evidence by diagnosticity, highlight high-value items

#### 1.4 Incremental Evidence Addition
**Problem:** Must select all evidence upfront

**Solution:**
- Add "+ Add Evidence" button in matrix view
- Quick evidence search/filter modal
- Add evidence without leaving matrix

**Files to Modify:**
- `src/components/ach/ACHMatrix.tsx`
- Add `ACHEvidenceQuickAdd.tsx` modal component

#### 1.5 Keyboard Shortcuts & Rapid Scoring
**Problem:** Slow to score many evidence-hypothesis combinations

**Solution:**
- Arrow keys to navigate matrix
- Number keys (1-5 or 1,3,5,8,13) for rapid scoring
- Tab to move to next cell
- Shift+Tab to move to previous cell
- Space to open notes dialog

---

### Phase 2: Advanced Analytics & Insights 📊

#### 2.1 Enhanced Hypothesis Analysis

**New Metrics:**
```typescript
interface HypothesisAnalysis {
  hypothesisId: string
  totalScore: number
  weightedScore: number  // Factor in credibility
  supportingEvidence: number
  contradictingEvidence: number
  neutralEvidence: number
  diagnosticValue: number  // How much it differs from other hypotheses
  confidenceLevel: 'High' | 'Medium' | 'Low'
  rejectionThreshold: boolean  // True if confidently rejected

  // NEW METRICS
  evidenceGaps: string[]  // Types of evidence missing
  strengthTrend: 'increasing' | 'stable' | 'decreasing'  // If scoring over time
  biasIndicators: {
    confirmationBias: number  // 0-100
    anchoringBias: number
  }
  sensitivityAnalysis: {
    worstCase: number  // If all uncertain scores go against
    bestCase: number   // If all uncertain scores support
  }
}
```

**Implementation:**
- Create `src/utils/ach-analytics.ts` with advanced analysis functions
- Display in new "Insights" panel in ACHMatrix
- Highlight hypothesis with strongest support vs. most rejected

#### 2.2 Deception Detection Analysis
**Problem:** No way to identify if evidence might be deceptive or planted

**Solution:** Analyze evidence patterns for anomalies

**Indicators:**
- Evidence that supports only one hypothesis (suspicious)
- Evidence that contradicts all but one hypothesis (suspicious)
- Evidence from low-credibility sources supporting unlikely hypotheses
- Timeline inconsistencies in evidence

**UI:** Add "🔍 Deception Analysis" tab showing flagged evidence

#### 2.3 Confidence Intervals & Uncertainty
**Problem:** No way to express uncertainty in scores

**Solution:**
- Allow users to mark scores as "uncertain"
- Calculate confidence intervals based on uncertain scores
- Show hypothesis ranking with error bars
- Monte Carlo simulation for hypothesis strength under uncertainty

**UI Changes:**
- Add "Uncertain?" checkbox when scoring
- Display confidence bands in final analysis
- Show "Sensitivity to Uncertainty" metric

#### 2.4 Historical Tracking & Versioning
**Problem:** Can't see how analysis evolved as new evidence added

**Solution:**
- Track score history with timestamps
- Create snapshots when status changes
- Show hypothesis strength timeline graph
- Compare "before" and "after" views when adding new evidence

**Database Changes:**
```sql
CREATE TABLE ach_score_history (
  id TEXT PRIMARY KEY,
  ach_analysis_id TEXT NOT NULL,
  hypothesis_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  notes TEXT,
  scored_by TEXT,
  scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  snapshot_reason TEXT  -- 'evidence_added', 'status_change', 'manual_snapshot'
);
```

---

### Phase 3: Public Sharing & Collaboration 🌐

#### 3.1 Database Schema Changes

**Migration:** `013-add-public-sharing-to-ach.sql`

```sql
-- Add public sharing fields to ach_analyses
ALTER TABLE ach_analyses ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ach_analyses ADD COLUMN share_token TEXT;
ALTER TABLE ach_analyses ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ach_analyses ADD COLUMN clone_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ach_analyses ADD COLUMN domain TEXT; -- intelligence, security, business, research, medical, legal
ALTER TABLE ach_analyses ADD COLUMN tags TEXT; -- JSON array of tags
ALTER TABLE ach_analyses ADD COLUMN shared_publicly_at DATETIME;

-- Indexes for public discovery
CREATE INDEX IF NOT EXISTS idx_ach_analyses_is_public ON ach_analyses(is_public);
CREATE INDEX IF NOT EXISTS idx_ach_analyses_share_token ON ach_analyses(share_token);
CREATE INDEX IF NOT EXISTS idx_ach_analyses_domain ON ach_analyses(domain);

-- Public ACH analyses view
CREATE VIEW IF NOT EXISTS public_ach_analyses AS
SELECT
  id, title, description, question, domain, tags,
  analyst, organization,
  share_token, view_count, clone_count,
  created_at, updated_at
FROM ach_analyses
WHERE is_public = 1;

-- Collaboration tables
CREATE TABLE ach_collaborators (
  id TEXT PRIMARY KEY,
  ach_analysis_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('viewer', 'scorer', 'editor', 'owner')),
  invited_by TEXT,
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  FOREIGN KEY (ach_analysis_id) REFERENCES ach_analyses(id) ON DELETE CASCADE,
  UNIQUE(ach_analysis_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ach_collaborators_analysis_id ON ach_collaborators(ach_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ach_collaborators_user_id ON ach_collaborators(user_id);
```

#### 3.2 Backend API Endpoints

**New Endpoints:**

1. **POST /api/ach/:id/share**
   - Toggle public/private status
   - Generate unique share_token
   - Set domain and tags
   - Return share URL

2. **GET /api/ach/public/:token**
   - Get public ACH analysis (read-only)
   - Increment view_count
   - Include all hypotheses, evidence, scores
   - No auth required

3. **POST /api/ach/public/:token/clone**
   - Clone public ACH analysis to user's workspace
   - Increment clone_count
   - Copy hypotheses and evidence links
   - Reset scores (user starts fresh)
   - Requires auth

4. **GET /api/ach/public**
   - List all public ACH analyses (paginated)
   - Filter by domain, tags, analyst
   - Sort by view_count, clone_count, created_at
   - For discovery/browse page

5. **POST /api/ach/:id/collaborators**
   - Invite user to collaborate on analysis
   - Specify role (viewer, scorer, editor)
   - Send notification email

6. **GET /api/ach/:id/collaborators**
   - List all collaborators for analysis
   - Show role and activity stats

**Files to Create:**
```
functions/api/ach/[id]/share.ts
functions/api/ach/[id]/collaborators.ts
functions/api/ach/public/[token].ts
functions/api/ach/public/[token]/clone.ts
functions/api/ach/public/index.ts
```

#### 3.3 Frontend Components

**A. Share Button for ACH (Reuse Pattern)**

Create: `src/components/ach/ACHShareButton.tsx`

```tsx
interface ACHShareButtonProps {
  analysisId: string
  isPublic: boolean
  shareToken?: string
  domain?: string
  tags?: string[]
  onUpdate?: (data: { isPublic: boolean; shareToken?: string }) => void
}

export function ACHShareButton({
  analysisId,
  isPublic: initialIsPublic,
  shareToken: initialShareToken,
  domain: initialDomain,
  tags: initialTags,
  onUpdate
}: ACHShareButtonProps) {
  // Similar to ShareButton.tsx for frameworks
  // Includes:
  // - Public/Private toggle
  // - Domain selection (intelligence, security, business, etc.)
  // - Tags input
  // - Share link copy
  // - View/clone count display
}
```

**Domains:**
- Intelligence Analysis
- Security & Law Enforcement
- Business Strategy
- Scientific Research
- Medical Diagnosis
- Legal Analysis
- Other

**B. Public ACH View Page**

Create: `src/pages/PublicACHPage.tsx`

```tsx
export function PublicACHPage() {
  const { token } = useParams()
  const [analysis, setAnalysis] = useState<ACHAnalysis | null>(null)
  const [cloning, setCloning] = useState(false)

  useEffect(() => {
    // Fetch public ACH analysis
    fetch(`/api/ach/public/${token}`)
      .then(res => res.json())
      .then(setAnalysis)
  }, [token])

  const handleClone = async () => {
    // Clone to user's workspace
    // Redirect to new analysis for scoring
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Badge>Public ACH Analysis</Badge>
          <h1 className="text-3xl font-bold mt-2">{analysis?.title}</h1>
          <p className="text-lg text-gray-700 mt-1">{analysis?.question}</p>
          <div className="flex gap-4 text-sm text-gray-600 mt-2">
            <span>👁 {analysis?.view_count} views</span>
            <span>📋 {analysis?.clone_count} clones</span>
            {analysis?.analyst && <span>👤 {analysis.analyst}</span>}
            {analysis?.organization && <span>🏢 {analysis.organization}</span>}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {/* Export */}}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleClone} disabled={cloning}>
            <Copy className="h-4 w-4 mr-2" />
            Clone & Analyze
          </Button>
        </div>
      </div>

      {/* Read-only ACH Matrix view */}
      <ACHMatrix
        analysis={analysis}
        readOnly
        showScores  // Show existing scores for reference
      />

      {/* Analysis insights panel */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Analysis Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Show hypothesis rankings, diagnosticity, etc. */}
        </CardContent>
      </Card>
    </div>
  )
}
```

**C. Public ACH Discovery Page**

Create: `src/pages/PublicACHLibraryPage.tsx`

```tsx
export function PublicACHLibraryPage() {
  const [analyses, setAnalyses] = useState<ACHAnalysis[]>([])
  const [domain, setDomain] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'cloned'>('popular')

  useEffect(() => {
    // Fetch public ACH analyses with filters
    const params = new URLSearchParams()
    if (domain !== 'all') params.append('domain', domain)
    if (searchTerm) params.append('search', searchTerm)
    params.append('sort', sortBy)

    fetch(`/api/ach/public?${params}`)
      .then(res => res.json())
      .then(data => setAnalyses(data.analyses))
  }, [domain, searchTerm, sortBy])

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Public ACH Analysis Library</h1>
        <p className="text-gray-600">
          Explore and clone intelligence analyses created by the community
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <Input
          placeholder="Search analyses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            <SelectItem value="intelligence">Intelligence</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="research">Research</SelectItem>
            <SelectItem value="medical">Medical</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy as any}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="cloned">Most Cloned</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Analysis Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {analyses.map(analysis => (
          <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="mb-3">
                <Badge variant="outline">{analysis.domain}</Badge>
                {analysis.tags?.map(tag => (
                  <Badge key={tag} variant="secondary" className="ml-1">
                    {tag}
                  </Badge>
                ))}
              </div>
              <h3 className="font-semibold text-lg mb-2">{analysis.title}</h3>
              <p className="text-sm text-gray-700 mb-2">{analysis.question}</p>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {analysis.description}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex gap-3">
                  <span>👁 {analysis.view_count}</span>
                  <span>📋 {analysis.clone_count}</span>
                </div>
                {analysis.analyst && (
                  <span className="truncate">👤 {analysis.analyst}</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4"
                onClick={() => navigate(`/public/ach/${analysis.share_token}`)}
              >
                View Analysis
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

**D. Collaboration Panel**

Create: `src/components/ach/ACHCollaborators.tsx`

```tsx
export function ACHCollaborators({ analysisId }: { analysisId: string }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'viewer' | 'scorer' | 'editor'>('scorer')

  const handleInvite = async () => {
    // Send collaboration invite
    await fetch(`/api/ach/${analysisId}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole })
    })
    // Refresh list
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaborators</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Invite form */}
          <div className="flex gap-2">
            <Input
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Select value={inviteRole} onValueChange={setInviteRole as any}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="scorer">Scorer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite}>Invite</Button>
          </div>

          {/* Collaborator list */}
          <div className="space-y-2">
            {collaborators.map(collab => (
              <div key={collab.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{collab.user_email}</p>
                  <p className="text-xs text-gray-600">{collab.role}</p>
                </div>
                <Badge variant={collab.accepted_at ? 'default' : 'outline'}>
                  {collab.accepted_at ? 'Active' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

### Phase 4: Enhanced Export & Reporting 📄

#### 4.1 Professional ACH Report Generation

**Features:**
- Executive Summary (hypothesis rankings)
- Full Matrix with color-coded scores
- Evidence Details (credibility, source)
- Diagnostic Analysis (key evidence)
- Confidence Assessment
- Methodology Notes
- Attribution & Timestamp

**Formats:**
- PDF (server-side generation)
- Word Document (DOCX)
- PowerPoint (PPTX) - Matrix as slide
- HTML (styled, printable)

**Implementation:**
- Create `src/utils/ach-report-generator.ts`
- Use `jsPDF` for PDF generation
- Use `docxtemplater` for Word
- Create styled HTML template for printing

#### 4.2 Shareable Report Links

**Similar to frameworks:**
- Generate unique report token
- `/public/ach-report/:token` page
- Standalone view (no app chrome)
- Print-optimized
- Embed option (iframe)

**API Endpoint:** `/api/ach/:id/report-link`

```typescript
POST /api/ach/:id/report-link
Response: { report_token: string, report_url: string }
```

#### 4.3 Matrix Visualizations Export

**Formats:**
- PNG image (high-res)
- SVG (scalable)
- Excel spreadsheet (matrix data)
- CSV (raw scores)

**Implementation:**
- Use `html2canvas` for PNG
- Export SVG directly from matrix
- Use `xlsx` library for Excel

---

## 📊 Value-Added Features Summary

### For Individual Analysts
1. **AI-Assisted Hypothesis Generation** - Save time, ensure completeness
2. **Diagnostic Evidence Ranking** - Focus on high-value evidence first
3. **Sensitivity Analysis** - Understand impact of uncertain scores
4. **Deception Detection** - Identify suspicious evidence patterns
5. **Professional Reports** - Share findings with stakeholders

### For Teams
1. **Collaborative Scoring** - Multiple analysts score independently
2. **Role-Based Access** - Viewer, Scorer, Editor, Owner roles
3. **Activity Tracking** - See who scored what and when
4. **Version History** - Track how analysis evolved
5. **Comparison Mode** - Compare analyst scores side-by-side

### For Community
1. **Public Analysis Library** - Learn from real-world examples
2. **Clone & Adapt** - Start from existing analyses
3. **Attribution System** - Credit original creators
4. **Discovery Features** - Find analyses by domain/tags
5. **Usage Analytics** - See most popular/cloned analyses

---

## 🚀 Implementation Roadmap

### Sprint 1: Core Workflow Improvements (2 weeks)
- ✅ Unified ACH Dashboard
- ✅ AI Hypothesis Generation
- ✅ Incremental Evidence Addition
- ✅ Keyboard Shortcuts

### Sprint 2: Advanced Analytics (2 weeks)
- ✅ Enhanced Hypothesis Analysis
- ✅ Sensitivity Analysis
- ✅ Deception Detection
- ✅ Historical Tracking

### Sprint 3: Public Sharing (2 weeks)
- ✅ Database Migration
- ✅ Backend API Endpoints
- ✅ ShareButton Component
- ✅ Public View Page
- ✅ Discovery/Browse Page

### Sprint 4: Collaboration (1 week)
- ✅ Collaborator Management
- ✅ Multi-Analyst Scoring
- ✅ Activity Tracking
- ✅ Notifications

### Sprint 5: Reports & Export (1 week)
- ✅ Report Generation
- ✅ Shareable Report Links
- ✅ Multiple Export Formats
- ✅ Visualization Export

---

## 🎯 Success Metrics

### Workflow Efficiency
- **Time to Complete Analysis:** Reduce by 50% (from 30 min → 15 min)
- **Clicks to Score:** Reduce from 5+ to 0 (unified dashboard)
- **Evidence Selection Time:** Reduce by 70% (AI ranking)

### Analysis Quality
- **Hypothesis Diversity:** Increase by AI generation
- **Diagnostic Evidence Usage:** 80%+ of evidence scored is high-diagnostic
- **Confidence in Results:** Measured via user surveys

### Sharing & Collaboration
- **Public Analyses Created:** Track growth over time
- **Clone Rate:** % of public analyses cloned
- **Collaboration Adoption:** % of analyses with 2+ collaborators
- **View/Clone Ratio:** Indicates quality of public analyses

### User Satisfaction
- **NPS Score:** Target 40+ (promoters - detractors)
- **Feature Usage:** Track % of users using AI features, sharing, collaboration
- **Time Saved:** User-reported time savings vs. manual process

---

## 🔐 Security & Privacy Considerations

### Public Sharing
- ✅ Share tokens are cryptographically random (crypto.randomUUID())
- ✅ Public analyses are read-only (no editing via share link)
- ✅ Sensitive analyses stay private by default
- ✅ Share tokens can be regenerated (invalidate old links)

### Collaboration
- ✅ Role-based access control enforced at API level
- ✅ Invitation system with email verification
- ✅ Activity audit trail (who scored what when)
- ✅ Owner can revoke collaborator access anytime

### Data Protection
- ✅ User data not exposed in public views
- ✅ Workspace boundaries enforced
- ✅ Clone copies data (no shared references)
- ✅ Deletion cascades properly

---

## 📚 Documentation Needs

1. **User Guide: ACH Methodology** - How to use ACH effectively
2. **Tutorial: Creating Your First ACH Analysis** - Step-by-step walkthrough
3. **Guide: AI-Assisted Features** - How to use hypothesis generation, diagnosticity
4. **Guide: Collaborative Analysis** - Best practices for team scoring
5. **Guide: Public Sharing** - When and how to share analyses
6. **API Documentation** - For developers building integrations

---

## Next Steps

1. **Review & Approve Plan** ✅ (You are here)
2. **Prioritize Features** - Decide which sprints to tackle first
3. **Database Migration** - Create and run migration 013
4. **Backend Implementation** - Build API endpoints
5. **Frontend Components** - Build UI components
6. **Testing & QA** - Test all flows thoroughly
7. **Documentation** - Write user guides
8. **Deployment** - Roll out progressively

---

## Questions for Discussion

1. **Priority:** Which phase should we start with? (My recommendation: Phase 3 for immediate value, then Phase 1)
2. **AI Features:** Should we use OpenAI GPT-5-mini for hypothesis generation?
3. **Collaboration:** Do we need real-time collaboration (WebSockets) or is async sufficient?
4. **Public Library:** Should there be moderation for public analyses (to ensure quality)?
5. **Analytics:** What metrics are most important to track?

