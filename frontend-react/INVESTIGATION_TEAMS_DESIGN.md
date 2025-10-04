# Investigation Teams Design

## Overview

Investigation Teams allow users to collaborate on intelligence analysis by securely sharing workspace access through **invite links** rather than exposing account credentials. Each team member maintains their own account hash for login but joins workspaces using secure, revocable invite tokens.

## Security Model

### Problem Statement
- **Current limitation**: Sharing account hashes for collaboration would expose login credentials
- **Solution**: UUID-based invite links that are:
  - Independent from user credentials
  - Revocable at any time
  - Optionally time-limited or usage-limited
  - Workspace-specific, not account-wide

### Architecture Principles
1. **Separation of concerns**: Login credentials (account hash) vs. workspace access (invite token)
2. **Privacy-first**: No email/username required for invites
3. **Granular control**: Per-workspace invite management
4. **Nickname system**: Display names specific to each workspace (not tied to account)

## Database Schema

### New Table: `workspace_invites`

```sql
CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,                    -- UUID v4
  workspace_id TEXT NOT NULL,
  created_by_id INTEGER NOT NULL,

  -- Invite token (shown in URL)
  invite_token TEXT NOT NULL UNIQUE,      -- e.g., "inv_a1b2c3d4e5f6"

  -- Access control
  default_role TEXT CHECK(default_role IN ('ADMIN', 'EDITOR', 'VIEWER')) NOT NULL DEFAULT 'VIEWER',

  -- Usage limits
  max_uses INTEGER,                       -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  expires_at TEXT,                        -- NULL = never expires

  -- Status
  is_active INTEGER DEFAULT 1,

  -- Metadata
  label TEXT,                             -- Optional: "External analysts", "Review team", etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  revoked_by_id INTEGER,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (revoked_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_active ON workspace_invites(is_active);
```

### Modified Table: `workspace_members`

```sql
-- Add nickname field for workspace-specific display names
ALTER TABLE workspace_members ADD COLUMN nickname TEXT;
ALTER TABLE workspace_members ADD COLUMN joined_via_invite_id TEXT;

-- Index for nickname
CREATE INDEX IF NOT EXISTS idx_workspace_members_nickname ON workspace_members(nickname);
```

## API Endpoints

### 1. Create Invite Link
**POST** `/api/workspaces/:workspace_id/invites`

```typescript
// Request
{
  "default_role": "VIEWER" | "EDITOR" | "ADMIN",
  "max_uses": number | null,           // Optional
  "expires_in_hours": number | null,   // Optional
  "label": string | null               // Optional: "External team", "Analysts", etc.
}

// Response
{
  "id": "uuid",
  "invite_token": "inv_a1b2c3d4e5f6",
  "invite_url": "https://researchtoolspy.pages.dev/invite/inv_a1b2c3d4e5f6",
  "default_role": "VIEWER",
  "max_uses": 10,
  "current_uses": 0,
  "expires_at": "2025-10-11T12:00:00Z",
  "created_at": "2025-10-04T12:00:00Z"
}
```

**Access**: Workspace owner or ADMIN members only

### 2. List Invite Links
**GET** `/api/workspaces/:workspace_id/invites`

```typescript
// Response
{
  "invites": [
    {
      "id": "uuid",
      "invite_token": "inv_...",
      "invite_url": "https://...",
      "default_role": "VIEWER",
      "max_uses": 10,
      "current_uses": 3,
      "expires_at": "2025-10-11T12:00:00Z",
      "is_active": true,
      "label": "External analysts",
      "created_by": {
        "id": 123,
        "nickname": "John Smith"
      },
      "created_at": "2025-10-04T12:00:00Z"
    }
  ]
}
```

**Access**: Workspace owner or ADMIN members only

### 3. Revoke Invite Link
**DELETE** `/api/workspaces/:workspace_id/invites/:invite_id`

```typescript
// Response
{
  "message": "Invite revoked successfully",
  "revoked_at": "2025-10-04T14:30:00Z"
}
```

**Access**: Workspace owner or ADMIN members only

### 4. Get Invite Info (Public)
**GET** `/api/invites/:invite_token`

```typescript
// Response
{
  "workspace": {
    "id": "workspace-uuid",
    "name": "Russia-Ukraine Intelligence Analysis",
    "type": "TEAM",
    "owner_nickname": "Lead Analyst"
  },
  "invite": {
    "default_role": "VIEWER",
    "expires_at": "2025-10-11T12:00:00Z",
    "label": "External analysts",
    "is_valid": true,
    "uses_remaining": 7  // NULL if unlimited
  }
}
```

**Access**: Public (no auth required) - but shows minimal info

### 5. Accept Invite
**POST** `/api/invites/:invite_token/accept`

```typescript
// Request (requires authentication)
{
  "nickname": "Jane Doe"  // Required: workspace-specific display name
}

// Response
{
  "workspace_id": "uuid",
  "member_id": "uuid",
  "role": "VIEWER",
  "nickname": "Jane Doe",
  "joined_at": "2025-10-04T15:00:00Z"
}
```

**Access**: Authenticated users only
**Effect**: Adds user to workspace_members with specified nickname

## User Flow

### Creating an Investigation Team

1. **Team Creator (Workspace Owner)**:
   ```
   Workspace Settings > Team > Generate Invite Link
   └─> Set role (Viewer/Editor/Admin)
   └─> Optional: Set expiry (24h, 7d, 30d, never)
   └─> Optional: Set max uses (1, 5, 10, unlimited)
   └─> Optional: Label ("External analysts", "Review team")
   └─> Click "Generate Link"
   └─> Copy invite URL to share
   ```

2. **Invitee Receives Link**:
   ```
   https://researchtoolspy.pages.dev/invite/inv_a1b2c3d4e5f6
   ```

3. **Invitee Clicks Link**:
   - **If not logged in**: Redirect to login page with `?redirect=/invite/inv_...`
   - **If logged in**: Show invite preview page

4. **Invite Preview Page** (`/invite/:token`):
   ```
   ┌─────────────────────────────────────────────┐
   │  You've been invited to join:               │
   │                                             │
   │  📊 Russia-Ukraine Intelligence Analysis    │
   │  👤 Invited by: Lead Analyst                │
   │  🔑 Role: Viewer                            │
   │  ⏰ Expires: Oct 11, 2025                   │
   │                                             │
   │  ┌─────────────────────────────────────┐   │
   │  │ Choose your display name:           │   │
   │  │ [Jane Doe___________________]       │   │
   │  │                                     │   │
   │  │ This is how team members will see  │   │
   │  │ you in this workspace              │   │
   │  └─────────────────────────────────────┘   │
   │                                             │
   │  [ Cancel ]  [ Join Investigation Team ]   │
   └─────────────────────────────────────────────┘
   ```

5. **After Joining**:
   - Redirect to workspace: `/workspaces/:id`
   - Show success toast: "Joined Russia-Ukraine Intelligence Analysis as Jane Doe"
   - User appears in team members list with nickname

### Managing Team Members

**Workspace Settings > Team Members**

```
┌─────────────────────────────────────────────────────────┐
│  Active Invite Links                    [+ New Invite]  │
├─────────────────────────────────────────────────────────┤
│  External analysts                                      │
│  inv_a1b2c3d4e5f6 • Viewer • 3/10 uses • Exp Oct 11    │
│  [Copy Link] [Revoke]                                   │
├─────────────────────────────────────────────────────────┤
│  Review team                                            │
│  inv_x9y8z7w6v5u4 • Editor • 2/∞ uses • Never expires  │
│  [Copy Link] [Revoke]                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Team Members (5)                                       │
├─────────────────────────────────────────────────────────┤
│  👤 Lead Analyst (you)                                  │
│     Owner • Joined Oct 1, 2025                          │
├─────────────────────────────────────────────────────────┤
│  👤 Jane Doe                                            │
│     Viewer • Joined Oct 4, 2025 via "External analysts"│
│     [Change Role ▼] [Remove]                            │
├─────────────────────────────────────────────────────────┤
│  👤 Bob Smith                                           │
│     Editor • Joined Oct 3, 2025 via "Review team"      │
│     [Change Role ▼] [Remove]                            │
└─────────────────────────────────────────────────────────┘
```

## Security Considerations

### 1. Token Generation
- Use `crypto.randomUUID()` for invite ID
- Use `crypto.getRandomValues()` for invite token
- Format: `inv_` + 12 random characters (alphanumeric)
- Collision-resistant (2^64 possibilities)

### 2. Validation on Accept
- Check invite is active
- Check not expired
- Check max uses not exceeded
- Check user not already a member
- Check user is authenticated (has own account)

### 3. Revocation
- Soft delete (mark inactive, store revoked_at/revoked_by)
- Immediate effect - invite links stop working
- Members joined via invite remain (invite is just door, not ongoing access)

### 4. Privacy
- Nicknames are workspace-specific (not global)
- Account hash never exposed in invite system
- No email/username required
- No personal info in invite URL

## Frontend Components

### 1. InviteAcceptPage
- **Route**: `/invite/:invite_token`
- **Purpose**: Preview invite and accept with nickname
- **Components**:
  - Workspace info card
  - Nickname input form
  - Accept/decline buttons

### 2. WorkspaceInvitesManager
- **Location**: Workspace settings
- **Purpose**: Create and manage invite links
- **Components**:
  - Invite creation form
  - Active invites list
  - Revoke controls

### 3. TeamMembersPanel
- **Location**: Collaboration page
- **Purpose**: View and manage team members
- **Components**:
  - Members list with nicknames
  - Role management
  - Remove member controls

## Implementation Phases

### Phase 1: Database & API ✅ (Current)
- [x] Review existing infrastructure
- [ ] Create workspace_invites migration
- [ ] Add nickname field to workspace_members
- [ ] Implement invite API endpoints

### Phase 2: Frontend Core
- [ ] Build InviteAcceptPage
- [ ] Update CollaborationPage with real UI
- [ ] Add invite link generation to workspace settings

### Phase 3: UX Enhancements
- [ ] Invite link copying with toast
- [ ] Expiry countdown on invite page
- [ ] Team member search/filter
- [ ] Bulk invite management

### Phase 4: Advanced Features
- [ ] Email invite notifications (optional)
- [ ] Invite analytics (who joined, when)
- [ ] Role-based permissions matrix
- [ ] Workspace transfer ownership

## Example Usage Scenarios

### Scenario 1: Intelligence Analyst Team
```
Lead Analyst:
  1. Creates TEAM workspace "Syria Conflict Analysis"
  2. Generates invite: Role=Editor, Expires=7d, Label="Intel Team"
  3. Shares link via Signal: https://researchtoolspy.pages.dev/invite/inv_abc123

Junior Analyst:
  1. Receives link, clicks it
  2. Already logged in with hash 1234567890123456
  3. Enters nickname "Alex Chen"
  4. Joins as Editor
  5. Can now edit frameworks, add evidence, create reports
```

### Scenario 2: External Review
```
Project Lead:
  1. Creates invite: Role=Viewer, Max_uses=3, Expires=24h
  2. Shares with external reviewers

Reviewers:
  1. Each logs in with their own account hash
  2. Each sets unique nickname ("Dr. Smith", "Prof. Johnson")
  3. Can view analysis but cannot edit
  4. Access expires after 24 hours
```

### Scenario 3: Rotating Team Access
```
Security Lead:
  1. Creates invite: Role=Editor, Max_uses=1, Expires=30d
  2. Gives to temporary contractor
  3. Contractor joins as "Contractor A"
  4. After 30 days, invite expires automatically
  5. Security Lead can revoke earlier if needed
```

## Migration Path

### From Current State
1. Existing workspaces work as-is
2. Add invite system as new feature
3. Gradually enable for TEAM workspaces first
4. Eventually extend to PERSONAL (for specific sharing)

### Backward Compatibility
- Existing workspace_members entries work unchanged
- Nickname field defaults to NULL (optional)
- Can add nickname retroactively
- No breaking changes to existing API

## Questions Resolved

1. **How to invite without sharing account hash?**
   - UUID-based invite tokens, separate from login credentials

2. **How to set nickname?**
   - Required field when accepting invite
   - Stored in workspace_members.nickname
   - Workspace-specific, not global

3. **How to manage security?**
   - Revocable invites
   - Time limits and usage limits
   - Owner/Admin-only invite creation
   - User must have own account to join

4. **How to prevent invite abuse?**
   - Max uses limit
   - Expiry dates
   - Revocation capability
   - Activity tracking (current_uses)
