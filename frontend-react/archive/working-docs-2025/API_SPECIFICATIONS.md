# API Specifications: Content-First Architecture

**Document Version:** 1.0
**Date:** 2025-10-08

---

## Table of Contents

1. [Authentication & Workspace Detection](#authentication--workspace-detection)
2. [Modified Endpoints](#modified-endpoints)
3. [New Endpoints](#new-endpoints)
4. [Response Formats](#response-formats)
5. [Error Handling](#error-handling)

---

## Authentication & Workspace Detection

### Workspace ID Resolution

All content-related endpoints must resolve a `workspace_id` using this priority:

1. **Authenticated User:** Extract from JWT token → user's personal workspace
2. **Bookmark Hash:** Read from `X-Bookmark-Hash` header → `workspace_id = 'temp_<hash>'`
3. **Fallback:** Generate new bookmark hash, return in response header

### Request Headers

```http
Authorization: Bearer <jwt_token>  # Optional, for authenticated users
X-Bookmark-Hash: <sha256_hash>     # Optional, for non-authenticated users
Content-Type: application/json
```

### Response Headers

```http
X-Bookmark-Hash: <sha256_hash>     # Returned for non-authenticated users
X-Workspace-Id: <workspace_id>     # Always returned for debugging
```

---

## Modified Endpoints

### POST /api/content-intelligence/analyze-url

**Changes from existing:**
- Add workspace_id detection
- Implement content hash deduplication
- Store entities in `content_entities` table (not just JSON)
- Trigger async framework suggestion generation

**Request:**
```json
{
  "url": "https://example.com/article",
  "mode": "full",  // "quick" | "full" | "forensic"
  "save_link": true,
  "link_note": "Important analysis source",
  "link_tags": ["russia", "military", "ukraine"],
  "force_reanalyze": false  // NEW: Skip deduplication cache
}
```

**Response (Success):**
```json
{
  "id": 123,
  "url": "https://example.com/article",
  "url_normalized": "https://example.com/article",
  "content_hash": "sha256_abc123...",
  "workspace_id": "1",

  // Metadata
  "title": "Russian Military Operations in Ukraine",
  "author": "John Doe",
  "publish_date": "2025-01-15",
  "domain": "example.com",
  "is_social_media": false,

  // Content
  "extracted_text": "Full markdown content...",
  "summary": "250-word AI summary...",
  "word_count": 3500,

  // Word analysis
  "word_frequency": {
    "Russian forces": 45,
    "Ukraine": 38,
    "military operations": 22
  },
  "top_phrases": [
    {"phrase": "Russian military forces", "count": 45, "percentage": 1.3},
    {"phrase": "Ukraine conflict", "count": 38, "percentage": 1.1}
  ],

  // Entities (now also stored in content_entities table)
  "entities": {
    "people": [
      {"name": "Vladimir Putin", "count": 12, "entity_id": "actor_123"},
      {"name": "Volodymyr Zelenskyy", "count": 8, "entity_id": "actor_124"}
    ],
    "organizations": [
      {"name": "Russian Armed Forces", "count": 25, "entity_id": "actor_125"}
    ],
    "locations": [
      {"name": "Kyiv", "count": 15, "entity_id": "place_456"},
      {"name": "Moscow", "count": 10, "entity_id": "place_457"}
    ]
  },

  // Links
  "bypass_urls": {
    "12ft": "https://12ft.io/proxy?q=...",
    "wayback": "https://web.archive.org/web/*/...",
    "archive_is": "https://archive.is/..."
  },
  "archive_urls": {
    "wayback": "https://web.archive.org/save/...",
    "archive_is": "https://archive.is/submit/..."
  },

  // Processing
  "processing_mode": "full",
  "processing_duration_ms": 4500,
  "gpt_model_used": "gpt-5-mini",

  // Deduplication info (if cached)
  "is_cached": false,
  "canonical_content_id": null,
  "duplicate_count": 1,

  // Framework suggestions (if already generated)
  "framework_suggestions": [
    {
      "framework_type": "pmesii-pt",
      "confidence": 0.92,
      "reasoning": "Content contains political, military, and economic analysis of conflict",
      "priority": 1
    },
    {
      "framework_type": "dime",
      "confidence": 0.85,
      "reasoning": "Discusses diplomatic, information, military, and economic dimensions",
      "priority": 2
    }
  ],

  // Timestamps
  "created_at": "2025-10-08T10:30:00Z",
  "updated_at": "2025-10-08T10:30:00Z"
}
```

**Response (Cached):**
```json
{
  "id": 123,
  "is_cached": true,
  "canonical_content_id": 120,
  "cache_hit_message": "This content was previously analyzed. Returning cached results.",
  "first_analyzed_at": "2025-10-05T08:15:00Z",
  "access_count": 5,
  // ... rest of content_analysis fields
}
```

**Response (Error - Content Extraction Failed):**
```json
{
  "error": "The website blocked access. Try using one of the bypass URLs below.",
  "technical_error": "HTTP 403 Forbidden",
  "suggestion": "Try using one of the bypass or archive URLs to access the content",
  "bypass_urls": { /* ... */ },
  "archive_urls": { /* ... */ }
}
```

**Implementation Notes:**
1. Check `content_deduplication` table first (by content_hash + workspace_id)
2. If cache hit: increment access_count, return cached data
3. If cache miss: extract content, analyze, store, generate suggestions
4. Async: Trigger framework suggestion generation (don't block response)
5. Store entities in both JSON (for display) and `content_entities` table (for queries)

---

## New Endpoints

### GET /api/content-intelligence/framework-suggestions

**Purpose:** Get AI-generated framework suggestions for analyzed content

**Request:**
```http
GET /api/content-intelligence/framework-suggestions?content_id=123
```

**Query Parameters:**
- `content_id` (required): Content analysis ID
- `force_refresh` (optional): Regenerate suggestions even if cached

**Response:**
```json
{
  "content_id": 123,
  "suggestions": [
    {
      "framework_type": "pmesii-pt",
      "confidence": 0.92,
      "reasoning": "Content extensively covers political governance (Putin, Kremlin), military operations (Russian Armed Forces, equipment), economic impacts (sanctions, trade), social dynamics (public opinion, refugees), infrastructure (destroyed facilities), information warfare (propaganda, media control), physical environment (terrain, weather), and temporal analysis (timeline of events).",
      "sample_population": {
        "political": "Mentions of Kremlin decision-making, government policies, diplomatic relations",
        "military": "Russian Armed Forces deployments, equipment losses, tactical operations",
        "economic": "Sanctions impact, energy trade disruptions, military expenditure",
        "time": "February 2022 invasion, ongoing operations, future projections"
      },
      "priority": 1,
      "estimated_completeness": 0.75  // How much of framework can be auto-populated
    },
    {
      "framework_type": "dime",
      "confidence": 0.85,
      "reasoning": "Content discusses diplomatic isolation, information operations, military actions, and economic sanctions.",
      "sample_population": {
        "diplomatic": "UN votes, NATO expansion, alliance dynamics",
        "information": "Propaganda narratives, media censorship, cyber operations",
        "military": "Ground operations, air strikes, naval blockade",
        "economic": "Oil/gas sanctions, SWIFT restrictions, trade embargoes"
      },
      "priority": 2,
      "estimated_completeness": 0.68
    },
    {
      "framework_type": "cog",
      "confidence": 0.78,
      "reasoning": "Content identifies Russian military capabilities, requirements, and vulnerabilities.",
      "sample_population": {
        "critical_capabilities": "Combined arms operations, long-range strike, cyber warfare",
        "critical_requirements": "Logistics supply lines, public support, economic resources",
        "critical_vulnerabilities": "Overextended forces, sanctions impact, low morale"
      },
      "priority": 3,
      "estimated_completeness": 0.60
    }
  ],
  "analysis_metadata": {
    "model_used": "gpt-5-mini",
    "prompt_version": "v1.0",
    "tokens_used": 1250,
    "analysis_duration_ms": 2300,
    "analyzed_at": "2025-10-08T10:31:00Z",
    "is_cached": false
  }
}
```

**Error Response (No Suggestions Yet):**
```json
{
  "error": "Framework suggestions not yet generated",
  "status": "processing",
  "message": "Suggestions are being generated in background. Retry in 3-5 seconds.",
  "retry_after": 5
}
```

**Implementation Notes:**
1. Check `content_framework_suggestions` table for cached results
2. If cache exists and not stale: return cached suggestions
3. If no cache or force_refresh: call GPT for analysis
4. Store suggestions in cache table
5. Log analytics event (user viewed suggestions)

---

### POST /api/frameworks/create-from-content

**Purpose:** Create a framework session pre-populated from content analysis

**Request:**
```json
{
  "content_analysis_id": 123,
  "framework_type": "pmesii-pt",
  "title": "Russian Military Operations Analysis",  // Optional
  "auto_populate": true,  // If false, just link content without populating
  "workspace_id": "1"  // Derived from auth if not provided
}
```

**Response:**
```json
{
  "framework_session_id": 456,
  "framework_type": "pmesii-pt",
  "title": "Russian Military Operations Analysis",
  "workspace_id": "1",

  // Pre-populated data
  "data": {
    "political": {
      "findings": [
        "Kremlin centralized decision-making under Putin",
        "Diplomatic isolation from Western nations",
        "UN General Assembly condemnation votes"
      ],
      "source_paragraphs": [3, 7, 12],
      "confidence": 0.85,
      "user_reviewed": false
    },
    "military": {
      "findings": [
        "Russian Armed Forces deployed 150,000+ troops",
        "Combined arms operations with armor, artillery, air support",
        "Reported equipment losses: 500+ tanks, 200+ aircraft"
      ],
      "source_paragraphs": [5, 9, 15, 18],
      "confidence": 0.92,
      "user_reviewed": false
    },
    "economic": {
      "findings": [
        "Western sanctions targeting energy exports, banks, elites",
        "SWIFT restrictions on major Russian banks",
        "Energy trade disruptions causing price volatility"
      ],
      "source_paragraphs": [11, 14, 20],
      "confidence": 0.78,
      "user_reviewed": false
    },
    // ... other PMESII-PT categories
  },

  // Metadata
  "auto_populated": true,
  "auto_population_confidence": 0.82,
  "auto_population_model": "gpt-5-mini",
  "field_mappings": {
    "pmesii.political": ["paragraph_3", "paragraph_7", "paragraph_12"],
    "pmesii.military": ["paragraph_5", "paragraph_9", "paragraph_15", "paragraph_18"],
    "pmesii.economic": ["paragraph_11", "paragraph_14", "paragraph_20"]
  },

  // Content link
  "content_sources": [
    {
      "content_analysis_id": 123,
      "url": "https://example.com/article",
      "title": "Russian Military Operations in Ukraine"
    }
  ],

  "created_at": "2025-10-08T10:35:00Z",
  "status": "draft"  // User must review before completing
}
```

**Error Response (Low Confidence):**
```json
{
  "error": "Auto-population confidence too low",
  "confidence": 0.42,
  "threshold": 0.50,
  "message": "This content may not be suitable for PMESII-PT framework. Consider using SWOT or COG instead.",
  "alternative_suggestions": [
    {"framework_type": "swot", "confidence": 0.68},
    {"framework_type": "cog", "confidence": 0.55}
  ]
}
```

**Implementation Notes:**
1. Validate content_analysis_id and framework_type
2. Check if framework suggestion exists and has confidence > 0.5
3. Call GPT with framework-specific prompt (see Phase 4 logic)
4. Parse GPT response into framework data structure
5. Create framework_session record
6. Create framework_content_sources link
7. Mark all fields as `user_reviewed: false` (require review)
8. Log analytics event (framework created from suggestion)

---

### POST /api/content-intelligence/extract-to-entities

**Purpose:** Batch create actors, places, events from content entities

**Request:**
```json
{
  "content_analysis_id": 123,
  "entity_types": ["actor", "place", "event"],  // Which types to create
  "workspace_id": "1",

  // Optional: Entity selection (if not provided, create all)
  "selected_entities": {
    "actors": ["Vladimir Putin", "Russian Armed Forces"],
    "places": ["Kyiv", "Moscow"],
    "events": []  // Create all events
  },

  // Optional: Merge strategy
  "merge_duplicates": true,  // Check for existing entities
  "merge_threshold": 0.85    // Name similarity threshold (0-1)
}
```

**Response:**
```json
{
  "created": {
    "actors": [
      {
        "entity_id": "actor_123",
        "name": "Vladimir Putin",
        "type": "PERSON",
        "workspace_id": "1",
        "created": true,  // Newly created
        "merged_with": null
      },
      {
        "entity_id": "actor_125",
        "name": "Russian Armed Forces",
        "type": "ORGANIZATION",
        "workspace_id": "1",
        "created": true,
        "merged_with": null
      }
    ],
    "places": [
      {
        "entity_id": "place_456",
        "name": "Kyiv",
        "type": "CITY",
        "coordinates": {"lat": 50.4501, "lng": 30.5234},
        "country": "Ukraine",
        "workspace_id": "1",
        "created": true,
        "merged_with": null
      },
      {
        "entity_id": "place_457",
        "name": "Moscow",
        "type": "CITY",
        "coordinates": {"lat": 55.7558, "lng": 37.6173},
        "country": "Russia",
        "workspace_id": "1",
        "created": false,  // Already existed
        "merged_with": "place_400"  // Merged with existing entity
      }
    ],
    "events": []
  },

  // Summary
  "summary": {
    "total_created": 3,
    "total_merged": 1,
    "total_skipped": 0
  },

  // Content entity links created
  "content_entity_links": [
    {
      "content_analysis_id": 123,
      "entity_id": "actor_123",
      "entity_type": "ACTOR",
      "mention_count": 12,
      "extraction_method": "gpt",
      "confidence": 0.95
    },
    // ... more links
  ]
}
```

**Error Response (Geocoding Failed):**
```json
{
  "partial_success": true,
  "created": {
    "actors": [ /* ... */ ],
    "places": [],  // Empty due to errors
    "events": []
  },
  "errors": [
    {
      "entity_name": "Kyiv",
      "entity_type": "place",
      "error": "Geocoding API failed: Rate limit exceeded",
      "suggestion": "Retry with manual coordinates or wait 60 seconds"
    }
  ],
  "summary": {
    "total_created": 2,
    "total_errors": 1
  }
}
```

**Implementation Notes:**
1. Query `content_entities` table for entities to create
2. For each entity:
   - Check if already exists in workspace (by name similarity)
   - If exists and merge_duplicates=true: link to existing, don't create
   - If not exists: create new actor/place/event
3. For places: Call geocoding API to get coordinates
4. Create `content_entities` links for traceability
5. Return summary of created/merged/skipped entities

---

### GET /api/content-intelligence/content-usage

**Purpose:** Show all frameworks, evidence, entities using specific content

**Request:**
```http
GET /api/content-intelligence/content-usage?content_id=123
```

**Response:**
```json
{
  "content_id": 123,
  "url": "https://example.com/article",
  "title": "Russian Military Operations in Ukraine",

  // Frameworks using this content
  "frameworks": [
    {
      "framework_session_id": 456,
      "framework_type": "pmesii-pt",
      "title": "Russian Operations Analysis",
      "auto_populated": true,
      "user_reviewed": true,
      "created_at": "2025-10-08T10:35:00Z",
      "created_by": "user_1",
      "fields_populated": ["political", "military", "economic"]
    },
    {
      "framework_session_id": 457,
      "framework_type": "dime",
      "title": "DIME Analysis - Ukraine Conflict",
      "auto_populated": false,
      "user_reviewed": true,
      "created_at": "2025-10-08T11:00:00Z",
      "created_by": "user_1",
      "fields_populated": []
    }
  ],

  // Evidence items citing this content
  "evidence": [
    {
      "evidence_id": 789,
      "title": "Russian troop deployment estimates",
      "what_happened": "Russian Armed Forces deployed 150,000+ troops to Ukraine border",
      "source_paragraph": 5,
      "credibility": "4",
      "reliability": "B",
      "created_at": "2025-10-08T10:40:00Z",
      "created_by": "user_1"
    },
    {
      "evidence_id": 790,
      "title": "Economic sanctions impact",
      "what_happened": "Western sanctions targeting Russian energy exports and banks",
      "source_paragraph": 11,
      "credibility": "5",
      "reliability": "A",
      "created_at": "2025-10-08T10:45:00Z",
      "created_by": "user_1"
    }
  ],

  // Entities extracted from this content
  "entities": {
    "actors": [
      {
        "entity_id": "actor_123",
        "name": "Vladimir Putin",
        "type": "PERSON",
        "mention_count": 12,
        "created_from_content": true
      },
      {
        "entity_id": "actor_125",
        "name": "Russian Armed Forces",
        "type": "ORGANIZATION",
        "mention_count": 25,
        "created_from_content": true
      }
    ],
    "places": [
      {
        "entity_id": "place_456",
        "name": "Kyiv",
        "type": "CITY",
        "mention_count": 15,
        "created_from_content": true
      }
    ],
    "events": []
  },

  // Q&A history on this content
  "qa_sessions": [
    {
      "qa_id": 1001,
      "question": "What is Russia's stated justification for the operation?",
      "answer": "Russia claims denazification and demilitarization of Ukraine...",
      "confidence_score": 0.88,
      "created_at": "2025-10-08T11:30:00Z"
    }
  ],

  // Usage summary
  "usage_summary": {
    "total_frameworks": 2,
    "total_evidence": 2,
    "total_entities": 3,
    "total_qa_sessions": 1,
    "first_used_at": "2025-10-08T10:35:00Z",
    "last_used_at": "2025-10-08T11:30:00Z"
  }
}
```

**Implementation Notes:**
1. Query `framework_content_sources` for frameworks
2. Query `evidence_items` WHERE `source_content_id = content_id`
3. Query `content_entities` for extracted entities
4. Query `content_qa` for Q&A history
5. Return comprehensive usage report

---

## Response Formats

### Standard Success Response

```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "metadata": {
    "timestamp": "2025-10-08T10:30:00Z",
    "request_id": "req_abc123",
    "workspace_id": "1"
  }
}
```

### Standard Error Response

```json
{
  "success": false,
  "error": "User-friendly error message",
  "error_code": "CONTENT_EXTRACTION_FAILED",
  "technical_details": "HTTP 403 Forbidden from external site",
  "suggestion": "Try using bypass URLs or archive links",
  "metadata": {
    "timestamp": "2025-10-08T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

---

## Error Handling

### Error Codes

| Code | HTTP Status | Meaning | User Action |
|------|-------------|---------|-------------|
| `CONTENT_EXTRACTION_FAILED` | 422 | External site blocked/timeout | Use bypass URL |
| `DUPLICATE_CONTENT` | 200 | Content already analyzed | View cached result |
| `GPT_API_TIMEOUT` | 504 | OpenAI API timeout | Retry request |
| `WORKSPACE_QUOTA_EXCEEDED` | 429 | User hit free tier limit | Upgrade or wait |
| `INVALID_FRAMEWORK_TYPE` | 400 | Unknown framework type | Check framework list |
| `LOW_CONFIDENCE` | 422 | Auto-population confidence <50% | Manual framework creation |
| `GEOCODING_FAILED` | 502 | Google Geocoding API error | Manual coordinates or retry |
| `BOOKMARK_HASH_EXPIRED` | 401 | Bookmark hash expired (>30 days) | Re-analyze content |

### Retry Logic

**Client-side recommended retry strategy:**

```typescript
async function analyzeUrlWithRetry(url: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url, mode: 'full'})
      })

      if (response.ok) return await response.json()

      if (response.status === 422) {
        // Content extraction failed - don't retry
        const error = await response.json()
        throw new Error(error.error)
      }

      if (response.status === 504 || response.status === 503) {
        // Timeout or service unavailable - retry with backoff
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 2000))
          continue
        }
      }

      throw new Error(`HTTP ${response.status}`)

    } catch (error) {
      if (attempt === maxRetries) throw error
    }
  }
}
```

---

## Rate Limiting

**Free Tier Limits:**
- 10 content analyses per hour
- 5 framework auto-populations per day
- 20 entity extractions per day

**Authenticated User Limits:**
- 100 content analyses per hour
- 50 framework auto-populations per day
- Unlimited entity extractions

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1696784400
```

---

**End of API Specifications**
