# Social Media Enhancement Plan

## Overview

Enhance Content Intelligence to use specialized tools (yt-dlp, instaloader, gallery-dl) for platform-specific extraction when social media URLs are detected.

## Current State

### Existing Implementation
- ✅ Social media detection in `analyze-url.ts` (lines 238-265)
- ✅ Separate `/api/social-media` endpoint for profiles/posts
- ✅ `SocialMediaPage.tsx` for social media management
- ✅ Platforms detected: Twitter/X, Facebook, Instagram, LinkedIn, TikTok, YouTube, Reddit

### Current Flow
```
User enters URL → detectSocialMedia() → Regular content extraction → Analysis
```

### Limitations
- ❌ Social media URLs use generic HTML extraction (often fails)
- ❌ No video/image downloads
- ❌ No engagement metrics (likes, comments, shares)
- ❌ No platform-specific metadata (hashtags, mentions, captions)
- ❌ Limited ability to bypass paywalls/login walls

## Proposed Enhancement

### New Flow
```
User enters URL → detectSocialMedia()
                      ↓
              [Is Social Media?]
                      ↓
                    YES → Show Social Media Modal
                            ↓
                      User chooses option:
                      1. Quick View (metadata only)
                      2. Full Extract (yt-dlp/instaloader)
                      3. Download Media
                      4. Track for Changes
                      ↓
                  Platform-specific extraction
                      ↓
                  Enhanced analysis with:
                  - Video transcripts
                  - Image OCR
                  - Engagement metrics
                  - Comments/replies
                  - Hashtags/mentions
```

## Platform-Specific Tools

### YouTube (`yt-dlp`)
**Capabilities**:
- Video metadata (title, description, upload date)
- Auto-generated transcripts/captions
- Engagement metrics (views, likes, comments)
- Channel information
- Thumbnail downloads
- Video downloads (optional)

**API Command**:
```bash
yt-dlp --dump-json --skip-download <URL>
yt-dlp --write-auto-sub --skip-download <URL>  # Get transcript
```

### Instagram (`instaloader`)
**Capabilities**:
- Post metadata (caption, hashtags, mentions)
- Engagement metrics (likes, comments)
- Profile information
- Story/Reel detection
- Image/video downloads
- Comments extraction

**API Command**:
```bash
instaloader --no-pictures --no-videos --metadata-json <shortcode>
instaloader --comments <shortcode>  # Get all comments
```

### Twitter/X (`gallery-dl` or `yt-dlp`)
**Capabilities**:
- Tweet text and metadata
- Thread detection
- Media downloads (images/videos)
- Engagement metrics
- Replies/quotes

**API Command**:
```bash
yt-dlp --dump-json <tweet_url>
gallery-dl --write-metadata <tweet_url>
```

### TikTok (`yt-dlp`)
**Capabilities**:
- Video metadata
- Caption and hashtags
- Engagement metrics
- Sound/music information
- Video download

**API Command**:
```bash
yt-dlp --dump-json <tiktok_url>
```

### Facebook (`yt-dlp`)
**Capabilities**:
- Post metadata
- Video information
- Engagement metrics
- Comments (limited)

**API Command**:
```bash
yt-dlp --dump-json <facebook_url>
```

## Implementation Plan

### Phase 1: API Endpoint Enhancement

**File**: `functions/api/content-intelligence/social-media-extract.ts`

```typescript
interface SocialMediaExtractRequest {
  url: string
  platform: string // from detectSocialMedia()
  extract_mode: 'metadata' | 'full' | 'download'
  options?: {
    include_comments?: boolean
    include_media?: boolean
    include_transcript?: boolean
  }
}

interface SocialMediaExtractResponse {
  platform: string
  post_type: 'video' | 'image' | 'text' | 'story' | 'reel'
  metadata: {
    title?: string
    caption?: string
    description?: string
    author: string
    author_url?: string
    post_url: string
    upload_date?: string
    duration?: number  // for videos
    view_count?: number
    like_count?: number
    comment_count?: number
    share_count?: number
    hashtags?: string[]
    mentions?: string[]
  }
  content?: {
    transcript?: string  // for videos
    ocr_text?: string    // for images
    comments?: Array<{
      author: string
      text: string
      likes: number
      timestamp: string
    }>
  }
  media?: {
    thumbnail_url?: string
    video_url?: string
    image_urls?: string[]
    download_links?: string[]
  }
  raw_data?: any  // Full tool output
}
```

**Tool Execution Strategy**:
```typescript
// Use Cloudflare Workers subprocess (if available) or external service
async function executeYtDlp(url: string, options: string[]): Promise<any> {
  // Option 1: Call external API service (recommended for Cloudflare)
  const response = await fetch('https://yt-dlp-api.example.com/extract', {
    method: 'POST',
    body: JSON.stringify({ url, options })
  })

  // Option 2: Use Cloudflare Durable Objects to run tools
  // Option 3: Queue job for backend worker with yt-dlp installed
}
```

### Phase 2: UI Enhancement in Content Intelligence

**File**: `src/pages/tools/ContentIntelligencePage.tsx`

**New Components**:
1. **Social Media Detection Alert**
   - Shows immediately when social media URL detected
   - Offers specialized extraction options

2. **Social Media Modal**
   - Platform-specific options
   - Extract mode selection
   - Preview of available data

3. **Enhanced Results Display**
   - Video player for YouTube/TikTok
   - Image gallery for Instagram
   - Engagement metrics visualization
   - Comments section
   - Transcript viewer

**Example UI**:
```tsx
{socialMediaInfo && (
  <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-300">
    <Info className="h-4 w-4" />
    <AlertTitle>Social Media Detected: {socialMediaInfo.platform}</AlertTitle>
    <AlertDescription>
      Use specialized extraction for better results
    </AlertDescription>
    <div className="mt-3 flex gap-2">
      <Button size="sm" onClick={() => handleSocialMediaExtract('metadata')}>
        Quick Metadata
      </Button>
      <Button size="sm" onClick={() => handleSocialMediaExtract('full')}>
        Full Extract
      </Button>
      <Button size="sm" variant="outline" onClick={() => setShowSocialModal(true)}>
        Advanced Options
      </Button>
    </div>
  </Alert>
)}
```

### Phase 3: Enhanced Analysis Tab

Add new tab: **"Social Media Analysis"**

**Displays**:
- Platform: Instagram/YouTube/etc.
- Post Type: Video/Image/Carousel
- Engagement Rate: (likes + comments) / followers
- Hashtag Performance
- Best Posting Time (from timestamp)
- Audience Sentiment (from comments)
- Virality Score
- Media Downloads (if requested)

## Technical Architecture

### Option A: External Microservice (Recommended)
```
Content Intelligence → API Gateway → yt-dlp Microservice
                                   → instaloader Microservice
                                   → gallery-dl Microservice
```

**Pros**:
- Works with Cloudflare Workers (no subprocess limitations)
- Scalable and cacheable
- Can run on separate infrastructure with tools pre-installed

**Cons**:
- Requires additional infrastructure
- Network latency

### Option B: Cloudflare Durable Objects
```
Content Intelligence → Durable Object (stateful)
                          ↓
                    Runs Python tools
                          ↓
                    Returns results
```

**Pros**:
- Stateful, can handle long-running tasks
- No external dependencies

**Cons**:
- Experimental, limited Python support
- Higher cost

### Option C: Queue + Worker Pattern
```
Content Intelligence → Queue Job → Worker with yt-dlp
                          ↓
                    Poll for results
                          ↓
                    Display when ready
```

**Pros**:
- Handles long extractions
- No timeout issues

**Cons**:
- More complex
- Requires polling mechanism

## Recommended Approach

**Phase 1**: External microservice for yt-dlp/instaloader
- Deploy simple Node.js/Python service on Railway/Render/Fly.io
- Service has yt-dlp, instaloader, gallery-dl pre-installed
- Cloudflare Functions call this service
- Cache results in KV for 24 hours

**Phase 2**: UI enhancements in Content Intelligence
- Detect social media → Show modal
- Offer specialized extraction
- Display rich media and metadata

**Phase 3**: Integration with existing Social Media page
- Save extracted data to `social_media_posts` table
- Link to profiles in `social_media_profiles`
- Enable tracking and re-scraping

## Database Schema Updates

### New Table: `social_media_extractions`
```sql
CREATE TABLE IF NOT EXISTS social_media_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  post_type TEXT,
  metadata JSON,
  content JSON,
  media JSON,
  raw_data JSON,
  extraction_mode TEXT,
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cache_expires_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_social_extractions_url ON social_media_extractions(url);
CREATE INDEX idx_social_extractions_platform ON social_media_extractions(platform);
```

## Implementation Checklist

### Backend
- [ ] Create external yt-dlp/instaloader microservice
- [ ] Create `/api/content-intelligence/social-media-extract` endpoint
- [ ] Implement platform-specific extractors
- [ ] Add caching layer (KV)
- [ ] Add rate limiting
- [ ] Create database migrations

### Frontend
- [ ] Add social media detection alert in ContentIntelligencePage
- [ ] Create SocialMediaModal component
- [ ] Add "Social Media Analysis" tab
- [ ] Implement video/image viewers
- [ ] Add engagement metrics visualization
- [ ] Add download buttons for media

### Integration
- [ ] Link Content Intelligence → Social Media page
- [ ] Enable automatic profile creation from extractions
- [ ] Add "Track Changes" feature
- [ ] Implement re-scraping scheduler

### Testing
- [ ] Test with YouTube videos
- [ ] Test with Instagram posts/reels
- [ ] Test with Twitter/X tweets
- [ ] Test with TikTok videos
- [ ] Test with Facebook posts
- [ ] Test error handling and rate limits

## Future Enhancements

- **Bulk Extraction**: Extract entire profiles or channels
- **Change Tracking**: Monitor posts for edits/deletions
- **Sentiment Analysis**: Analyze comments for sentiment
- **Network Analysis**: Map connections between profiles
- **Export Options**: Download data as CSV/JSON
- **Scheduled Scraping**: Auto-update tracked profiles
- **Telegram Integration**: Extract from Telegram channels
- **WhatsApp Status**: Extract shared stories (if possible)

## Estimated Timeline

- **Phase 1 (Microservice)**: 2-3 days
- **Phase 2 (UI Enhancement)**: 2 days
- **Phase 3 (Integration)**: 1-2 days
- **Testing & Polish**: 1 day

**Total**: ~1 week for MVP

## Cost Estimates

**Microservice Hosting** (Railway/Render Free Tier):
- Free tier: $0/month
- Paid tier: ~$5-10/month

**yt-dlp API alternatives**:
- Self-hosted: Free
- Third-party API (rapidapi.com): ~$10-50/month based on usage

**Cloudflare**:
- Workers requests: Included in free tier (100k/day)
- KV storage: Included in free tier (100k reads/day)

**Total**: $0-20/month for MVP

---

**Priority**: HIGH
**Complexity**: MEDIUM
**Impact**: HIGH (Unlocks social media research capabilities)
