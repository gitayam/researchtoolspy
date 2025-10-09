# Settings System Implementation Guide

## Overview

A comprehensive settings system for Omnicore that works exclusively with Mullvad-style hash-based authentication. No username/password required - all features work for guest users with only a hash.

## Architecture

### Hash-Based Authentication
- 16-digit cryptographically secure hash generated client-side
- Stored in `localStorage` as `omnicore_user_hash`
- All API calls authenticated via `X-User-Hash` header
- No sessions, cookies, or JWT tokens required

### Settings Storage
- **Client-side**: localStorage for offline access and immediate response
- **Server-side**: D1 database for persistence and cross-device sync
- **Sync strategy**: Optimistic updates with server confirmation

## Implemented Files

### Frontend Components

#### Core Settings Page
- `/src/pages/SettingsPage.tsx` - Main tabbed settings interface

#### Setting Components
- `/src/components/settings/DisplayPreferences.tsx` - Theme, language, density, UI preferences
- `/src/components/settings/WorkspaceManagement.tsx` - Create, switch, delete workspaces
- `/src/components/settings/AIPreferences.tsx` - Model selection, parameters, features
- `/src/components/settings/DataManagement.tsx` - Export, import, hash backup, data clearing

#### Types & Hooks
- `/src/types/settings.ts` - TypeScript interfaces and defaults
- `/src/hooks/useSettings.ts` - React hook for settings management

### Backend API Endpoints

#### User Settings
- `GET /api/settings/user` - Retrieve all settings for hash
- `PUT /api/settings/user` - Update settings
- `DELETE /api/settings/user` - Reset to defaults

#### Workspace Management
- `GET /api/settings/workspaces` - List workspaces
- `POST /api/settings/workspaces` - Create workspace
- `PUT /api/settings/workspaces/[id]` - Update workspace
- `DELETE /api/settings/workspaces/[id]` - Delete workspace

#### Data Management
- `POST /api/settings/data/export` - Export data
- `POST /api/settings/data/import` - Import data
- `POST /api/settings/hash/backup` - Generate hash backup file
- `DELETE /api/settings/data/workspace/[id]` - Clear workspace data

### Database Schema
- `/migrations/007_hash_based_settings.sql` - Database migration

## Database Schema

### user_settings
Stores all user preferences keyed by hash.

```sql
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('display', 'ai', 'notifications', 'workspace')),
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_hash, category, setting_key)
);
```

### hash_accounts
Tracks hash creation and usage.

```sql
CREATE TABLE hash_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP,
  login_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  notes TEXT
);
```

### data_exports
Audit trail for data exports.

```sql
CREATE TABLE data_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  export_id TEXT UNIQUE NOT NULL,
  user_hash TEXT NOT NULL,
  export_type TEXT NOT NULL,
  workspace_id INTEGER,
  file_size INTEGER,
  item_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  downloaded_at TIMESTAMP
);
```

### settings_audit_log
Change tracking for security and debugging.

```sql
CREATE TABLE settings_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  category TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT
);
```

## Features Implemented

### 1. Display Preferences
- Theme selection (light, dark, system)
- Language switching (English, Spanish)
- UI density (compact, comfortable, spacious)
- Sidebar behavior
- Font size adjustment
- Tooltip and animation toggles

### 2. Workspace Management
- Create personal, team, or public workspaces
- Switch between workspaces
- Edit workspace details
- Delete workspaces (with protection for default)
- Visual indicators for active/default workspaces

### 3. AI Settings
- Model selection (GPT-5, GPT-5 Mini, GPT-5 Nano, GPT-4o Mini)
- Temperature control (0.0 - 1.0)
- Max tokens configuration
- Context window size
- Cost tracking toggles
- Token usage display
- Auto-suggestions control

### 4. Data Management
- Full data export (JSON, CSV, Excel, PDF formats planned)
- Data import with merge/overwrite options
- Hash backup generation (critical for account recovery)
- Workspace data clearing
- Export type selection (full, workspace, settings, frameworks, evidence)

## Installation & Setup

### 1. Run Database Migration

```bash
# Assuming you have wrangler configured with D1
wrangler d1 execute DB_NAME --file=migrations/007_hash_based_settings.sql --remote
```

### 2. Verify Tables Created

```bash
wrangler d1 execute DB_NAME --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
```

You should see: `user_settings`, `hash_accounts`, `data_exports`, `settings_audit_log`

### 3. Add D1 Binding to wrangler.toml

Ensure your `wrangler.toml` includes:

```toml
[[d1_databases]]
binding = "DB"
database_name = "your-database-name"
database_id = "your-database-id"
```

### 4. Test Locally

```bash
npm run dev
# or
wrangler pages dev
```

Navigate to `/dashboard/settings` after logging in with a hash.

## Testing Guide

### Manual Testing Checklist

#### Display Settings
- [ ] Change theme and verify it persists on reload
- [ ] Change language and verify UI updates
- [ ] Adjust density and verify spacing changes
- [ ] Toggle animations and tooltips
- [ ] Verify settings persist in localStorage
- [ ] Verify settings sync to database

#### Workspace Management
- [ ] Create new workspace
- [ ] Switch between workspaces
- [ ] Edit workspace name/description
- [ ] Delete workspace (not default)
- [ ] Verify default workspace cannot be deleted
- [ ] Check workspace list updates correctly

#### AI Settings
- [ ] Change AI model selection
- [ ] Adjust temperature slider
- [ ] Modify max tokens
- [ ] Toggle cost tracking
- [ ] Toggle auto-suggestions
- [ ] Verify settings persist

#### Data Management
- [ ] Export full data as JSON
- [ ] Export workspace-only data
- [ ] Export settings only
- [ ] Import previously exported data
- [ ] Download hash backup file
- [ ] Verify hash backup contains correct information
- [ ] Clear workspace data (test on non-default workspace)
- [ ] Verify data clearing prompts confirmation

### API Testing

#### Test User Settings API

```bash
# Get settings
curl -X GET "http://localhost:8788/api/settings/user" \
  -H "X-User-Hash: 1234567890123456"

# Update settings
curl -X PUT "http://localhost:8788/api/settings/user" \
  -H "X-User-Hash: 1234567890123456" \
  -H "Content-Type: application/json" \
  -d '{
    "display": {
      "theme": "dark",
      "language": "en"
    }
  }'

# Reset settings
curl -X DELETE "http://localhost:8788/api/settings/user" \
  -H "X-User-Hash: 1234567890123456"
```

#### Test Workspaces API

```bash
# List workspaces
curl -X GET "http://localhost:8788/api/settings/workspaces" \
  -H "X-User-Hash: 1234567890123456"

# Create workspace
curl -X POST "http://localhost:8788/api/settings/workspaces" \
  -H "X-User-Hash: 1234567890123456" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workspace",
    "type": "PERSONAL",
    "description": "Testing workspace creation"
  }'

# Delete workspace
curl -X DELETE "http://localhost:8788/api/settings/workspaces/ws_123" \
  -H "X-User-Hash: 1234567890123456"
```

#### Test Data Export

```bash
# Export data
curl -X POST "http://localhost:8788/api/settings/data/export" \
  -H "X-User-Hash: 1234567890123456" \
  -H "Content-Type: application/json" \
  -d '{
    "export_type": "full",
    "format": "json",
    "include_metadata": true,
    "include_comments": true
  }' \
  --output export.json
```

## Security Considerations

### Hash Privacy
- Hashes are never exposed in URLs (use headers instead)
- Hashes are validated (16 digits only)
- No hash enumeration possible

### Rate Limiting
Recommended rate limits per hash:
- Settings endpoints: 10 requests/minute
- Export endpoints: 3 requests/minute
- Import endpoints: 1 request/minute

### Data Isolation
- All queries filtered by `user_hash`
- No cross-hash data leakage
- Workspace ownership strictly enforced

### Hash Validation
- Format: Exactly 16 numeric digits
- Regex: `/^\d{16}$/`
- No spaces, letters, or special characters

## Known Limitations

1. **Import/Export**: Only JSON format fully implemented (CSV, Excel, PDF planned)
2. **Frameworks Import**: Not yet implemented (placeholder exists)
3. **Evidence Import**: Not yet implemented (placeholder exists)
4. **Real-time Sync**: No WebSocket support (polling-based sync only)
5. **Conflict Resolution**: Last-write-wins strategy (no merge conflict detection)

## Future Enhancements

### Phase 2
- [ ] CSV/Excel export implementation
- [ ] PDF report generation for exports
- [ ] Framework and evidence import
- [ ] Multi-device sync indicators
- [ ] Settings version history

### Phase 3
- [ ] Real-time settings sync via WebSockets
- [ ] Conflict resolution UI
- [ ] Settings presets/templates
- [ ] Workspace sharing and collaboration
- [ ] Team workspace member management

### Phase 4
- [ ] Settings search
- [ ] Keyboard shortcuts configuration
- [ ] Accessibility preferences
- [ ] Advanced AI model fine-tuning
- [ ] Usage analytics dashboard

## Troubleshooting

### Settings Not Persisting
1. Check browser localStorage is enabled
2. Verify `omnicore_user_hash` exists in localStorage
3. Check browser console for API errors
4. Verify D1 database connection

### Workspaces Not Loading
1. Check database migration ran successfully
2. Verify `workspaces` table has `user_hash` column
3. Check API endpoint responses in Network tab
4. Verify hash is being sent in headers

### Export/Import Failing
1. Check file size limits (CloudFlare Workers has 25MB limit)
2. Verify JSON format is valid
3. Check browser console for errors
4. Test with smaller datasets first

### Hash Backup Not Downloading
1. Check browser popup blocker
2. Verify API endpoint is accessible
3. Test in different browser
4. Check CloudFlare Workers logs

## Support

For issues or questions:
1. Check CloudFlare Workers logs: `wrangler tail`
2. Review D1 database: `wrangler d1 execute DB_NAME --command="SELECT * FROM user_settings LIMIT 10;" --remote`
3. Test API endpoints with curl/Postman
4. Check browser DevTools console and Network tab

## API Reference

See `/SETTINGS_API_DESIGN.md` for complete API documentation.
