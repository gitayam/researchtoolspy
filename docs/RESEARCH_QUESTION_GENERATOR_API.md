# Research Question Generator API

## Overview

The Research Question Generator uses AI (gpt-4o-mini via Cloudflare AI Gateway) to help researchers formulate high-quality, measurable research questions. It applies SMART and FINER criteria, generates hypotheses, and can produce full research plans.

**Auth**: All endpoints require `X-User-Hash` header (min 16 chars). Uses `requireAuth` — returns 401 if missing.

**AI Routing**: All endpoints use `callOpenAIViaGateway` for caching, cost reduction, and automatic fallback.

---

## Endpoints

| Endpoint | Purpose | Required Fields |
|---|---|---|
| `POST /api/research/recommend-questions` | Quick generation from topic only | `topic` |
| `POST /api/research/generate-question` | Detailed generation with context | `topic` |
| `POST /api/research/generate-plan` | Full research plan from a question | `researchQuestion` |
| `POST /api/investigations/from-research-question` | Create investigation from saved question | `research_question_id` |

---

## 1. Recommend Questions (Quick)

**POST** `/api/research/recommend-questions`

The fastest path — just provide a topic description. Best for exploring ideas before committing to detailed context.

### Request

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

### Response

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

## 2. Generate Questions (Detailed)

**POST** `/api/research/generate-question`

Full generation with optional 5 W's, constraints, and resources. Produces higher-quality questions when context is provided. Can save to database.

### Request

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

### Response

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

## 3. Generate Research Plan

**POST** `/api/research/generate-plan`

Generates a comprehensive research plan from a selected research question. Adapts to research context (OSINT plans include OPSEC, journalism plans include source protection, etc.).

### Request

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

### Response

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

## 4. Create Investigation from Question

**POST** `/api/investigations/from-research-question`

Creates a new investigation pre-populated from a saved research question. Links the investigation to the original question and plan.

### Request

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

### Response

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
| 401 | Authentication required |
| 404 | Resource not found (investigation endpoint) |
| 405 | Wrong HTTP method (all endpoints are POST-only) |
| 500 | AI generation failed or internal error |

---

## Database Schema

Research questions are stored in `research_questions` (migration 040):

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

---

## Frontend Integration

The frontend (`ResearchQuestionGeneratorPage.tsx`) auto-routes between endpoints:

```typescript
// Topic-only → fast recommend endpoint
if (!hasDetailedContext) {
  fetch('/api/research/recommend-questions', {
    method: 'POST',
    headers: getCopHeaders(),
    body: JSON.stringify({ topic, context, count: 3 })
  })
}

// Has 5 W's → detailed generate endpoint
if (hasDetailedContext) {
  fetch('/api/research/generate-question', {
    method: 'POST',
    headers: getCopHeaders(),
    body: JSON.stringify({ ...formData, saveToDatabase: true })
  })
}
```
