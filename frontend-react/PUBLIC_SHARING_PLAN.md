# Public Behavior Analysis Sharing Plan

## Issues to Address

### 1. ❌ Save Validation Too Strict
**Current Problem:** User filled in title + description but can't save because no items added to sections (environmental factors, symbols, etc.)

**Root Cause:** Validation only checks if `sections` array has data, ignores basic info fields (title, description, location context, behavior settings, temporal context, eligibility, complexity)

**Impact:** Users can't save minimally viable behavior documentation

### 2. 🔒 No Public Sharing Capability
**Current State:** All frameworks are private to workspace
**User Need:**
- Save behavior analysis as public for discovery/indexing
- Allow non-users to view (read-only)
- Allow users to clone public analyses to their workspace
- Track usage/views of public analyses

### 3. 📊 Limited Report Sharing
**Current State:** Export to file formats only
**User Need:**
- Shareable report links (public view)
- Direct sharing via URL (no login required for public reports)
- Better report presentation for stakeholders

---

## 📋 Implementation Plan

### Phase 1: Fix Save Validation ⚡ IMMEDIATE

**Behavior Framework Validation:**
```typescript
// Allow save if title + ANY of:
- description filled
- location_context has data
- behavior_settings has data
- temporal_context has data
- any section has items
```

**Other Frameworks:** Keep existing or apply similar logic

**Files to Modify:**
- `src/components/frameworks/GenericFrameworkForm.tsx` (line 846-852)

**Validation Logic:**
```typescript
// For behavior framework - more flexible
if (frameworkType === 'behavior') {
  const hasBasicInfo = description.trim() ||
    locationContext?.specific_locations?.length > 0 ||
    behaviorSettings?.settings?.length > 0 ||
    temporalContext?.frequency_pattern ||
    complexity

  const hasData = hasBasicInfo || sections.some(section => sectionData[section.key]?.length > 0)

  if (!hasData) {
    alert('Please add a description or fill in basic behavior information')
    return
  }
}
// For other frameworks - keep strict validation
else {
  const hasData = sections.some(section => sectionData[section.key]?.length > 0)
  if (!hasData) {
    alert('Please add at least one item before saving')
    return
  }
}
```

---

### Phase 2: Public Sharing Infrastructure 🌐

#### 2.1 Database Schema Changes

**Migration:** `012-add-public-sharing-to-frameworks.sql`

```sql
-- Add public sharing fields to framework_sessions
ALTER TABLE framework_sessions ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN share_token TEXT;
ALTER TABLE framework_sessions ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN clone_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN category TEXT; -- Health, Civic, Economic, etc.

-- Indexes for public discovery
CREATE INDEX IF NOT EXISTS idx_framework_sessions_is_public ON framework_sessions(is_public);
CREATE INDEX IF NOT EXISTS idx_framework_sessions_share_token ON framework_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_framework_sessions_category ON framework_sessions(category);

-- Public frameworks discovery view
CREATE VIEW IF NOT EXISTS public_frameworks AS
SELECT
  id, title, description, framework_type, category,
  share_token, view_count, clone_count,
  created_at, updated_at
FROM framework_sessions
WHERE is_public = 1;
```

#### 2.2 Backend API Endpoints

**New Endpoints:**

1. **POST /api/frameworks/:id/share**
   - Toggle public/private status
   - Generate unique share_token if making public
   - Return share URL

2. **GET /api/frameworks/public/:token**
   - Get public framework by share token (read-only)
   - Increment view_count
   - No auth required

3. **POST /api/frameworks/public/:token/clone**
   - Clone public framework to user's workspace
   - Increment clone_count
   - Requires auth

4. **GET /api/frameworks/public**
   - List all public frameworks (paginated)
   - Filter by framework_type, category, tags
   - For discovery/browse page

**Files to Create:**
```
functions/api/frameworks/[id]/share.ts
functions/api/frameworks/public/[token].ts
functions/api/frameworks/public/[token]/clone.ts
functions/api/frameworks/public/index.ts
```

#### 2.3 Frontend Components

**A. Public/Private Toggle in Save Dialog**

Location: `GenericFrameworkForm.tsx`

```tsx
// Add state
const [isPublic, setIsPublic] = useState(false)
const [category, setCategory] = useState<string>('')

// In save dialog (before Save button)
{frameworkType === 'behavior' && (
  <div className="border-t pt-4 space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <Label className="text-base">Public Sharing</Label>
        <p className="text-sm text-gray-600">
          Make this analysis discoverable and clonable by others
        </p>
      </div>
      <Switch
        checked={isPublic}
        onCheckedChange={setIsPublic}
      />
    </div>

    {isPublic && (
      <div>
        <Label>Category (Optional)</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="health">Health</SelectItem>
            <SelectItem value="civic">Civic Engagement</SelectItem>
            <SelectItem value="economic">Economic</SelectItem>
            <SelectItem value="social">Social</SelectItem>
            <SelectItem value="environmental">Environmental</SelectItem>
            <SelectItem value="education">Education</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )}
  </div>
)}
```

**B. Share Button Component**

Create: `src/components/frameworks/ShareButton.tsx`

```tsx
interface ShareButtonProps {
  frameworkId: string
  isPublic: boolean
  shareToken?: string
}

export function ShareButton({ frameworkId, isPublic, shareToken }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const shareUrl = shareToken
    ? `${window.location.origin}/public/framework/${shareToken}`
    : null

  const handleTogglePublic = async () => {
    setSharing(true)
    try {
      const response = await fetch(`/api/frameworks/${frameworkId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: !isPublic })
      })
      const data = await response.json()
      // Update UI with new share_token
    } catch (error) {
      console.error('Failed to toggle sharing:', error)
    } finally {
      setSharing(false)
    }
  }

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Sharing Options</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium">Public Access</p>
              <p className="text-xs text-gray-600">
                Anyone with the link can view
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={handleTogglePublic}
              disabled={sharing}
            />
          </div>

          {isPublic && shareUrl && (
            <>
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-gray-600 space-y-1">
                <p>✓ Viewers can read your analysis</p>
                <p>✓ Logged-in users can clone to their workspace</p>
                <p>✓ Your work is attributed to you</p>
              </div>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**C. Public View Page**

Create: `src/pages/PublicFrameworkPage.tsx`

```tsx
export function PublicFrameworkPage() {
  const { token } = useParams()
  const [framework, setFramework] = useState(null)
  const [cloning, setCloning] = useState(false)

  useEffect(() => {
    // Fetch public framework
    fetch(`/api/frameworks/public/${token}`)
      .then(res => res.json())
      .then(setFramework)
  }, [token])

  const handleClone = async () => {
    setCloning(true)
    try {
      const response = await fetch(`/api/frameworks/public/${token}/clone`, {
        method: 'POST'
      })
      const data = await response.json()
      navigate(`/frameworks/${data.id}`)
    } catch (error) {
      console.error('Failed to clone:', error)
    } finally {
      setCloning(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Badge>Public Analysis</Badge>
          <h1 className="text-3xl font-bold mt-2">{framework?.title}</h1>
          <p className="text-gray-600 mt-1">
            {framework?.view_count} views • {framework?.clone_count} clones
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {/* Export */}}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleClone} disabled={cloning}>
            <Copy className="h-4 w-4 mr-2" />
            Clone to My Workspace
          </Button>
        </div>
      </div>

      {/* Read-only framework view */}
      <FrameworkViewer data={framework} readOnly />
    </div>
  )
}
```

**D. Public Discovery/Browse Page**

Create: `src/pages/PublicBehaviorsPage.tsx`

Browse/search public behavior analyses by category, location, tags, etc.

---

### Phase 3: Enhanced Report Sharing 📄

#### 3.1 Shareable Report View Page

Create: `src/pages/PublicReportPage.tsx`

- Standalone report view (no app chrome)
- Professional presentation
- Optimized for sharing/printing
- Optional: PDF generation server-side

#### 3.2 Report Sharing Features

**Add to ExportButton.tsx:**

```tsx
// Generate shareable report link
const handleGenerateReportLink = async () => {
  // Create public report token
  const response = await fetch(`/api/frameworks/${id}/report-link`, {
    method: 'POST'
  })
  const { report_token } = await response.json()
  const reportUrl = `${window.location.origin}/report/${report_token}`

  // Copy to clipboard
  navigator.clipboard.writeText(reportUrl)
  toast.success('Report link copied!')
}

// In dropdown menu
<DropdownMenuItem onClick={handleGenerateReportLink}>
  <Link className="h-4 w-4 mr-2" />
  Generate Shareable Report Link
</DropdownMenuItem>
```

#### 3.3 Report Enhancements

- **Branding:** Add workspace logo/name to reports
- **QR Code:** Generate QR code for report URL
- **Embed:** iframe embed option for reports
- **Print Optimization:** Better print styles

---

## 🎯 Success Criteria

### Phase 1 (Save Validation)
- ✅ User can save behavior analysis with just title + description
- ✅ User can save with title + location context (no description)
- ✅ Clear messaging about what's required

### Phase 2 (Public Sharing)
- ✅ User can toggle framework public/private
- ✅ Public frameworks get unique share URL
- ✅ Non-users can view public frameworks (read-only)
- ✅ Logged-in users can clone public frameworks
- ✅ View/clone counts tracked
- ✅ Public discovery page works

### Phase 3 (Report Sharing)
- ✅ Generate shareable report links
- ✅ Report view page works without login
- ✅ Reports are professional and shareable
- ✅ Copy link functionality works

---

## 🔐 Access Control Matrix

| User Type | View Public | Clone Public | Edit Public | View Private | Edit Private |
|-----------|-------------|--------------|-------------|--------------|--------------|
| **Non-User** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Logged In** | ✅ | ✅ | ❌ | ❌ (unless owner) | ❌ |
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Workspace Member** | ✅ | ✅ | ❌ | ✅ (if shared) | ✅ (if shared) |

---

## 📊 Analytics to Track

- Public framework views
- Clone counts
- Most popular frameworks
- Category distribution
- Geographic distribution (from location context)
- Report share link clicks

---

## Next Steps

1. **IMMEDIATE:** Fix save validation (Phase 1)
2. **Sprint 1:** Database migration + backend APIs (Phase 2.1, 2.2)
3. **Sprint 2:** Frontend components (Phase 2.3)
4. **Sprint 3:** Report sharing (Phase 3)
