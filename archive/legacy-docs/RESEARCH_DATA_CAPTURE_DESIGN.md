# Research Data Capture Form System Design

## Analysis of Old System

### Old Form Fields (from images):
1. **URL of content** - Text input for source URL
2. **Archived Link** - Text input for archived/backup URL
3. **Type of Content** - Checkboxes (Article, Video, Social Media Post, Document, Image, Other)
4. **Content Related to Research Question** - Text area
5. **Login Required to View** - Yes/No toggle
6. **Comments and Context** - Text area for researcher notes
7. **Keywords/Phrases** - Tags/keywords for searching

### Old System Strengths:
- Quick capture of essential metadata
- Flexible content type categorization
- Preserves context and researcher observations
- Keyword tagging for retrieval

### Old System Limitations:
- Manual entry (no automation)
- No direct link to research questions/investigations
- No evidence chain tracking
- No privacy/anonymity features
- No automatic archiving
- Limited metadata extraction

## Modern System Design

### Core Concept: Anonymous Evidence Submission Portal

**Key Features:**
1. **Hash-Based URLs** - Each form gets unique, non-guessable URL (e.g., `/submit/a7f3c9e2`)
2. **Multi-Investigation Routing** - One submission can feed multiple investigations/questions
3. **Automated Enhancement** - Auto-archive URLs, extract metadata, detect content type
4. **Privacy-First** - No authentication required, no IP logging by default
5. **Evidence Integration** - Submissions become research_evidence entries
6. **Activity Logging** - All submissions tracked in research_activity

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Researcher Creates Form Template                       │
│  - Select which fields to include                       │
│  - Link to investigation(s)/research question(s)        │
│  - Generate hash URL                                    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Share Hash URL (Anonymous)                             │
│  - /submit/a7f3c9e2                                     │
│  - No login required                                    │
│  - Clean, minimal UI                                    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Submission Processing                                  │
│  - Validate data                                        │
│  - Auto-archive URL (Wayback Machine API)              │
│  - Extract metadata (Open Graph, Twitter Cards)        │
│  - Detect content type                                  │
│  - Create evidence entry                                │
│  - Log activity                                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Researcher Reviews Submission                          │
│  - Appears in workspace evidence tab                    │
│  - Mark verification status                             │
│  - Add credibility score                                │
│  - Link to analysis                                     │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### New Tables

#### `submission_forms`
Researcher-created forms for evidence submission

```sql
CREATE TABLE submission_forms (
  id TEXT PRIMARY KEY,                    -- UUID
  hash_id TEXT UNIQUE NOT NULL,           -- Short hash for URL (8 chars)
  creator_workspace_id TEXT,              -- Who created it (optional)

  form_name TEXT NOT NULL,                -- Internal name
  form_description TEXT,                  -- Instructions for submitters

  -- Routing - Where submissions go
  target_investigation_ids TEXT,          -- JSON array of investigation IDs
  target_research_question_ids TEXT,      -- JSON array of research question IDs

  -- Configuration
  enabled_fields TEXT NOT NULL,           -- JSON array of field names
  require_url BOOLEAN DEFAULT 1,
  require_content_type BOOLEAN DEFAULT 1,
  allow_anonymous BOOLEAN DEFAULT 1,
  auto_archive BOOLEAN DEFAULT 1,

  -- Privacy & Security
  collect_submitter_info BOOLEAN DEFAULT 0,
  require_submission_password BOOLEAN DEFAULT 0,
  submission_password_hash TEXT,

  -- Status
  is_active BOOLEAN DEFAULT 1,
  submission_count INTEGER DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT                         -- Optional expiration
);

CREATE INDEX idx_submission_forms_hash ON submission_forms(hash_id);
CREATE INDEX idx_submission_forms_active ON submission_forms(is_active);
```

#### `form_submissions`
Raw submissions before processing into evidence

```sql
CREATE TABLE form_submissions (
  id TEXT PRIMARY KEY,                    -- UUID
  form_id TEXT NOT NULL,                  -- Links to submission_forms

  -- Core Data
  source_url TEXT,
  archived_url TEXT,
  content_type TEXT,                      -- article, video, social_post, document, image, other
  content_description TEXT,
  login_required BOOLEAN DEFAULT 0,
  keywords TEXT,                          -- JSON array
  submitter_comments TEXT,

  -- Auto-extracted Metadata
  metadata TEXT,                          -- JSON: {title, description, author, date, site_name, etc}

  -- Optional Submitter Info (if enabled)
  submitter_contact TEXT,
  submitter_name TEXT,

  -- Processing Status
  status TEXT DEFAULT 'pending',          -- pending, processing, completed, rejected
  processed_at TEXT,
  evidence_id TEXT,                       -- Links to research_evidence after processing

  -- Privacy
  submitter_ip TEXT,                      -- Only stored if collect_submitter_info=1
  user_agent TEXT,

  submitted_at TEXT NOT NULL
);

CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
CREATE INDEX idx_form_submissions_evidence ON form_submissions(evidence_id);
```

### Field Definitions

#### Available Form Fields
```typescript
type FormField =
  | 'source_url'           // Required URL field
  | 'archived_url'         // Optional pre-archived URL
  | 'content_type'         // Dropdown/checkboxes
  | 'content_description'  // How this relates to research
  | 'login_required'       // Boolean toggle
  | 'keywords'             // Tag input
  | 'submitter_comments'   // Free text notes
  | 'submitter_contact'    // Optional contact info
  | 'submitter_name'       // Optional name

type ContentType =
  | 'article'
  | 'video'
  | 'social_post'
  | 'document'
  | 'image'
  | 'podcast'
  | 'dataset'
  | 'other'
```

## API Endpoints

### Form Management (Authenticated)

#### `POST /api/research/forms/create`
Create new submission form
```typescript
{
  formName: string
  formDescription?: string
  targetInvestigationIds?: string[]
  targetResearchQuestionIds?: string[]
  enabledFields: FormField[]
  requireUrl?: boolean
  autoArchive?: boolean
  allowAnonymous?: boolean
  expiresAt?: string
}
```

#### `GET /api/research/forms/list?workspaceId=xxx`
List all forms for workspace

#### `PUT /api/research/forms/[id]/toggle`
Enable/disable form

#### `DELETE /api/research/forms/[id]`
Delete form (soft delete, keep submissions)

### Submission (Public, No Auth)

#### `GET /api/research/submit/[hashId]`
Get form configuration for rendering
```typescript
{
  formName: string
  formDescription: string
  enabledFields: FormField[]
  requireUrl: boolean
  requireContentType: boolean
  requirePassword: boolean
}
```

#### `POST /api/research/submit/[hashId]`
Submit data to form
```typescript
{
  sourceUrl?: string
  archivedUrl?: string
  contentType?: ContentType
  contentDescription?: string
  loginRequired?: boolean
  keywords?: string[]
  submitterComments?: string
  submitterContact?: string
  submitterName?: string
  password?: string  // If form requires password
}
```

### Submission Management (Authenticated)

#### `GET /api/research/submissions/list?formId=xxx&status=pending`
List submissions for review

#### `POST /api/research/submissions/[id]/process`
Convert submission to evidence
```typescript
{
  verificationStatus: 'verified' | 'probable' | 'unverified'
  credibilityScore?: number
  evidenceType: string
  notes?: string
}
```

#### `POST /api/research/submissions/[id]/reject`
Reject submission with reason

## UI Components

### 1. Form Builder Page
`/dashboard/research/forms/new`

- Form name and description
- Target selection (investigations/research questions)
- Field selector (checkboxes for which fields to include)
- Privacy settings
- Generate hash URL button
- Preview mode

### 2. Form List Page
`/dashboard/research/forms`

- Table of all created forms
- Columns: Name, Hash URL (copy button), Targets, Submissions, Status, Created
- Actions: View, Edit, Toggle Active, Delete

### 3. Public Submission Page
`/submit/[hashId]`

- Clean, minimal design
- No header/footer (standalone)
- Only shows enabled fields
- Real-time validation
- Success message with optional "Submit Another"

### 4. Submission Review Panel
`/dashboard/research/submissions`

- Filter by form, status, date
- Table view of pending submissions
- Quick actions: Approve → Evidence, Reject, View Details
- Bulk actions
- Auto-refresh for new submissions

### 5. Integration in Research Workspace
`/dashboard/research/workspace/:id`

New tab: "Submissions"
- Shows submissions routed to this research question
- Click to process into evidence
- Shows source form

## Automation Features

### 1. URL Archiving
```typescript
async function autoArchiveUrl(url: string): Promise<string | null> {
  try {
    // Wayback Machine Save API
    const response = await fetch(`https://web.archive.org/save/${url}`)
    return response.url  // Returns archive URL
  } catch (error) {
    console.error('Auto-archive failed:', error)
    return null
  }
}
```

### 2. Metadata Extraction
```typescript
async function extractMetadata(url: string): Promise<Metadata> {
  // Fetch page content
  // Parse Open Graph tags, Twitter Cards, Schema.org
  // Extract: title, description, author, publish_date, site_name, image

  return {
    title: string
    description: string
    author?: string
    publishDate?: string
    siteName?: string
    imageUrl?: string
    contentType?: 'article' | 'video' | 'image'
  }
}
```

### 3. Content Type Detection
```typescript
function detectContentType(url: string, metadata: Metadata): ContentType {
  // YouTube/Vimeo → video
  // Twitter/Facebook/Instagram → social_post
  // .pdf → document
  // .jpg/.png → image
  // og:type → article/video

  return contentType
}
```

## Privacy & Security

### Hash ID Generation
- Use crypto-random 8-character hash (base62: a-zA-Z0-9)
- 62^8 = 218 trillion combinations (collision-resistant)
- Not sequential or predictable

### Submitter Privacy
- **Default:** No IP logging, no user agent storage
- **Optional:** Researcher can enable submitter info collection
- **GDPR Compliance:** Auto-delete old submissions after retention period

### Rate Limiting
- Max 10 submissions per IP per hour (if IP collected)
- Max 100 submissions per form per day
- CAPTCHA for high-volume forms (optional)

### Password Protection
- Optional password for sensitive forms
- Bcrypt hashing
- No "forgot password" flow (researcher must share password)

## Integration with Existing System

### Evidence Pipeline
```
form_submissions (raw) → research_evidence (verified) → research_analysis (insights)
```

### Activity Feed
All submissions logged:
```typescript
{
  activityType: 'evidence_submitted',
  actor: 'anonymous' | submitterName,
  content: `New submission from form "${formName}": ${contentDescription}`,
  metadata: { formId, submissionId, sourceUrl }
}
```

### Research Workspace
- Submissions tab shows pending items
- One-click "Accept as Evidence" button
- Automatically fills evidence form with submission data

## Implementation Phases

### Phase 3A: Core Infrastructure
- [ ] Database migration (submission_forms, form_submissions tables)
- [ ] Form creation API
- [ ] Hash ID generation
- [ ] Public submission API (basic)

### Phase 3B: Form Builder UI
- [ ] Form builder page
- [ ] Form list page
- [ ] Form detail/edit page
- [ ] Hash URL copy/share functionality

### Phase 3C: Public Submission
- [ ] Public submission page
- [ ] Field validation
- [ ] Success/error handling
- [ ] Minimal, clean design

### Phase 3D: Automation
- [ ] Auto URL archiving (Wayback Machine)
- [ ] Metadata extraction
- [ ] Content type detection
- [ ] Background processing job

### Phase 3E: Review & Processing
- [ ] Submission review panel
- [ ] Process to evidence flow
- [ ] Rejection workflow
- [ ] Integration with workspace

### Phase 3F: Advanced Features
- [ ] Password protection
- [ ] Custom field builder
- [ ] Email notifications
- [ ] Analytics dashboard

## Example Use Cases

### OSINT Investigation
Researcher creates form for tipsters:
- Hash URL: `/submit/x7k9m2pq`
- Fields: URL, Content Type, Description, Keywords
- Routes to: "Corporate Fraud Investigation" + "Executive Background Research"
- Anonymous submissions allowed
- Auto-archiving enabled

### Journalism Project
Reporter creates form for sources:
- Password protected
- Collects submitter contact (encrypted)
- Fields: URL, Document Upload, Context, Verification Info
- Routes to: "Political Corruption Investigation"

### Academic Research
Professor creates form for student research assistants:
- Simple fields: URL, Article Type, Keywords
- Routes to: Multiple research questions about topic
- Not anonymous (tracks who submitted what)

### Personal Research
Hobbyist creates form for community contributions:
- Public URL shared on forum
- Fields: URL, Content Type, Why Relevant
- Routes to: "Local History Project"
- No submitter info collected
