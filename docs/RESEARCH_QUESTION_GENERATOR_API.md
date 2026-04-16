# Research API

## Overview

The Research API provides AI-powered question generation, research planning, evidence collection forms, and workflow management. Uses `gpt-5.4-mini` via Cloudflare AI Gateway.

**Auth**: AI generation endpoints use `requireAuth` (401 if missing). Data endpoints use `getUserFromRequest` (session-based). Public submission endpoints require no auth.

**AI Routing**: All AI endpoints use `callOpenAIViaGateway` for caching, cost reduction, and automatic fallback.

---

## Endpoint Summary

| # | Endpoint | Method | Auth | Purpose |
|---|----------|--------|------|---------|
| 1 | `/api/research/recommend-questions` | POST | requireAuth | Quick question generation from topic |
| 2 | `/api/research/generate-question` | POST | requireAuth | Detailed generation with 5 W's context |
| 3 | `/api/research/generate-plan` | POST | requireAuth | Full research plan from a question |
| 4 | `/api/investigations/from-research-question` | POST | requireAuth | Create investigation from saved question |
| 5 | `/api/research/forms/list` | GET | session | List submission forms |
| 6 | `/api/research/forms/create` | POST | session | Create submission form |
| 7 | `/api/research/forms/[id]` | GET/DELETE | none/session | Get or delete form by hash ID |
| 8 | `/api/research/forms/[id]/toggle` | PATCH | requireAuth | Toggle form active/inactive |
| 9 | `/api/research/submissions/list` | GET | session | List form submissions |
| 10 | `/api/research/submissions/process` | POST | session | Convert submission to evidence |
| 11 | `/api/research/submit/[hashId]` | GET/POST | none | Public form view and submission |
| 12 | `/api/research/evidence/list` | GET | session | List evidence items |
| 13 | `/api/research/evidence/add` | POST | session | Add evidence to question/investigation |
| 14 | `/api/research/tasks/list` | GET | session | List research tasks |
| 15 | `/api/research/workflow/init` | POST | session | Initialize workflow from template |

---

## AI Generation Endpoints

### 1. Recommend Questions (Quick)

**POST** `/api/research/recommend-questions`

The fastest path — just provide a topic description. Best for exploring ideas before committing to detailed context.

#### Request

```json
{
  "topic": "How does social media disinformation spread during elections?",
  "context": "journalism",
  "count": 3
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `topic` | string | Yes | — | Topic description or area of interest |
| `context` | string | No | — | Research context: `academic`, `osint`, `investigation`, `business`, `journalism`, `personal`. Tailors question style. |
| `count` | number | No | 3 | Number of questions to generate (max 5) |

#### Response

```json
{
  "questions": [
    {
      "question": "To what extent does algorithmic amplification...",
      "overallScore": 87,
      "smartAssessment": {
        "specific": { "passed": true, "explanation": "..." },
        "measurable": { "passed": true, "explanation": "..." },
        "achievable": { "passed": true, "explanation": "..." },
        "relevant": { "passed": true, "explanation": "..." },
        "timeBound": { "passed": false, "explanation": "..." }
      },
      "finerAssessment": {
        "feasible": { "passed": true, "explanation": "..." },
        "interesting": { "passed": true, "explanation": "..." },
        "novel": { "passed": true, "explanation": "..." },
        "ethical": { "passed": true, "explanation": "..." },
        "relevant": { "passed": true, "explanation": "..." }
      },
      "nullHypothesis": "H₀: Algorithmic amplification has no significant effect...",
      "alternativeHypothesis": "H₁: Algorithmic amplification significantly increases...",
      "keyVariables": ["Algorithmic amplification", "Disinformation spread rate", "Platform type"],
      "dataCollectionMethods": ["Content analysis", "API data collection", "Survey"],
      "potentialChallenges": ["Platform API access restrictions", "Defining 'disinformation'"],
      "overallScore": 87
    }
  ],
  "count": 3
}
```

**Caching**: 30-minute cache TTL — repeated similar topics may return cached results for faster responses.

---

### 2. Generate Questions (Detailed)

**POST** `/api/research/generate-question`

Full generation with optional 5 W's, constraints, and resources. Produces higher-quality questions when context is provided. Can save to database.

#### Request

```json
{
  "topic": "The impact of remote work on employee productivity",
  "purpose": ["descriptive", "correlational"],
  "projectType": "Academic thesis",

  "who": {
    "population": "Tech workers in the US",
    "subgroups": "Comparing junior vs senior developers"
  },
  "what": {
    "variables": "Productivity metrics, job satisfaction",
    "expectedOutcome": "Positive correlation with flexibility"
  },
  "where": {
    "location": "United States",
    "specificSettings": "Startups and large enterprises"
  },
  "when": {
    "timePeriod": "2020-2024",
    "studyType": "longitudinal"
  },
  "why": {
    "importance": "To inform future HR policies",
    "beneficiaries": "HR departments, remote workers"
  },

  "duration": "6 months",
  "resources": ["Access to survey data", "Statistical software"],
  "experienceLevel": "intermediate",
  "constraints": "Limited budget for incentives",
  "ethicalConsiderations": "Anonymity of respondents",

  "saveToDatabase": true
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `topic` | string | Yes | — | Research topic |
| `purpose` | string[] | No | [] | Research purposes (Exploratory, Descriptive, etc.) |
| `projectType` | string | No | "" | Project type |
| `who` | object | No | `{population: "To be determined"}` | Target population |
| `what` | object | No | `{variables: "To be determined"}` | Variables of interest |
| `where` | object | No | `{location: "To be determined"}` | Geographic/setting scope |
| `when` | object | No | `{timePeriod: "To be determined"}` | Time period and study type |
| `why` | object | No | `{importance: "To be determined"}` | Significance |
| `duration` | string | No | "" | Research timeframe |
| `resources` | string[] | No | [] | Available resources |
| `experienceLevel` | string | No | "intermediate" | beginner/intermediate/advanced/expert |
| `constraints` | string | No | — | Known limitations |
| `ethicalConsiderations` | string | No | — | Ethical concerns |
| `saveToDatabase` | boolean | No | false | Save to `research_questions` table |

#### Response

```json
{
  "success": true,
  "id": "rq-a1b2c3d4-...",
  "questions": [ /* same structure as recommend-questions */ ],
  "summary": {
    "topic": "The impact of remote work...",
    "who": "Tech workers in the US",
    "what": "Productivity metrics, job satisfaction",
    "where": "United States",
    "when": "2020-2024",
    "why": "To inform future HR policies"
  }
}
```

**Caching**: Uses AI Gateway default (1 hour) — detailed prompts are less likely to cache-hit.

---

### 3. Generate Research Plan

**POST** `/api/research/generate-plan`

Generates a comprehensive research plan from a selected research question. Adapts to research context (OSINT plans include OPSEC, journalism plans include source protection, etc.).

#### Request

```json
{
  "researchQuestionId": "rq-a1b2c3d4-...",
  "researchQuestion": "How does remote work frequency correlate with...",
  "duration": "6 months",
  "resources": ["Survey tools", "Statistical software"],
  "experienceLevel": "intermediate",
  "projectType": "Academic thesis",
  "fiveWs": {
    "who": { "population": "Tech workers" },
    "what": { "variables": "Productivity metrics" },
    "where": { "location": "United States" },
    "when": { "timePeriod": "2020-2024", "studyType": "longitudinal" },
    "why": { "importance": "Inform HR policies" }
  },
  "researchContext": "academic",
  "teamSize": "small-team",
  "teamRoles": ["Lead Researcher", "Data Analyst", "Survey Designer"]
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `researchQuestion` | string | Yes | — | The selected research question text |
| `researchQuestionId` | string | No | — | ID from generate-question (saves plan to DB) |
| `duration` | string | No | "3-6 months" | Research timeframe |
| `resources` | string[] | No | [] | Available resources |
| `experienceLevel` | string | No | "intermediate" | Researcher experience |
| `projectType` | string | No | "General research" | Type of project |
| `fiveWs` | object | No | defaults | 5 W's context (all sub-fields optional) |
| `researchContext` | string | No | "academic" | Tailors plan to domain |
| `teamSize` | string | No | "solo" | solo/small-team/large-team |
| `teamRoles` | string[] | No | [] | Team member roles (for team research) |

#### Response

```json
{
  "success": true,
  "plan": {
    "methodology": {
      "approach": "Mixed Methods",
      "design": "Sequential Explanatory",
      "rationale": "Combines quantitative surveys with qualitative interviews...",
      "dataCollection": ["Online survey", "Semi-structured interviews"],
      "sampling": "Stratified random sampling by company size",
      "sampleSize": "400 survey + 20 interview participants"
    },
    "timeline": {
      "totalDuration": "6 months",
      "milestones": [
        {
          "phase": "Literature Review & Design",
          "tasks": ["Systematic review", "Survey instrument development"],
          "duration": "6 weeks",
          "deliverables": ["Literature review report", "Survey draft"]
        }
      ],
      "criticalPath": ["IRB approval", "Survey distribution", "Data analysis"]
    },
    "resources": {
      "personnel": ["Principal Investigator", "Research Assistant"],
      "equipment": ["Laptop", "Recording device"],
      "software": ["Qualtrics", "SPSS", "NVivo"],
      "funding": "$5,000-$8,000 (survey incentives, software licenses)",
      "facilities": ["University library access"]
    },
    "literatureReview": {
      "databases": ["PubMed", "JSTOR", "Google Scholar"],
      "searchTerms": ["remote work productivity", "telecommuting outcomes"],
      "inclusionCriteria": ["Published 2018-2024", "Peer-reviewed"],
      "exclusionCriteria": ["Non-English", "Pre-COVID studies only"],
      "expectedSources": 40
    },
    "dataAnalysis": {
      "quantitativeTests": ["Pearson correlation", "Multiple regression"],
      "qualitativeApproaches": ["Thematic analysis"],
      "software": ["SPSS", "NVivo"],
      "validationMethods": ["Triangulation", "Member checking"]
    },
    "ethicalConsiderations": {
      "irbRequired": true,
      "riskLevel": "Minimal",
      "consentRequired": true,
      "privacyMeasures": ["Anonymized data", "Secure storage"],
      "potentialRisks": ["Employer retaliation concerns"]
    },
    "dissemination": {
      "targetJournals": ["Journal of Applied Psychology"],
      "conferences": ["APA Annual Convention"],
      "stakeholders": ["HR departments", "Remote work advocates"],
      "formats": ["Journal article", "Policy brief"]
    },
    "teamCollaboration": {
      "roles": [
        { "role": "Lead Researcher", "responsibilities": ["Study design", "Analysis"] },
        { "role": "Data Analyst", "responsibilities": ["Statistical analysis"] }
      ],
      "communicationPlan": "Weekly standups via Zoom, shared drive for documents",
      "taskDistribution": ["Parallel literature review assignments"],
      "collaborationTools": ["Google Drive", "Zoom", "Trello"]
    }
  }
}
```

**Note**: `teamCollaboration` is only included when `teamSize` is not `solo`.

**Caching**: Disabled (TTL=0) — plans are personalized and should always be freshly generated.

---

### 4. Create Investigation from Question

**POST** `/api/investigations/from-research-question`

Creates a new investigation pre-populated from a saved research question. Links the investigation to the original question and plan.

#### Request

```json
{
  "research_question_id": "rq-a1b2c3d4-...",
  "title": "Remote Work Productivity Study",
  "description": "Investigation into remote work impact",
  "tags": ["remote-work", "productivity"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `research_question_id` | string | Yes | ID from generate-question |
| `title` | string | No | Defaults to "Research: {topic}" |
| `description` | string | No | Defaults to selected question text |
| `tags` | string[] | No | Investigation tags |

#### Response

```json
{
  "success": true,
  "investigation": {
    "id": "uuid",
    "title": "Remote Work Productivity Study",
    "type": "structured_research",
    "status": "active",
    "research_question_topic": "The impact of remote work...",
    "research_plan": { /* full plan if generated */ }
  }
}
```

---

## Evidence Collection Endpoints

### 5. List Forms

**GET** `/api/research/forms/list`

Lists submission forms for a workspace.

#### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `workspaceId` | string | Yes | Workspace identifier |
| `activeOnly` | string | No | `"true"` to filter to active forms only |

#### Response

```json
{
  "success": true,
  "forms": [
    {
      "id": "uuid",
      "hash_id": "8-char-hash",
      "form_name": "Source Collection Form",
      "form_description": "Submit OSINT sources",
      "target_investigation_ids": ["uuid"],
      "target_research_question_ids": ["uuid"],
      "enabled_fields": ["source_url", "content_type", "keywords"],
      "is_active": 1,
      "submission_count": 12,
      "created_at": "2026-04-01T12:00:00Z",
      "expires_at": null,
      "submissionUrl": "/submit/a1b2c3d4"
    }
  ],
  "count": 1
}
```

---

### 6. Create Form

**POST** `/api/research/forms/create`

Creates a new evidence submission form with a unique 8-character hash URL.

#### Request

```json
{
  "formName": "OSINT Source Collection",
  "formDescription": "Submit open-source intelligence for review",
  "targetInvestigationIds": ["uuid"],
  "targetResearchQuestionIds": ["uuid"],
  "enabledFields": ["source_url", "content_type", "keywords", "submitter_comments"],
  "requireUrl": true,
  "requireContentType": true,
  "allowAnonymous": true,
  "autoArchive": true,
  "collectSubmitterInfo": false,
  "requireSubmissionPassword": false,
  "expiresAt": "2026-06-01T00:00:00Z"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `formName` | string | Yes | — | Form display name |
| `formDescription` | string | No | — | Description shown to submitters |
| `targetInvestigationIds` | string[] | No | [] | Link submissions to investigations |
| `targetResearchQuestionIds` | string[] | No | [] | Link submissions to research questions |
| `enabledFields` | string[] | Yes | — | Fields shown on the form (see below) |
| `requireUrl` | boolean | No | true | Require source URL |
| `requireContentType` | boolean | No | true | Require content type |
| `allowAnonymous` | boolean | No | true | Allow anonymous submissions |
| `autoArchive` | boolean | No | true | Auto-archive URLs to Wayback Machine |
| `collectSubmitterInfo` | boolean | No | false | Collect IP/User-Agent |
| `requireSubmissionPassword` | boolean | No | false | Password-protect form |
| `submissionPassword` | string | No | — | Required if `requireSubmissionPassword: true` |
| `expiresAt` | string | No | — | ISO-8601 expiry date |

**Valid `enabledFields`**: `source_url`, `archived_url`, `content_type`, `content_description`, `login_required`, `keywords`, `submitter_comments`, `submitter_contact`, `submitter_name`

#### Response

```json
{
  "success": true,
  "form": {
    "id": "uuid",
    "hashId": "a1b2c3d4",
    "formName": "OSINT Source Collection",
    "submissionUrl": "/submit/a1b2c3d4",
    "createdAt": "2026-04-15T12:00:00Z"
  }
}
```

---

### 7. Get/Delete Form

**GET** `/api/research/forms/[id]` — No auth required (public)
**DELETE** `/api/research/forms/[id]` — Requires `requireAuth`

Path parameter `id` is the form's `hash_id`.

**DELETE** cascade-deletes all submissions for the form.

```json
{ "success": true, "deleted_submissions": 5 }
```

---

### 8. Toggle Form

**PATCH** `/api/research/forms/[id]/toggle`

Toggles a form's active/inactive status.

```json
{ "is_active": 0 }
```

Response: `{ "success": true, "is_active": 0 }`

---

### 9. List Submissions

**GET** `/api/research/submissions/list`

#### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `formId` | string | No | Filter by form |
| `status` | string | No | `pending` or `completed` |
| `researchQuestionId` | string | No | Filter by research question |

#### Response

```json
{
  "success": true,
  "submissions": [
    {
      "id": "uuid",
      "form_id": "uuid",
      "source_url": "https://example.com/article",
      "archived_url": "https://web.archive.org/...",
      "content_type": "article",
      "content_description": "Analysis of...",
      "keywords": ["osint", "social-media"],
      "status": "pending",
      "submitted_at": "2026-04-15T12:00:00Z",
      "form_name": "OSINT Source Collection",
      "form_hash": "a1b2c3d4"
    }
  ],
  "count": 1
}
```

---

### 10. Process Submission to Evidence

**POST** `/api/research/submissions/process`

Converts a pending submission into an evidence entry. Requires `X-Workspace-ID` header.

#### Request

```json
{
  "submissionId": "uuid",
  "verificationStatus": "unverified",
  "credibilityScore": 60,
  "evidenceType": "document",
  "notes": "Initial review — needs corroboration"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `submissionId` | string | Yes | — | Submission to process |
| `verificationStatus` | string | No | `"unverified"` | `verified`, `probable`, `unverified`, `disproven` |
| `credibilityScore` | number | No | — | 0-100 credibility rating |
| `evidenceType` | string | No | — | Evidence type category |
| `notes` | string | No | — | Processing notes |

#### Response

```json
{
  "success": true,
  "evidenceId": "uuid",
  "submission": {
    "id": "uuid",
    "status": "completed",
    "processedAt": "2026-04-15T12:00:00Z"
  }
}
```

---

### 11. Public Submission

**GET/POST** `/api/research/submit/[hashId]`

No authentication required. Public-facing form for evidence collection.

**GET**: Returns form metadata (name, description, enabled fields, requirements).

**POST** Request:

```json
{
  "sourceUrl": "https://example.com/evidence",
  "contentType": "article",
  "contentDescription": "Detailed analysis of...",
  "keywords": ["keyword1", "keyword2"],
  "submitterComments": "Found via Twitter search",
  "password": "form-password"
}
```

Fields are validated against the form's `enabledFields`. `sourceUrl` is required if form has `requireUrl: true`. `password` is required if form has `requireSubmissionPassword: true`.

**POST** Response:

```json
{
  "success": true,
  "submission": {
    "id": "uuid",
    "status": "pending",
    "archivedUrl": "https://web.archive.org/...",
    "submittedAt": "2026-04-15T12:00:00Z"
  },
  "message": "Thank you for your submission. It will be reviewed shortly."
}
```

**Side effects**: Auto-archives source URL to Wayback Machine (if `autoArchive` enabled). Extracts page metadata (title, description, author, publish date) asynchronously.

---

## Evidence & Tasks Endpoints

### 12. List Evidence

**GET** `/api/research/evidence/list`

#### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `researchQuestionId` | string | One required | Filter by research question |
| `investigationPacketId` | string | One required | Filter by investigation |
| `type` | string | No | Filter by evidence type |
| `status` | string | No | Filter by verification status |

At least one of `researchQuestionId` or `investigationPacketId` is required.

#### Response

```json
{
  "success": true,
  "evidence": [
    {
      "id": "uuid",
      "evidence_type": "document",
      "title": "Source article analysis",
      "content": "...",
      "source_url": "https://...",
      "verification_status": "probable",
      "credibility_score": 75,
      "chain_of_custody": [{ "actor": "Alice", "action": "collected", "timestamp": "..." }],
      "tags": ["osint"],
      "collected_at": "2026-04-15T12:00:00Z"
    }
  ],
  "count": 1
}
```

---

### 13. Add Evidence

**POST** `/api/research/evidence/add`

#### Request

```json
{
  "researchQuestionId": "rq-uuid",
  "evidenceType": "document",
  "title": "Interview transcript",
  "content": "Full text...",
  "verificationStatus": "verified",
  "credibilityScore": 90,
  "chainOfCustody": [
    { "actor": "Jane", "action": "conducted interview", "timestamp": "2026-04-10T10:00:00Z" }
  ],
  "tags": ["primary-source", "interview"],
  "entities": [
    { "type": "person", "name": "John Doe" }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `researchQuestionId` | string | One required | Link to research question |
| `investigationPacketId` | string | One required | Link to investigation |
| `evidenceType` | string | Yes | `source`, `document`, `interview`, `observation`, `data`, `media` |
| `title` | string | Yes | Evidence title |
| `content` | string | No | Full content/text |
| `verificationStatus` | string | No | `verified`, `probable`, `unverified`, `disproven` |
| `credibilityScore` | number | No | 0-100 credibility rating |
| `chainOfCustody` | array | No | Provenance chain |
| `tags` | string[] | No | Categorization tags |
| `linkedEvidence` | string[] | No | UUIDs of related evidence |
| `entities` | array | No | Extracted entities |

---

### 14. List Tasks

**GET** `/api/research/tasks/list`

#### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `researchQuestionId` | string | One required | Filter by research question |
| `investigationPacketId` | string | One required | Filter by investigation |
| `status` | string | No | Filter by task status |
| `stage` | string | No | Filter by workflow stage |

#### Response

```json
{
  "success": true,
  "tasks": [
    {
      "id": "uuid",
      "workflow_stage": "data_collection",
      "task_title": "Conduct expert interviews",
      "task_description": "Schedule and conduct 5 interviews...",
      "status": "pending",
      "priority": "high",
      "depends_on": ["uuid"],
      "related_evidence": ["uuid"],
      "created_at": "2026-04-15T12:00:00Z"
    }
  ],
  "count": 1
}
```

---

### 15. Initialize Workflow

**POST** `/api/research/workflow/init`

Initializes a research workflow from a template, creating default tasks based on the research context. Requires `X-Workspace-ID` header.

#### Request

```json
{
  "researchQuestionId": "rq-uuid",
  "researchContext": "osint"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `researchQuestionId` | string | Yes | Research question to build workflow for |
| `researchContext` | string | Yes | `osint`, `investigation`, `business`, `journalism`, `academic`, `personal` |

#### Response

```json
{
  "success": true,
  "workflow": {
    "template": "osint_research",
    "stages": ["planning", "collection", "processing", "analysis", "dissemination"],
    "evidenceTypes": ["source", "document", "data"],
    "analysisTypes": ["content_analysis", "network_analysis"]
  },
  "tasks": [
    {
      "id": "uuid",
      "workflowStage": "planning",
      "taskTitle": "Define collection requirements",
      "status": "pending",
      "priority": "high",
      "createdAt": "2026-04-15T12:00:00Z"
    }
  ],
  "taskCount": 8
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|---|---|
| 400 | Missing required fields |
| 401 | Authentication required — user must log in |
| 404 | Resource not found |
| 405 | Wrong HTTP method |
| 500 | AI generation failed or internal error |

---

## Database Schema

### research_questions (migration 040)

```sql
CREATE TABLE research_questions (
  id TEXT PRIMARY KEY,              -- "rq-{uuid}"
  user_id INTEGER NOT NULL,
  workspace_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  purpose TEXT,                     -- JSON array
  project_type TEXT,
  five_ws TEXT NOT NULL,            -- JSON: {who, what, where, when, why}
  duration TEXT,
  resources TEXT,                   -- JSON array
  experience_level TEXT,
  constraints TEXT,
  ethical_considerations TEXT,
  generated_questions TEXT NOT NULL, -- JSON array of 3 questions
  selected_question_index INTEGER,
  selected_question TEXT,
  custom_edits TEXT,                -- JSON: {generatedPlan, generatedAt}
  status TEXT DEFAULT 'draft',      -- draft | finalized | archived
  created_at TEXT,
  updated_at TEXT
);
```

### research_evidence

```sql
CREATE TABLE research_evidence (
  id TEXT PRIMARY KEY,
  research_question_id TEXT,
  investigation_packet_id TEXT,
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  evidence_type TEXT NOT NULL,       -- source|document|interview|observation|data|media
  title TEXT NOT NULL,
  content TEXT,
  source_url TEXT,
  metadata TEXT,                     -- JSON
  chain_of_custody TEXT,             -- JSON array
  tags TEXT,                         -- JSON array
  linked_evidence TEXT,              -- JSON array of UUIDs
  entities TEXT,                     -- JSON array
  verification_status TEXT DEFAULT 'unverified',
  credibility_score INTEGER,
  collected_at TEXT,
  created_at TEXT
);
```

### research_submission_forms

```sql
CREATE TABLE research_submission_forms (
  id TEXT PRIMARY KEY,
  hash_id TEXT UNIQUE NOT NULL,      -- 8-char public URL identifier
  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL,
  form_name TEXT NOT NULL,
  form_description TEXT,
  target_investigation_ids TEXT,      -- JSON array
  target_research_question_ids TEXT,  -- JSON array
  enabled_fields TEXT NOT NULL,       -- JSON array
  require_url INTEGER DEFAULT 1,
  require_content_type INTEGER DEFAULT 1,
  allow_anonymous INTEGER DEFAULT 1,
  auto_archive INTEGER DEFAULT 1,
  collect_submitter_info INTEGER DEFAULT 0,
  require_submission_password INTEGER DEFAULT 0,
  submission_password_hash TEXT,
  is_active INTEGER DEFAULT 1,
  submission_count INTEGER DEFAULT 0,
  expires_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

---

## Frontend Integration

The frontend (`ResearchQuestionGeneratorPage.tsx`) auto-routes between endpoints based on context depth:

```typescript
// Topic-only → fast recommend endpoint
if (!hasDetailedContext) {
  const response = await fetch('/api/research/recommend-questions', {
    method: 'POST',
    headers: getCopHeaders(),
    body: JSON.stringify({ topic, context, count: 3 })
  })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Please log in to generate research questions.')
    throw new Error('Failed to generate questions')
  }
}

// Has 5 W's → detailed generate endpoint
if (hasDetailedContext) {
  const response = await fetch('/api/research/generate-question', {
    method: 'POST',
    headers: getCopHeaders(),
    body: JSON.stringify({ ...formData, saveToDatabase: true })
  })
}
```

**Auth flow**: `getCopHeaders()` reads `omnicore_user_hash` and `omnicore_tokens` from localStorage. Users must be logged in before using AI generation features.
