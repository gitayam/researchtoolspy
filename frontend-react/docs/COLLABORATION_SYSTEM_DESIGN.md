# Collaboration System Design
**Research Tools - Intelligence Analysis Platform**

**Document Version**: 1.0
**Date**: 2025-10-07
**Status**: Design Specification

---

## Executive Summary

This document outlines a comprehensive collaboration and public library system for Research Tools, enabling:

1. **Team Workspaces**: Multi-user collaboration with role-based access control
2. **Resource Sharing**: Share evidence, frameworks, analyses, and entities within teams
3. **Public Library**: Community framework repository with voting, comments, and subscriptions
4. **Social Features**: Voting, ratings, comments, subscriptions, and notifications

### Current State (What Exists)
- ✅ Basic workspace infrastructure (PERSONAL, TEAM, PUBLIC types)
- ✅ Workspace invite system with secure tokens
- ✅ Team member management with roles (ADMIN, EDITOR, VIEWER)
- ✅ Comments system (threading, @mentions, resolve/unresolve)
- ✅ Public sharing for frameworks (COG, ACH) with share tokens
- ✅ Entity system (actors, sources, events, places, behaviors)
- ✅ Guest mode support (hash-based authentication)

### Gaps (What's Missing)
- ❌ Resource-level workspace isolation and permissions
- ❌ Public library discovery UI (browse, search, filter)
- ❌ Voting/rating system for public content
- ❌ Subscription system for framework updates
- ❌ Activity feed and notifications
- ❌ Framework versioning and attribution
- ❌ Advanced search across public library
- ❌ Resource usage analytics (views, clones, forks)

### Implementation Strategy
- **Phase 1**: Enhance existing workspace system with resource-level permissions (2-3 days)
- **Phase 2**: Build public library discovery and voting system (3-4 days)
- **Phase 3**: Add subscriptions and notifications (2-3 days)
- **Phase 4**: Analytics and advanced features (2-3 days)

**Total Estimated Time**: 9-13 days (2-3 weeks)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [System Architecture](#2-system-architecture)
3. [Database Schema Design](#3-database-schema-design)
4. [API Endpoints](#4-api-endpoints)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Data Flow](#6-data-flow)
7. [Integration Points](#7-integration-points)
8. [Implementation Plan](#8-implementation-plan)
9. [Testing Strategy](#9-testing-strategy)
10. [Security Considerations](#10-security-considerations)

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure

#### Workspace System (✅ Complete)
**Location**: `schema/migrations/005-create-entity-system.sql`

```sql
workspaces (
  id, name, description, type, owner_id,
  is_public, allow_cloning, entity_count,
  votes, stars, forks, views,
  created_at, updated_at
)

workspace_members (
  id, workspace_id, user_id, role, permissions,
  nickname, joined_at, joined_via_invite_id
)

workspace_invites (
  id, workspace_id, created_by_id, invite_token,
  default_role, max_uses, current_uses, expires_at,
  is_active, label, created_at, revoked_at
)
```

**Features**:
- Three workspace types: PERSONAL, TEAM, PUBLIC
- Role-based access: OWNER, ADMIN, EDITOR, VIEWER
- Secure invite links with expiry and usage limits
- Team member nicknames (workspace-specific identities)
- Multi-tenancy support

#### Comments System (✅ Complete)
**Location**: `schema/migrations/020-create-comments-table.sql`, `functions/api/comments.ts`

```sql
comments (
  id, entity_type, entity_id, parent_comment_id, thread_root_id, depth,
  content, content_html, user_id, user_hash,
  mentioned_users, status, resolved_at, resolved_by,
  workspace_id, reactions, created_at, updated_at
)

comment_mentions (id, comment_id, mentioned_user_id, read, read_at)
comment_notifications (id, user_id, comment_id, notification_type, read)
```

**Features**:
- Threaded comments with unlimited nesting
- @mentions with notifications
- Resolve/unresolve workflow
- Markdown support with HTML rendering
- Guest mode support (hash-based users)
- Soft delete (preserves thread structure)

#### Public Sharing (✅ Partial)
**Location**: `schema/migrations/012-add-public-sharing-to-frameworks.sql`

```sql
framework_sessions (
  ...,
  is_public, share_token, view_count, clone_count, category
)

VIEW public_frameworks (
  id, title, description, framework_type, category,
  share_token, view_count, clone_count, created_at, tags
)
```

**Features**:
- Public/private toggle for frameworks
- Unique share tokens for access
- View and clone counters
- Category classification
- Tag support for discovery

#### Entity System (✅ Complete)
**Location**: `schema/migrations/005-create-entity-system.sql`

```sql
actors, sources, events, places, behaviors, relationships
evidence_items, library_items
```

**Features**:
- Comprehensive entity types for intelligence work
- Workspace isolation (workspace_id on all entities)
- Library publishing support (library_items table exists but unused)
- Public/private toggle per entity

### 1.2 Authentication Patterns

**Bearer Token Authentication** (Primary)
```typescript
// functions/api/workspaces.ts
const authHeader = request.headers.get('Authorization')
const token = authHeader.substring(7) // "Bearer xxx"
const sessionData = await env.SESSIONS.get(token) // KV lookup
const session = JSON.parse(sessionData)
const userId = session.user_id
```

**Hash-Based Authentication** (Guest Mode)
```typescript
// functions/api/comments.ts
const userHash = request.headers.get('X-User-Hash')
// Used for guest users without accounts
```

**Dual Authentication Support**
```typescript
async function getUserFromRequest(request, env) {
  // Try bearer token first (authenticated users)
  if (authHeader?.startsWith('Bearer ')) { ... }

  // Fall back to hash (guest mode)
  const userHash = request.headers.get('X-User-Hash')
  return { userId, userHash }
}
```

### 1.3 Current Gaps Analysis

| Feature | Status | Gap Description |
|---------|--------|-----------------|
| Team Workspaces | ✅ Complete | Workspace creation, invites, members work |
| Resource Permissions | ❌ Missing | No workspace_id enforcement on frameworks/entities |
| Public Library UI | ❌ Missing | No discovery page, search, or browse functionality |
| Voting System | ⚠️ Partial | Tables have `votes` columns but no API/UI |
| Rating System | ❌ Missing | No star ratings (library_items has `stars` field unused) |
| Subscriptions | ❌ Missing | No way to follow frameworks or get updates |
| Activity Feed | ❌ Missing | No notification system (comment_notifications exists but unused) |
| Version History | ❌ Missing | No framework versioning or change tracking |
| Advanced Search | ❌ Missing | No full-text search across public content |
| Analytics | ⚠️ Partial | Basic counters exist (views, clones) but no detailed analytics |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│  Dashboard  │  Library  │  Workspace  │  Collaboration Page  │
│  - Analytics│  - Browse │  - Members  │  - Invites          │
│  - Feed     │  - Search │  - Settings │  - Shared Resources │
└─────────────┬───────────┴─────────────┴─────────────────────┘
              │
              │ REST API
              ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Pages Functions (Workers)            │
├─────────────────────────────────────────────────────────────┤
│  /api/workspaces      │  /api/library         │  /api/votes │
│  /api/frameworks      │  /api/subscriptions   │  /api/feed  │
│  /api/comments        │  /api/notifications   │  /api/stats │
└─────────────┬───────────────────────────┬───────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│   Cloudflare D1 (SQLite)│   │   Cloudflare KV (Cache)     │
├─────────────────────────┤   ├─────────────────────────────┤
│ - Workspaces            │   │ - Session tokens            │
│ - Frameworks            │   │ - Public library cache      │
│ - Entities              │   │ - Vote counts (fast read)   │
│ - Comments              │   │ - Activity feed cache       │
│ - Votes/Ratings         │   │ - Search index (optional)   │
│ - Subscriptions         │   └─────────────────────────────┘
│ - Notifications         │
└─────────────────────────┘
```

### 2.2 Multi-Tenant Architecture

**Workspace Isolation Strategy**:
- Every resource has `workspace_id` foreign key
- Queries always filter by `workspace_id` (except public library)
- Owner check: `workspace.owner_id = userId`
- Member check: `workspace_members WHERE user_id = userId AND workspace_id = X`

**Permission Hierarchy**:
```
OWNER (workspace.owner_id)
  └─ Full control: delete workspace, manage all settings, promote/demote members

ADMIN (workspace_members.role = 'ADMIN')
  └─ Manage members, manage invites, edit workspace settings, manage all resources

EDITOR (workspace_members.role = 'EDITOR')
  └─ Create/edit/delete own resources, comment, vote, clone public content

VIEWER (workspace_members.role = 'VIEWER')
  └─ Read-only: view resources, comment (optional), clone public content
```

**Public Library Access**:
- Anyone (including guests) can view public frameworks
- Authenticated users can vote, comment, subscribe
- Original workspace_id preserved for attribution
- Cloning creates new resource in user's workspace

### 2.3 Component Architecture

```
src/pages/
  ├── DashboardPage.tsx (Activity feed, quick stats)
  ├── CollaborationPage.tsx (✅ Exists - Team management)
  ├── PublicLibraryPage.tsx (NEW - Browse/search public frameworks)
  └── WorkspaceSettingsPage.tsx (NEW - Advanced workspace config)

src/components/
  ├── library/
  │   ├── LibraryBrowser.tsx (Grid/list view of public frameworks)
  │   ├── LibraryFilters.tsx (Category, type, sort filters)
  │   ├── LibrarySearch.tsx (Full-text search)
  │   ├── FrameworkCard.tsx (Preview card with vote/star buttons)
  │   └── FrameworkDetail.tsx (Full view with comments, clone button)
  │
  ├── collaboration/
  │   ├── WorkspaceSelector.tsx (✅ Exists in CollaborationPage)
  │   ├── MemberList.tsx (✅ Exists in CollaborationPage)
  │   ├── InviteManager.tsx (✅ Exists in CollaborationPage)
  │   ├── SharedResourcesList.tsx (NEW - Frameworks/entities shared in workspace)
  │   └── PermissionsEditor.tsx (NEW - Fine-grained permissions)
  │
  ├── social/
  │   ├── VoteButton.tsx (Upvote/downvote with count)
  │   ├── StarRating.tsx (5-star rating system)
  │   ├── SubscribeButton.tsx (Follow framework for updates)
  │   └── ShareDialog.tsx (Share to public library)
  │
  ├── activity/
  │   ├── ActivityFeed.tsx (Recent team activity)
  │   ├── NotificationBell.tsx (Unread notifications indicator)
  │   └── NotificationList.tsx (Dropdown with notifications)
  │
  └── comments/
      └── CommentThread.tsx (✅ Exists - Threaded comments)
```

---

## 3. Database Schema Design

### 3.1 New Tables Required

#### 3.1.1 Framework Votes

```sql
-- Migration 021: Framework voting system
CREATE TABLE IF NOT EXISTS framework_votes (
  id TEXT PRIMARY KEY,

  -- Voting
  framework_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,  -- Can be numeric user_id or hash for guests
  user_hash TEXT,         -- Hash for guest users
  vote_type TEXT CHECK(vote_type IN ('UPVOTE', 'DOWNVOTE')) NOT NULL,

  -- Metadata
  workspace_id INTEGER NOT NULL DEFAULT 1,
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  UNIQUE(framework_id, user_id)  -- One vote per user per framework
);

CREATE INDEX idx_framework_votes_framework ON framework_votes(framework_id);
CREATE INDEX idx_framework_votes_user ON framework_votes(user_id);
CREATE INDEX idx_framework_votes_type ON framework_votes(vote_type);
```

**Rationale**:
- Separate table allows tracking individual votes
- Guest support via user_hash
- Vote aggregation done via COUNT queries
- UNIQUE constraint prevents duplicate votes

#### 3.1.2 Framework Ratings

```sql
-- Migration 021: Framework rating system
CREATE TABLE IF NOT EXISTS framework_ratings (
  id TEXT PRIMARY KEY,

  -- Rating
  framework_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  user_hash TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5) NOT NULL,

  -- Review
  review_text TEXT,         -- Optional written review
  review_title TEXT,        -- Optional review headline

  -- Metadata
  workspace_id INTEGER NOT NULL DEFAULT 1,
  rated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  UNIQUE(framework_id, user_id)  -- One rating per user per framework
);

CREATE INDEX idx_framework_ratings_framework ON framework_ratings(framework_id);
CREATE INDEX idx_framework_ratings_user ON framework_ratings(user_id);
CREATE INDEX idx_framework_ratings_rating ON framework_ratings(rating);
```

**Rationale**:
- 5-star rating system (standard for quality feedback)
- Optional review text for detailed feedback
- Average rating calculated on-demand: `AVG(rating)`
- Updated_at tracks rating changes

#### 3.1.3 Framework Subscriptions

```sql
-- Migration 021: Framework subscription system
CREATE TABLE IF NOT EXISTS framework_subscriptions (
  id TEXT PRIMARY KEY,

  -- Subscription
  framework_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  user_hash TEXT,

  -- Preferences
  notify_updates INTEGER DEFAULT 1,      -- Notify on framework updates
  notify_comments INTEGER DEFAULT 1,     -- Notify on new comments
  notify_forks INTEGER DEFAULT 0,        -- Notify when forked

  -- Metadata
  workspace_id INTEGER NOT NULL DEFAULT 1,
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_notified_at TEXT,                 -- Last notification sent

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  UNIQUE(framework_id, user_id)
);

CREATE INDEX idx_framework_subscriptions_framework ON framework_subscriptions(framework_id);
CREATE INDEX idx_framework_subscriptions_user ON framework_subscriptions(user_id);
```

**Rationale**:
- Subscribe to frameworks to get update notifications
- Granular notification preferences
- Tracks last notification to prevent spam
- Auto-subscribe on comment/rating (optional behavior)

#### 3.1.4 Activity Feed

```sql
-- Migration 021: Activity feed for team workspaces
CREATE TABLE IF NOT EXISTS activity_feed (
  id TEXT PRIMARY KEY,

  -- Activity
  workspace_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,           -- User who performed action
  actor_user_hash TEXT,
  action_type TEXT NOT NULL,             -- CREATED, UPDATED, DELETED, COMMENTED, VOTED, RATED, SHARED, FORKED

  -- Target
  entity_type TEXT NOT NULL,             -- FRAMEWORK, ENTITY, COMMENT, WORKSPACE
  entity_id TEXT NOT NULL,
  entity_title TEXT,                     -- Denormalized for fast display

  -- Metadata
  details TEXT,                          -- JSON with action-specific details
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_feed_workspace ON activity_feed(workspace_id, created_at DESC);
CREATE INDEX idx_activity_feed_actor ON activity_feed(actor_user_id);
CREATE INDEX idx_activity_feed_entity ON activity_feed(entity_type, entity_id);
```

**Rationale**:
- Workspace-scoped activity feed
- Efficient querying by workspace + recency
- Denormalized entity_title for fast display (avoids JOINs)
- JSON details for flexible action metadata

#### 3.1.5 User Notifications

```sql
-- Migration 021: User notification system
CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,

  -- Notification
  user_id TEXT NOT NULL,
  user_hash TEXT,
  notification_type TEXT NOT NULL,       -- MENTION, REPLY, SUBSCRIPTION_UPDATE, VOTE, RATE, SHARE

  -- Source
  source_type TEXT NOT NULL,             -- COMMENT, FRAMEWORK, ACTIVITY
  source_id TEXT NOT NULL,

  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,                         -- Deep link to relevant page

  -- State
  read INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Workspace context
  workspace_id TEXT
);

CREATE INDEX idx_user_notifications_user ON user_notifications(user_id, read, created_at DESC);
CREATE INDEX idx_user_notifications_type ON user_notifications(notification_type);
```

**Rationale**:
- User-centric notifications (not workspace-centric)
- Tracks read status
- Deep links for quick navigation
- Supports multiple notification types

### 3.2 Schema Modifications to Existing Tables

#### 3.2.1 framework_sessions (COG, ACH, etc.)

**Add workspace_id for isolation**:
```sql
-- Migration 021: Add workspace isolation to frameworks
ALTER TABLE framework_sessions ADD COLUMN workspace_id TEXT;
ALTER TABLE framework_sessions ADD COLUMN published_to_library INTEGER DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN library_published_at TEXT;
ALTER TABLE framework_sessions ADD COLUMN original_workspace_id TEXT;  -- For attribution
ALTER TABLE framework_sessions ADD COLUMN fork_parent_id INTEGER;      -- Track forks
ALTER TABLE framework_sessions ADD COLUMN version INTEGER DEFAULT 1;   -- Versioning

CREATE INDEX idx_framework_sessions_workspace ON framework_sessions(workspace_id);
CREATE INDEX idx_framework_sessions_library ON framework_sessions(published_to_library, is_public);
CREATE INDEX idx_framework_sessions_fork ON framework_sessions(fork_parent_id);
```

**Rationale**:
- `workspace_id`: Enforce workspace isolation
- `published_to_library`: Separate public sharing from library publishing
- `original_workspace_id`: Preserve creator attribution when forked
- `fork_parent_id`: Track framework genealogy
- `version`: Enable versioning for change tracking

#### 3.2.2 Update library_items usage

**Currently unused - activate for public library**:
```sql
-- Migration 021: Activate library_items for frameworks
-- No schema changes needed - table already exists!
-- Just need to populate it when frameworks are published

-- Usage:
INSERT INTO library_items (
  id, entity_type, entity_id, published_by, workspace_id,
  status, tags, categories, original_creator, license
) VALUES (...);
```

**Rationale**:
- Reuse existing `library_items` table (already well-designed)
- Separates library metadata from framework data
- Enables moderation workflow (PENDING, APPROVED, FLAGGED)

### 3.3 Indexes for Performance

```sql
-- Migration 021: Performance indexes

-- Fast public library queries
CREATE INDEX idx_library_items_status_votes ON library_items(status, votes DESC);
CREATE INDEX idx_library_items_status_stars ON library_items(status, stars DESC);
CREATE INDEX idx_library_items_tags ON library_items(tags);
CREATE INDEX idx_library_items_categories ON library_items(categories);

-- Fast vote aggregation
CREATE INDEX idx_framework_votes_framework_type ON framework_votes(framework_id, vote_type);

-- Fast subscription lookups
CREATE INDEX idx_framework_subscriptions_user_framework ON framework_subscriptions(user_id, framework_id);

-- Fast notification queries
CREATE INDEX idx_user_notifications_user_unread ON user_notifications(user_id, read, created_at DESC);
```

---

## 4. API Endpoints

### 4.1 Voting & Rating APIs

#### POST /api/frameworks/:id/vote
**Purpose**: Cast or change vote on a framework

**Request**:
```json
{
  "vote_type": "UPVOTE" | "DOWNVOTE"
}
```

**Response**:
```json
{
  "success": true,
  "vote_count": {
    "upvotes": 42,
    "downvotes": 3,
    "total": 39
  }
}
```

**Logic**:
1. Authenticate user (bearer token or hash)
2. Verify framework exists and is public
3. Upsert vote (update if exists, insert if new)
4. Return updated vote counts
5. Update KV cache with new counts

#### POST /api/frameworks/:id/rate
**Purpose**: Rate a framework (1-5 stars)

**Request**:
```json
{
  "rating": 4,
  "review_title": "Excellent COG analysis",
  "review_text": "Very thorough identification of vulnerabilities..."
}
```

**Response**:
```json
{
  "success": true,
  "rating_stats": {
    "average_rating": 4.2,
    "total_ratings": 27,
    "distribution": {
      "5": 12,
      "4": 10,
      "3": 3,
      "2": 1,
      "1": 1
    }
  }
}
```

### 4.2 Subscription APIs

#### POST /api/frameworks/:id/subscribe
**Purpose**: Subscribe to framework updates

**Request**:
```json
{
  "notify_updates": true,
  "notify_comments": true,
  "notify_forks": false
}
```

**Response**:
```json
{
  "success": true,
  "subscription": {
    "id": "sub-123",
    "framework_id": 456,
    "subscribed_at": "2025-10-07T10:30:00Z",
    "preferences": { ... }
  }
}
```

#### DELETE /api/frameworks/:id/subscribe
**Purpose**: Unsubscribe from framework

**Response**:
```json
{
  "success": true,
  "message": "Unsubscribed successfully"
}
```

#### GET /api/subscriptions
**Purpose**: List user's subscriptions

**Query Params**:
- `workspace_id`: Filter by workspace (optional)
- `limit`: Pagination limit (default: 50)
- `offset`: Pagination offset

**Response**:
```json
{
  "subscriptions": [
    {
      "id": "sub-123",
      "framework": {
        "id": 456,
        "title": "Russian Military COG Analysis",
        "framework_type": "COG",
        "updated_at": "2025-10-07T09:00:00Z"
      },
      "has_updates": true,
      "last_notified_at": "2025-10-06T12:00:00Z",
      "preferences": { ... }
    }
  ],
  "total": 15
}
```

### 4.3 Public Library APIs

#### GET /api/library
**Purpose**: Browse/search public frameworks

**Query Params**:
- `q`: Search query (full-text)
- `framework_type`: Filter by type (COG, ACH, etc.)
- `category`: Filter by category
- `tags`: Comma-separated tags
- `sort`: Sort by (votes, stars, views, recent, clones)
- `limit`, `offset`: Pagination

**Response**:
```json
{
  "frameworks": [
    {
      "id": 123,
      "title": "Russian Logistics COG Analysis",
      "description": "Analysis of Russian military logistics...",
      "framework_type": "COG",
      "category": "Military",
      "tags": ["russia", "logistics", "cog"],
      "share_token": "abc123",
      "author": {
        "workspace_id": "ws-456",
        "workspace_name": "OSINT Analysis Team"
      },
      "stats": {
        "votes": 42,
        "average_rating": 4.5,
        "total_ratings": 12,
        "views": 340,
        "clones": 8,
        "comments": 15
      },
      "published_at": "2025-09-15T10:00:00Z",
      "updated_at": "2025-10-01T14:30:00Z"
    }
  ],
  "total": 127,
  "page": 1,
  "pages": 13
}
```

#### GET /api/library/:id
**Purpose**: Get detailed framework view with comments

**Response**:
```json
{
  "framework": { ... },  // Full framework data
  "comments": [ ... ],   // Top-level comments
  "ratings": [ ... ],    // Recent ratings with reviews
  "related": [ ... ],    // Similar frameworks
  "user_interaction": {
    "voted": "UPVOTE",
    "rated": 4,
    "subscribed": true,
    "cloned": false
  }
}
```

#### POST /api/library/:id/clone
**Purpose**: Clone public framework to user's workspace

**Request**:
```json
{
  "target_workspace_id": "ws-789"
}
```

**Response**:
```json
{
  "success": true,
  "cloned_framework": {
    "id": 999,
    "title": "[Cloned] Russian Logistics COG Analysis",
    "workspace_id": "ws-789",
    "fork_parent_id": 123,
    "created_at": "2025-10-07T11:00:00Z"
  }
}
```

**Logic**:
1. Verify source framework is public
2. Deep copy framework data to new record
3. Set `workspace_id` to user's workspace
4. Set `fork_parent_id` to original framework
5. Increment clone_count on original
6. Return new framework

### 4.4 Activity Feed APIs

#### GET /api/workspaces/:id/activity
**Purpose**: Get recent activity in workspace

**Query Params**:
- `limit`: Number of items (default: 50)
- `offset`: Pagination
- `action_types`: Filter by action types (comma-separated)
- `since`: ISO timestamp (only newer activities)

**Response**:
```json
{
  "activities": [
    {
      "id": "act-123",
      "actor": {
        "user_id": "user-456",
        "nickname": "Analyst Jane"
      },
      "action_type": "CREATED",
      "entity_type": "FRAMEWORK",
      "entity": {
        "id": 789,
        "title": "New COG Analysis",
        "url": "/frameworks/cog/789"
      },
      "created_at": "2025-10-07T10:30:00Z"
    },
    {
      "id": "act-124",
      "actor": { ... },
      "action_type": "COMMENTED",
      "entity_type": "FRAMEWORK",
      "entity": { ... },
      "details": {
        "comment_preview": "Great analysis of the supply chain..."
      },
      "created_at": "2025-10-07T10:15:00Z"
    }
  ],
  "has_more": true,
  "next_offset": 50
}
```

### 4.5 Notification APIs

#### GET /api/notifications
**Purpose**: Get user's notifications

**Query Params**:
- `unread_only`: boolean (default: false)
- `limit`, `offset`: Pagination

**Response**:
```json
{
  "notifications": [
    {
      "id": "notif-123",
      "type": "MENTION",
      "title": "You were mentioned",
      "message": "Analyst Jane mentioned you in a comment",
      "link_url": "/frameworks/cog/789#comment-456",
      "read": false,
      "created_at": "2025-10-07T10:00:00Z"
    }
  ],
  "unread_count": 5,
  "total": 42
}
```

#### PATCH /api/notifications/:id/read
**Purpose**: Mark notification as read

**Response**:
```json
{
  "success": true
}
```

#### POST /api/notifications/mark-all-read
**Purpose**: Mark all notifications as read

**Response**:
```json
{
  "success": true,
  "marked_count": 5
}
```

### 4.6 Enhanced Workspace APIs

#### GET /api/workspaces/:id/resources
**Purpose**: List all resources in workspace (frameworks, entities, etc.)

**Query Params**:
- `resource_type`: Filter by type (FRAMEWORK, ACTOR, SOURCE, etc.)
- `shared_only`: boolean (only show shared resources)
- `limit`, `offset`: Pagination

**Response**:
```json
{
  "resources": [
    {
      "type": "FRAMEWORK",
      "id": 123,
      "title": "COG Analysis - Target Alpha",
      "created_by": "user-456",
      "created_at": "2025-10-01T10:00:00Z",
      "is_public": false,
      "shared_with": ["ws-789", "ws-101"]
    }
  ],
  "total": 47
}
```

#### POST /api/workspaces/:id/share-resource
**Purpose**: Share resource with another workspace

**Request**:
```json
{
  "resource_type": "FRAMEWORK",
  "resource_id": 123,
  "target_workspace_ids": ["ws-789"],
  "permission_level": "READ" | "EDIT"
}
```

**Response**:
```json
{
  "success": true,
  "shared_with": 1
}
```

---

## 5. Authentication & Authorization

### 5.1 Authentication Methods

**1. Bearer Token (Primary)**
```typescript
// Token stored in KV after login
// Format: { user_id: 123, created_at: "...", expires_at: "..." }
const token = request.headers.get('Authorization')?.substring(7)
const session = JSON.parse(await env.SESSIONS.get(token))
```

**2. Hash-Based (Guest Mode)**
```typescript
// Guest users identified by browser-generated hash
const userHash = request.headers.get('X-User-Hash')
// Used for: voting, rating, commenting (limited features)
```

### 5.2 Authorization Rules

#### Workspace-Level Permissions

| Role | Create | Read | Update | Delete | Manage Members | Manage Settings |
|------|--------|------|--------|--------|----------------|-----------------|
| OWNER | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ (own) | ✅ | ✅ |
| EDITOR | ✅ | ✅ | ✅ (own) | ✅ (own) | ❌ | ❌ |
| VIEWER | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

#### Resource-Level Permissions

**Private Resources** (workspace_id set, is_public=0):
- Only workspace owner + members can access
- Role-based permissions apply

**Public Resources** (is_public=1):
- Anyone can view (including guests)
- Only authenticated users can: vote, rate, comment, subscribe
- Only creator can: edit, delete, unpublish

**Library Resources** (published_to_library=1):
- Public + discoverable in library
- Same permissions as public resources
- Additional: anyone can clone to their workspace

### 5.3 Permission Check Flow

```typescript
async function checkResourceAccess(
  userId: string | null,
  userHash: string | null,
  resourceId: string,
  resourceType: string,
  requiredPermission: 'READ' | 'WRITE' | 'DELETE'
): Promise<boolean> {
  // 1. Fetch resource with workspace_id
  const resource = await db.get(resourceType, resourceId)

  // 2. Check if public (anyone can READ)
  if (resource.is_public && requiredPermission === 'READ') {
    return true
  }

  // 3. Check if creator (full access)
  if (userId && resource.created_by === userId) {
    return true
  }

  // 4. Check workspace membership
  if (userId && resource.workspace_id) {
    const member = await db.query(`
      SELECT role FROM workspace_members
      WHERE workspace_id = ? AND user_id = ?
    `, [resource.workspace_id, userId])

    if (member) {
      // Apply role-based permissions
      return checkRolePermission(member.role, requiredPermission)
    }
  }

  // 5. Default deny
  return false
}
```

---

## 6. Data Flow

### 6.1 Publishing Framework to Public Library

```
┌──────────────┐
│   User       │
│   Action     │
└──────┬───────┘
       │
       │ 1. Click "Publish to Library"
       ▼
┌──────────────────────────────────┐
│  Frontend: PublishDialog         │
│  - Select category/tags          │
│  - Set license                   │
│  - Confirm public visibility     │
└──────┬───────────────────────────┘
       │
       │ 2. POST /api/frameworks/:id/publish
       ▼
┌──────────────────────────────────┐
│  API: Publish Handler            │
│  - Verify ownership              │
│  - Update framework:             │
│    * is_public = 1               │
│    * published_to_library = 1    │
│    * library_published_at = now  │
│  - Create library_items entry    │
│  - Trigger notifications         │
└──────┬───────────────────────────┘
       │
       │ 3. Update database
       ▼
┌──────────────────────────────────┐
│  Database                        │
│  framework_sessions:             │
│    UPDATE is_public,             │
│           published_to_library   │
│  library_items:                  │
│    INSERT new entry              │
└──────┬───────────────────────────┘
       │
       │ 4. Invalidate cache
       ▼
┌──────────────────────────────────┐
│  KV Cache                        │
│  - Clear public_frameworks cache │
│  - Clear library index cache     │
└──────┬───────────────────────────┘
       │
       │ 5. Notify subscribers
       ▼
┌──────────────────────────────────┐
│  Notification System             │
│  - Find workspace subscribers    │
│  - Create notifications          │
│  - Send to activity feed         │
└──────────────────────────────────┘
```

### 6.2 Voting on Framework

```
User clicks Vote    →  POST /api/frameworks/:id/vote
                    ↓
                Check auth (bearer token or hash)
                    ↓
                Verify framework is public
                    ↓
                UPSERT framework_votes
                    ↓
         ┌──────────┴──────────┐
         ▼                     ▼
    Update D1 database    Update KV cache
    (source of truth)     (vote_count:123)
         │                     │
         └──────────┬──────────┘
                    ↓
           Return vote counts
                    ↓
         Update UI immediately
```

### 6.3 Subscription & Notification Flow

```
User subscribes to framework
         ↓
POST /api/frameworks/:id/subscribe
         ↓
INSERT framework_subscriptions
         ↓
         ┌───────────[Framework updated later]──────────┐
         │                                               │
         ▼                                               ▼
Framework owner saves changes              Background job checks
         ↓                                for subscriptions
UPDATE framework_sessions                          ↓
    (updated_at = now)                   SELECT * FROM
         ↓                              framework_subscriptions
         ↓                            WHERE framework_id = X
         ├─────────────────────────────────┘
         ▼
For each subscriber:
    INSERT user_notifications
         ↓
User sees notification bell
         ↓
User clicks, opens dropdown
         ↓
GET /api/notifications
         ↓
Display list with deep links
```

---

## 7. Integration Points

### 7.1 Existing Features Integration

#### Comments System (✅ Already Integrated)
- Comments already support `entity_type` and `entity_id`
- Can comment on: frameworks, hypotheses, entities, vulnerabilities
- Already has @mentions and notifications
- **Action**: Ensure comments display on public library pages

#### Network Graph
- **Integration**: Show frameworks linked to entities
- **API**: GET /api/frameworks?entity_id=X
- **UI**: "View Related Frameworks" button on entity detail page
- **Data**: Use existing `cog_analysis_id`, `causeway_analysis_id` foreign keys

#### Evidence Collection
- **Integration**: Share evidence between workspace members
- **API**: GET /api/evidence?workspace_id=X
- **UI**: Workspace-scoped evidence browser
- **Permission**: Filter by workspace_id in queries

#### Export Functions (PowerPoint, Excel, PDF)
- **Integration**: Add library attribution to exports
- **Change**: Include "Source: [Workspace Name] via Research Tools Library"
- **Data**: Fetch from `original_workspace_id` and `workspaces` table

### 7.2 Framework Types Covered

| Framework Type | Table | Public Sharing | Library Support | Status |
|----------------|-------|----------------|-----------------|--------|
| COG Analysis | framework_sessions | ✅ | ✅ (add) | Primary |
| ACH Analysis | ach_analyses | ✅ | ✅ (add) | Primary |
| SWOT Analysis | framework_sessions | ⚠️ (partial) | ✅ (add) | Secondary |
| PMESII-PT | framework_sessions | ⚠️ (partial) | ✅ (add) | Secondary |
| Causeway | framework_sessions | ⚠️ (partial) | ✅ (add) | Secondary |

**Action Required**:
- Extend public sharing to all framework types
- Add `framework_type` filter in library APIs
- Create type-specific preview cards

### 7.3 Entity Types Integration

| Entity Type | Table | Workspace Isolation | Library Support |
|-------------|-------|---------------------|-----------------|
| Actors | actors | ✅ | ⚠️ (future) |
| Sources | sources | ✅ | ⚠️ (future) |
| Events | events | ✅ | ⚠️ (future) |
| Places | places | ✅ | ⚠️ (future) |
| Behaviors | behaviors | ✅ | ⚠️ (future) |
| Evidence | evidence_items | ⚠️ (needs workspace_id) | ⚠️ (future) |

**Recommendation**: Phase 1 focuses on frameworks only. Entity library can be Phase 5.

---

## 8. Implementation Plan

### Phase 1: Workspace Resource Isolation (2-3 days)

**Goal**: Enforce workspace_id on all resources

**Tasks**:
1. Add `workspace_id` column to `framework_sessions` (migration)
2. Update all framework APIs to filter by `workspace_id`
3. Add workspace selector to framework creation forms
4. Update evidence_items with `workspace_id`
5. Test multi-workspace isolation
6. Update CollaborationPage to show shared resources

**Files to Modify**:
- `schema/migrations/021-workspace-isolation.sql`
- `functions/api/frameworks.ts`
- `functions/api/ach/index.ts`
- `src/pages/CollaborationPage.tsx`
- `src/components/frameworks/COGForm.tsx`

**Testing**:
- Create multiple workspaces
- Verify resources don't leak between workspaces
- Test role-based permissions (ADMIN, EDITOR, VIEWER)

---

### Phase 2: Public Library Discovery (3-4 days)

**Goal**: Build public library UI with voting and ratings

**Tasks**:
1. Create database tables (votes, ratings, subscriptions)
2. Implement voting API endpoints
3. Implement rating API endpoints
4. Build PublicLibraryPage component
5. Build LibraryBrowser with filters
6. Add VoteButton and StarRating components
7. Add "Publish to Library" button to frameworks
8. Test public discovery and interaction

**Files to Create**:
- `schema/migrations/022-library-system.sql`
- `functions/api/library/index.ts`
- `functions/api/library/[id]/vote.ts`
- `functions/api/library/[id]/rate.ts`
- `src/pages/PublicLibraryPage.tsx`
- `src/components/library/LibraryBrowser.tsx`
- `src/components/library/FrameworkCard.tsx`
- `src/components/social/VoteButton.tsx`
- `src/components/social/StarRating.tsx`

**Testing**:
- Publish framework to library
- Vote and rate as different users
- Search and filter library
- Clone framework to personal workspace

---

### Phase 3: Subscriptions & Notifications (2-3 days)

**Goal**: Enable users to follow frameworks and get updates

**Tasks**:
1. Create subscriptions and notifications tables
2. Implement subscription API endpoints
3. Implement notification API endpoints
4. Build NotificationBell component
5. Build SubscribeButton component
6. Add notification generation on framework updates
7. Test subscription workflow end-to-end

**Files to Create**:
- `schema/migrations/023-notifications.sql`
- `functions/api/subscriptions.ts`
- `functions/api/notifications.ts`
- `src/components/activity/NotificationBell.tsx`
- `src/components/activity/NotificationList.tsx`
- `src/components/social/SubscribeButton.tsx`

**Testing**:
- Subscribe to framework
- Update framework as owner
- Verify notification sent to subscriber
- Test notification read status
- Test unsubscribe

---

### Phase 4: Activity Feed & Analytics (2-3 days)

**Goal**: Show team activity and usage statistics

**Tasks**:
1. Create activity_feed table
2. Implement activity logging in all APIs
3. Build ActivityFeed component
4. Add activity feed to DashboardPage
5. Add analytics to library detail pages
6. Build usage charts (views, votes, clones over time)

**Files to Create**:
- `schema/migrations/024-activity-feed.sql`
- `functions/api/activity.ts`
- `src/components/activity/ActivityFeed.tsx`
- `src/components/library/FrameworkAnalytics.tsx`

**Testing**:
- Perform various actions (create, edit, comment, vote)
- Verify activity appears in feed
- Check analytics accuracy
- Test workspace-scoped vs. global activity

---

### Phase 5: Advanced Features (Future)

**Optional enhancements** (not in initial scope):

1. **Framework Versioning**
   - Track changes over time
   - Version comparison view
   - Rollback capability

2. **Advanced Search**
   - Full-text search across all fields
   - Faceted search (multi-filter)
   - Search suggestions

3. **Entity Library**
   - Publish actors, sources, behaviors to library
   - Entity templates and presets
   - Entity import/export

4. **Collaboration Features**
   - Real-time co-editing
   - Change proposals and reviews
   - Workflow automation

5. **AI Integration**
   - Recommend frameworks based on analysis
   - Auto-suggest related frameworks
   - Content quality scoring

---

## 9. Testing Strategy

### 9.1 Unit Testing

**Database Layer**:
```typescript
// Test workspace isolation
describe('Framework Queries', () => {
  it('should only return frameworks in user workspace', async () => {
    const user1Frameworks = await getFrameworks(userId: 1, workspaceId: 'ws-1')
    const user2Frameworks = await getFrameworks(userId: 2, workspaceId: 'ws-2')

    expect(user1Frameworks).not.toContainEqual(user2Frameworks[0])
  })
})

// Test voting logic
describe('Voting System', () => {
  it('should prevent duplicate votes', async () => {
    await castVote(userId: 1, frameworkId: 123, type: 'UPVOTE')
    const result = await castVote(userId: 1, frameworkId: 123, type: 'DOWNVOTE')

    expect(result.vote_type).toBe('DOWNVOTE') // Updated, not duplicate
  })
})
```

**API Layer**:
```typescript
// Test authorization
describe('Library API', () => {
  it('should return 403 for editing others frameworks', async () => {
    const response = await fetch('/api/frameworks/123', {
      method: 'PUT',
      headers: { Authorization: 'Bearer user-2-token' }
    })

    expect(response.status).toBe(403)
  })
})
```

### 9.2 Integration Testing

**End-to-End Workflows**:
1. **Publish Workflow**
   - Create framework → Publish to library → Verify in library browser
   - Vote on framework → Verify vote count updates
   - Subscribe → Update framework → Verify notification sent

2. **Collaboration Workflow**
   - Create workspace → Invite member → Member joins
   - Create framework in workspace → Verify member can view
   - Test EDITOR can edit, VIEWER cannot

3. **Guest Mode**
   - Browse library as guest → Vote/rate as guest
   - Verify guest votes counted separately
   - Verify guest cannot access private workspaces

### 9.3 Performance Testing

**Scenarios**:
1. Library with 10,000+ frameworks
   - Measure query time for paginated list
   - Test search performance
   - Verify indexes used (EXPLAIN QUERY PLAN)

2. High vote volume
   - 100 concurrent votes on same framework
   - Verify vote count accuracy
   - Check KV cache performance

3. Notification generation
   - Framework with 1,000 subscribers
   - Measure notification creation time
   - Test batch notification processing

### 9.4 Security Testing

**Test Cases**:
1. **Authorization Bypass Attempts**
   - Try accessing private workspace resources via direct URL
   - Attempt voting without authentication
   - Try SQL injection in search queries

2. **Rate Limiting**
   - Rapid voting attempts (prevent abuse)
   - Bulk subscription attempts
   - Comment spam prevention

3. **Data Leakage**
   - Verify workspace_id filtering in all queries
   - Test guest mode doesn't expose private data
   - Check error messages don't leak sensitive info

---

## 10. Security Considerations

### 10.1 Access Control

**Principle of Least Privilege**:
- Default to private (is_public=0, published_to_library=0)
- Explicit publishing required for library
- Workspace members inherit minimal permissions by default

**Workspace Isolation**:
```typescript
// ✅ CORRECT: Always filter by workspace_id
const frameworks = await db.query(`
  SELECT * FROM framework_sessions
  WHERE workspace_id = ?
`, [userWorkspaceId])

// ❌ WRONG: Exposes all frameworks
const frameworks = await db.query(`
  SELECT * FROM framework_sessions
`)
```

### 10.2 Input Validation

**Vote/Rate APIs**:
```typescript
// Validate vote type
if (!['UPVOTE', 'DOWNVOTE'].includes(voteType)) {
  return res.status(400).json({ error: 'Invalid vote type' })
}

// Validate rating range
const rating = parseInt(req.body.rating)
if (rating < 1 || rating > 5) {
  return res.status(400).json({ error: 'Rating must be 1-5' })
}
```

**Search Queries**:
```typescript
// Use parameterized queries (D1 handles escaping)
const results = await db.prepare(`
  SELECT * FROM library_items
  WHERE entity_id IN (
    SELECT id FROM framework_sessions
    WHERE title LIKE ?
  )
`).bind(`%${searchQuery}%`).all()
```

### 10.3 Rate Limiting

**Per-User Limits** (implement in API):
```typescript
// KV-based rate limiting
const rateLimitKey = `ratelimit:vote:${userId}:${frameworkId}`
const recentVotes = await env.KV.get(rateLimitKey)

if (recentVotes && parseInt(recentVotes) > 5) {
  return res.status(429).json({ error: 'Too many requests' })
}

await env.KV.put(rateLimitKey, '1', { expirationTtl: 60 }) // 1 min cooldown
```

**Suggested Limits**:
- Voting: 10 votes per minute per user
- Rating: 1 rating per framework per user (enforced by UNIQUE constraint)
- Comments: 5 comments per minute per user
- Subscriptions: 100 subscriptions per user

### 10.4 Data Privacy

**Guest Users**:
- Hash-based IDs never link to real identities
- Guest votes/ratings stored separately
- Guest comments clearly marked
- No email or PII collected for guests

**Workspace Privacy**:
- Private workspaces invisible in library
- Member lists only visible to workspace members
- Invite tokens are UUID v4 (128-bit entropy)
- Invite links can be revoked instantly

**Library Content**:
- Original creator always attributed
- Workspace name shown (not individual user names)
- Clones track genealogy but don't expose private versions
- Unpublishing removes from library immediately

### 10.5 GDPR Compliance

**Right to Access**:
- User can export all their data (frameworks, votes, ratings, comments)
- Workspace owners can export workspace data

**Right to Delete**:
- User can delete their account (soft delete)
- Frameworks remain attributed to workspace (not individual)
- Comments show "[deleted user]" instead of name

**Data Retention**:
- Activity feed entries: 90 days (configurable)
- Notifications: 30 days (configurable)
- Deleted content: 30-day grace period before hard delete

---

## Appendix A: Database Migration Scripts

### Migration 021: Workspace Isolation & Library Foundation

```sql
-- ============================================================================
-- Migration 021: Workspace Isolation & Library Foundation
-- Description: Add workspace_id to frameworks, enable library publishing
-- ============================================================================

-- Add workspace fields to framework_sessions
ALTER TABLE framework_sessions ADD COLUMN workspace_id TEXT;
ALTER TABLE framework_sessions ADD COLUMN published_to_library INTEGER DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN library_published_at TEXT;
ALTER TABLE framework_sessions ADD COLUMN original_workspace_id TEXT;
ALTER TABLE framework_sessions ADD COLUMN fork_parent_id INTEGER;
ALTER TABLE framework_sessions ADD COLUMN version INTEGER DEFAULT 1;

-- Indexes
CREATE INDEX idx_framework_sessions_workspace ON framework_sessions(workspace_id);
CREATE INDEX idx_framework_sessions_library ON framework_sessions(published_to_library, is_public);
CREATE INDEX idx_framework_sessions_fork ON framework_sessions(fork_parent_id);

-- Set default workspace for existing frameworks (migration data)
-- Assumes workspace_id "default" or 1 exists
UPDATE framework_sessions SET workspace_id = '1' WHERE workspace_id IS NULL;
```

### Migration 022: Voting & Rating System

```sql
-- ============================================================================
-- Migration 022: Voting & Rating System
-- Description: Enable community voting and ratings on public frameworks
-- ============================================================================

-- Framework votes
CREATE TABLE IF NOT EXISTS framework_votes (
  id TEXT PRIMARY KEY,
  framework_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  user_hash TEXT,
  vote_type TEXT CHECK(vote_type IN ('UPVOTE', 'DOWNVOTE')) NOT NULL,
  workspace_id INTEGER NOT NULL DEFAULT 1,
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  UNIQUE(framework_id, user_id)
);

CREATE INDEX idx_framework_votes_framework ON framework_votes(framework_id);
CREATE INDEX idx_framework_votes_user ON framework_votes(user_id);
CREATE INDEX idx_framework_votes_framework_type ON framework_votes(framework_id, vote_type);

-- Framework ratings
CREATE TABLE IF NOT EXISTS framework_ratings (
  id TEXT PRIMARY KEY,
  framework_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  user_hash TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5) NOT NULL,
  review_text TEXT,
  review_title TEXT,
  workspace_id INTEGER NOT NULL DEFAULT 1,
  rated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  UNIQUE(framework_id, user_id)
);

CREATE INDEX idx_framework_ratings_framework ON framework_ratings(framework_id);
CREATE INDEX idx_framework_ratings_user ON framework_ratings(user_id);
CREATE INDEX idx_framework_ratings_rating ON framework_ratings(rating);

-- Performance indexes for library queries
CREATE INDEX idx_library_items_status_votes ON library_items(status, votes DESC);
CREATE INDEX idx_library_items_status_stars ON library_items(status, stars DESC);
```

### Migration 023: Subscriptions & Notifications

```sql
-- ============================================================================
-- Migration 023: Subscriptions & Notifications
-- Description: Enable users to follow frameworks and receive notifications
-- ============================================================================

-- Framework subscriptions
CREATE TABLE IF NOT EXISTS framework_subscriptions (
  id TEXT PRIMARY KEY,
  framework_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  user_hash TEXT,
  notify_updates INTEGER DEFAULT 1,
  notify_comments INTEGER DEFAULT 1,
  notify_forks INTEGER DEFAULT 0,
  workspace_id INTEGER NOT NULL DEFAULT 1,
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_notified_at TEXT,

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  UNIQUE(framework_id, user_id)
);

CREATE INDEX idx_framework_subscriptions_framework ON framework_subscriptions(framework_id);
CREATE INDEX idx_framework_subscriptions_user ON framework_subscriptions(user_id);

-- User notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_hash TEXT,
  notification_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  read INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  workspace_id TEXT
);

CREATE INDEX idx_user_notifications_user ON user_notifications(user_id, read, created_at DESC);
CREATE INDEX idx_user_notifications_unread ON user_notifications(user_id, read, created_at DESC);
CREATE INDEX idx_user_notifications_type ON user_notifications(notification_type);
```

### Migration 024: Activity Feed

```sql
-- ============================================================================
-- Migration 024: Activity Feed
-- Description: Track team activity for collaboration
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_feed (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_user_hash TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_title TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_feed_workspace ON activity_feed(workspace_id, created_at DESC);
CREATE INDEX idx_activity_feed_actor ON activity_feed(actor_user_id);
CREATE INDEX idx_activity_feed_entity ON activity_feed(entity_type, entity_id);
```

---

## Appendix B: API Response Examples

### Public Library Browse Response

```json
{
  "frameworks": [
    {
      "id": 123,
      "title": "Russian Military Logistics COG Analysis",
      "description": "Comprehensive analysis of Russian military supply chain vulnerabilities during Ukraine conflict...",
      "framework_type": "COG",
      "category": "Military",
      "tags": ["russia", "logistics", "supply-chain", "cog", "ukraine"],
      "share_token": "abc123xyz",
      "thumbnail_url": null,
      "author": {
        "workspace_id": "ws-military-osint",
        "workspace_name": "Military OSINT Analysis Team",
        "workspace_type": "TEAM"
      },
      "stats": {
        "votes": {
          "upvotes": 42,
          "downvotes": 3,
          "total": 39
        },
        "average_rating": 4.5,
        "total_ratings": 12,
        "views": 340,
        "clones": 8,
        "comments": 15,
        "subscriptions": 23
      },
      "published_at": "2025-09-15T10:00:00Z",
      "updated_at": "2025-10-01T14:30:00Z",
      "user_interaction": {
        "voted": "UPVOTE",
        "rated": 4,
        "subscribed": true,
        "cloned": false
      }
    }
  ],
  "total": 127,
  "page": 1,
  "pages": 13,
  "filters_applied": {
    "framework_type": "COG",
    "category": "Military",
    "sort": "votes"
  }
}
```

### Framework Detail Response

```json
{
  "framework": {
    "id": 123,
    "title": "Russian Military Logistics COG Analysis",
    "description": "...",
    "framework_type": "COG",
    "data": {
      "cogs": [...],
      "capabilities": [...],
      "requirements": [...],
      "vulnerabilities": [...]
    },
    "share_token": "abc123xyz",
    "author": {...},
    "stats": {...},
    "published_at": "2025-09-15T10:00:00Z",
    "version": 1,
    "fork_count": 3,
    "fork_parent": null
  },
  "comments": [
    {
      "id": "comment-456",
      "user_id": "analyst-jane",
      "content": "Excellent analysis! The supply chain vulnerabilities are well-documented...",
      "created_at": "2025-10-05T11:00:00Z",
      "replies": [
        {
          "id": "comment-457",
          "user_id": "analyst-john",
          "content": "Agreed. Have you considered rail logistics as a secondary COG?",
          "created_at": "2025-10-05T12:00:00Z"
        }
      ]
    }
  ],
  "ratings": [
    {
      "id": "rating-789",
      "user_id": "analyst-maria",
      "rating": 5,
      "review_title": "Comprehensive and actionable",
      "review_text": "This framework helped our team prioritize targets...",
      "rated_at": "2025-10-03T09:00:00Z"
    }
  ],
  "related_frameworks": [
    {
      "id": 456,
      "title": "Russian C2 Infrastructure Analysis",
      "framework_type": "COG",
      "votes": 31,
      "average_rating": 4.2
    }
  ],
  "user_interaction": {
    "voted": "UPVOTE",
    "rated": 4,
    "subscribed": true,
    "cloned": false,
    "can_edit": false
  }
}
```

---

## Appendix C: UI Mockups (ASCII)

### Public Library Browser

```
┌────────────────────────────────────────────────────────────────┐
│  Research Tools - Public Library                  [Search...] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filters:                                                      │
│  [COG ▼] [All Categories ▼] [Sort: Most Votes ▼]             │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ Russian Logistics   │  │ Chinese Anti-Access │             │
│  │ COG Analysis        │  │ A2/AD Analysis      │             │
│  │                     │  │                     │             │
│  │ Military OSINT Team │  │ Indo-Pacific Team   │             │
│  │ ⬆ 42  ★ 4.5  👁 340 │  │ ⬆ 38  ★ 4.3  👁 287 │             │
│  │ [View] [Clone]      │  │ [View] [Clone]      │             │
│  └─────────────────────┘  └─────────────────────┘             │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ Iranian Proxy       │  │ North Korea Cyber   │             │
│  │ Network Analysis    │  │ Capabilities COG    │             │
│  │                     │  │                     │             │
│  │ CENTCOM Analysts    │  │ Cyber Defense Team  │             │
│  │ ⬆ 29  ★ 4.1  👁 213 │  │ ⬆ 25  ★ 4.7  👁 198 │             │
│  │ [View] [Clone]      │  │ [View] [Clone]      │             │
│  └─────────────────────┘  └─────────────────────┘             │
│                                                                 │
│  Page 1 of 13                          [< Previous] [Next >]  │
└────────────────────────────────────────────────────────────────┘
```

### Framework Detail Page

```
┌────────────────────────────────────────────────────────────────┐
│  ← Back to Library                                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Russian Military Logistics COG Analysis                       │
│  by Military OSINT Analysis Team                               │
│                                                                 │
│  [⬆ Upvote (42)]  [★★★★★ 4.5 (12 ratings)]  [🔔 Subscribed]  │
│  [💬 15 Comments]  [👁 340 views]  [📋 Clone to My Workspace] │
│                                                                 │
│  ────────────────────────────────────────────────────────────  │
│                                                                 │
│  Description:                                                  │
│  Comprehensive analysis of Russian military supply chain       │
│  vulnerabilities during the Ukraine conflict, identifying      │
│  critical logistics hubs and transportation infrastructure...  │
│                                                                 │
│  Tags: russia, logistics, supply-chain, cog, ukraine          │
│  Category: Military                                            │
│  Published: Sep 15, 2025  |  Updated: Oct 1, 2025             │
│                                                                 │
│  ────────────────────────────────────────────────────────────  │
│                                                                 │
│  [View Analysis] [View Network Graph] [Export (PDF/PPT/XLS)] │
│                                                                 │
│  ────────────────────────────────────────────────────────────  │
│                                                                 │
│  Comments (15):                                                │
│                                                                 │
│  analyst-jane · 2 days ago                                     │
│  Excellent analysis! The supply chain vulnerabilities are      │
│  well-documented. Have you considered rail logistics?          │
│    ⤷ analyst-john · 2 days ago                                 │
│      Agreed! Rail is covered in section 3.2...                 │
│                                                                 │
│  [Load more comments...]                                       │
│                                                                 │
│  ────────────────────────────────────────────────────────────  │
│                                                                 │
│  Related Frameworks:                                           │
│  • Russian C2 Infrastructure Analysis (COG, 31 votes)          │
│  • Black Sea Naval Operations Analysis (COG, 27 votes)         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-07 | Claude | Initial design specification |

---

**End of Document**
