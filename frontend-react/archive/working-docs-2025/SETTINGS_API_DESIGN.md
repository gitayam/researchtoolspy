# Settings API Design - Hash-Based Authentication

## Overview
All settings endpoints accept the user's hash via `X-User-Hash` header or `hash` query parameter.
No session tokens or cookies required - pure hash-based authentication.

## API Endpoints

### User Settings

#### GET /api/settings/user
Get all user settings for a hash.

**Request:**
```bash
GET /api/settings/user
X-User-Hash: 1234567890123456
```

**Response:**
```json
{
  "user_hash": "1234567890123456",
  "display": {
    "theme": "dark",
    "language": "en",
    "density": "comfortable",
    "sidebar_behavior": "auto",
    "font_size": "medium"
  },
  "ai": {
    "default_model": "gpt-5-mini",
    "temperature": 0.7,
    "max_tokens": 2048,
    "show_cost_tracking": true
  },
  "notifications": {
    "email_enabled": false,
    "desktop_enabled": true
  }
}
```

#### PUT /api/settings/user
Update user settings.

**Request:**
```bash
PUT /api/settings/user
X-User-Hash: 1234567890123456
Content-Type: application/json

{
  "display": {
    "theme": "dark",
    "language": "en"
  }
}
```

### Workspace Management

#### GET /api/settings/workspaces
Get all workspaces for a hash.

**Response:**
```json
{
  "workspaces": [
    {
      "id": "1",
      "name": "Personal Workspace",
      "type": "PERSONAL",
      "is_default": true,
      "created_at": "2025-10-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/settings/workspaces
Create new workspace.

**Request:**
```json
{
  "name": "Team Analysis",
  "type": "TEAM",
  "description": "Collaborative workspace"
}
```

#### DELETE /api/settings/workspaces/:id
Delete workspace (must be owner).

### Data Export/Import

#### POST /api/settings/data/export
Export all data for a hash.

**Response:**
```json
{
  "export_id": "exp_123456",
  "user_hash": "1234567890123456",
  "exported_at": "2025-10-07T12:00:00Z",
  "data": {
    "settings": {...},
    "workspaces": [...],
    "frameworks": [...],
    "evidence": [...],
    "analyses": [...]
  }
}
```

#### POST /api/settings/data/import
Import data from export file.

**Request:**
```json
{
  "export_id": "exp_123456",
  "data": {...},
  "options": {
    "merge": true,
    "overwrite": false
  }
}
```

#### DELETE /api/settings/data/workspace/:workspace_id
Clear all data in workspace.

### Hash Management

#### POST /api/settings/hash/backup
Generate downloadable hash backup file.

**Response:**
```json
{
  "backup_file": "omnicore_hash_backup_20251007.txt",
  "hash": "1234567890123456",
  "created_at": "2025-10-07T12:00:00Z",
  "warning": "Store this file securely. No recovery possible if lost."
}
```

## Authentication Middleware

All endpoints require hash validation:

```typescript
// Middleware checks for X-User-Hash header or ?hash= query param
// Validates format (16 digits)
// Rate limits per hash (10 req/min for settings endpoints)
```

## Database Schema

### users table
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_hash TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);
```

### user_settings table
```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  category TEXT NOT NULL, -- 'display', 'ai', 'notifications'
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_hash, category, key)
);
```

### workspaces table (update)
```sql
-- Add user_hash column
ALTER TABLE workspaces ADD COLUMN user_hash TEXT;
CREATE INDEX idx_workspaces_user_hash ON workspaces(user_hash);
```

## Security Considerations

1. **Hash Privacy**: Never expose hashes in URLs (use headers)
2. **Rate Limiting**: 10 requests/minute per hash for settings
3. **Data Isolation**: All queries filtered by user_hash
4. **Hash Validation**: Strict 16-digit numeric validation
5. **Export Security**: Exports include hash verification token

## Implementation Priority

1. User settings endpoints (display, AI)
2. Data export/import
3. Workspace management integration
4. Hash backup generation
