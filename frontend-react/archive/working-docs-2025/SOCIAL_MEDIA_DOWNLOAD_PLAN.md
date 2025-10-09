# Social Media Download & Stream Implementation Plan

## Executive Summary

Add download, stream, and advanced extraction options for social media content (Instagram, YouTube, TikTok, Twitter) in the Content Intelligence tool.

**Timeline**: 1-2 days
**Status**: Planning → Implementation
**Priority**: HIGH (user-requested feature)

---

## 🎯 Goals

1. ✅ Detect social media URLs automatically
2. ✅ Show specialized UI with download/stream options
3. ✅ Extract videos, images, metadata using specialized tools
4. ✅ Provide direct download links and stream URLs
5. ✅ Handle multiple platforms (YouTube, Instagram, TikTok, Twitter/X)

---

## 📊 Current State Analysis

### What Exists ✅

1. **Social media detection** (`analyze-url.ts`)
   - Detects: YouTube, Instagram, TikTok, Twitter, Facebook, Reddit
   - Stores platform in database
   - Returns `is_social_media` and `social_platform` flags

2. **Basic social extract API** (`social-extract.ts`)
   - Partially implemented
   - Uses oEmbed APIs for metadata
   - NOT integrated with UI

3. **Database schema**
   - `saved_links.is_social_media`
   - `saved_links.social_platform`
   - `content_analysis.is_social_media`

### What's Missing ❌

1. **UI integration** - No social media-specific UI elements
2. **Download functionality** - No download links or buttons
3. **Stream options** - No streaming player or embed
4. **Media extraction** - No video/image extraction
5. **Advanced metadata** - No engagement metrics, transcripts

---

## 🛠️ Technical Approach

### Option 1: Node.js Packages (RECOMMENDED)

**For YouTube:**
- Package: `@ybd-project/ytdl-core` (serverless-compatible)
- Features: Download URLs, metadata, quality selection, format options
- Cloudflare Workers: ✅ **Native support with serverless import**

**For Instagram:**
- Package: `instagram-media-scraper` or `@aduptive/instagram-scraper`
- Features: Public post extraction, media URLs, metadata
- Cloudflare Workers: ✅ **Lightweight, fetch-based**

**For TikTok:**
- Package: Custom fetch + API (TikTok API or web scraping)
- Alternative: External service (cobalt.tools API)

**For Twitter/X:**
- Package: Custom fetch to Twitter oEmbed API
- Alternative: `snscrape` (requires external service)

### Option 2: External Services (FALLBACK)

If Node.js packages fail or rate-limited:
- **cobalt.tools** - Free API for YouTube, TikTok, Twitter, Instagram
- **RapidAPI yt-dlp** - Paid API wrapper around yt-dlp
- **Apify scrapers** - Paid scraping services
- **Self-hosted Python service** - Deploy yt-dlp/instaloader to Railway/Render

---

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────┐
│  ContentIntelligencePage.tsx (Frontend)             │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. User enters social media URL             │  │
│  │  2. Detects platform (instagram/youtube/etc) │  │
│  │  3. Shows social media extraction UI         │  │
│  │     - Quick Extract button                   │  │
│  │     - Download Video button                  │  │
│  │     - Stream/Embed button                    │  │
│  │     - Get Transcript button (YouTube)        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  /api/content-intelligence/social-media-extract     │
│  (Cloudflare Pages Function)                        │
│  ┌──────────────────────────────────────────────┐  │
│  │  Platform routing:                           │  │
│  │  - YouTube → @ybd-project/ytdl-core          │  │
│  │  - Instagram → instagram-media-scraper       │  │
│  │  - TikTok → cobalt.tools API (fallback)     │  │
│  │  - Twitter → oEmbed API                      │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Response with media URLs                           │
│  {                                                   │
│    platform: 'youtube',                             │
│    mediaUrls: {                                     │
│      video: 'https://...mp4',                       │
│      audio: 'https://...m4a',                       │
│      thumbnail: 'https://...jpg'                    │
│    },                                               │
│    streamUrl: 'https://youtube.com/embed/...',      │
│    metadata: { ... }                                │
│  }                                                   │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 UI/UX Design

### Social Media Detection Alert

When a social media URL is detected, show an enhanced card:

```tsx
{analysis?.is_social_media && (
  <Card className="p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50
                  dark:from-purple-950/30 dark:via-pink-950/30 dark:to-orange-950/30
                  border-2 border-purple-300">
    <div className="flex items-start gap-4">
      <div className="p-3 bg-purple-600 rounded-full">
        <Video className="h-6 w-6 text-white" />
      </div>

      <div className="flex-1">
        <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">
          {platformIcon} {analysis.social_platform.toUpperCase()} Content Detected
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
          Use specialized extraction tools for videos, images, transcripts, and more.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button onClick={() => handleSocialExtract('metadata')}>
            <Info className="h-4 w-4 mr-2" />
            Quick Info
          </Button>

          <Button onClick={() => handleSocialExtract('download')} variant="default">
            <Download className="h-4 w-4 mr-2" />
            Download Media
          </Button>

          <Button onClick={() => handleSocialExtract('stream')} variant="outline">
            <Play className="h-4 w-4 mr-2" />
            Stream/Embed
          </Button>

          {analysis.social_platform === 'youtube' && (
            <Button onClick={() => handleSocialExtract('transcript')} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Get Transcript
            </Button>
          )}
        </div>

        {/* Platform-Specific Info */}
        <div className="mt-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <strong>Available:</strong>
            {getPlatformFeatures(analysis.social_platform)}
          </p>
        </div>
      </div>
    </div>
  </Card>
)}
```

### Extraction Results Display

```tsx
{socialMediaData && (
  <Card className="p-6">
    <h3 className="text-lg font-bold mb-4">
      {platformIcon} {socialMediaData.platform.toUpperCase()} Extraction Results
    </h3>

    {/* Media Preview */}
    {socialMediaData.mediaUrls?.video && (
      <div className="mb-4">
        <video controls className="w-full max-h-96 rounded-lg">
          <source src={socialMediaData.mediaUrls.video} />
        </video>
      </div>
    )}

    {/* Download Options */}
    <div className="grid md:grid-cols-2 gap-3">
      {socialMediaData.downloadOptions?.map(option => (
        <Button
          key={option.format}
          variant="outline"
          onClick={() => window.open(option.url, '_blank')}
        >
          <Download className="h-4 w-4 mr-2" />
          {option.quality} ({option.format})
        </Button>
      ))}
    </div>

    {/* Stream/Embed */}
    {socialMediaData.streamUrl && (
      <div className="mt-4">
        <h4 className="font-semibold mb-2">Embed Code</h4>
        <Textarea
          value={`<iframe src="${socialMediaData.streamUrl}" ...></iframe>`}
          readOnly
        />
      </div>
    )}

    {/* Metadata */}
    <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
      <div>
        <p className="text-muted-foreground">Views</p>
        <p className="font-semibold">{socialMediaData.metadata.viewCount}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Likes</p>
        <p className="font-semibold">{socialMediaData.metadata.likeCount}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Duration</p>
        <p className="font-semibold">{socialMediaData.metadata.duration}</p>
      </div>
    </div>
  </Card>
)}
```

---

## 💾 Database Schema

### New Table: `social_media_extractions`

```sql
CREATE TABLE IF NOT EXISTS social_media_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  saved_link_id INTEGER,
  content_analysis_id INTEGER,

  -- Source
  url TEXT NOT NULL,
  platform TEXT NOT NULL, -- youtube, instagram, tiktok, twitter
  post_type TEXT, -- video, image, carousel, story

  -- Extraction data
  media_urls JSON, -- { video: 'url', audio: 'url', thumbnail: 'url' }
  download_options JSON, -- [{ quality: '1080p', format: 'mp4', url: '...' }]
  stream_url TEXT,
  embed_code TEXT,

  -- Metadata
  metadata JSON, -- Platform-specific data
  transcript TEXT, -- For videos

  -- Processing
  extraction_mode TEXT DEFAULT 'full', -- metadata, full, download
  extraction_duration_ms INTEGER,

  -- Caching
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cache_expires_at TIMESTAMP DEFAULT (datetime('now', '+24 hours')),

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (saved_link_id) REFERENCES saved_links(id),
  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id)
);

CREATE INDEX idx_social_extractions_url ON social_media_extractions(url);
CREATE INDEX idx_social_extractions_platform ON social_media_extractions(platform);
CREATE INDEX idx_social_extractions_cache ON social_media_extractions(cache_expires_at);
```

---

## 📝 Implementation Steps

### Phase 1: UI Integration (2 hours)

**File**: `src/pages/tools/ContentIntelligencePage.tsx`

1. ✅ Add state for social media extraction
2. ✅ Create `handleSocialExtract()` function
3. ✅ Add social media detection alert UI
4. ✅ Add extraction results display
5. ✅ Add platform-specific features helper

### Phase 2: API Development (4 hours)

**File**: `functions/api/content-intelligence/social-media-extract.ts` (NEW)

1. ✅ Install dependencies:
   ```bash
   npm install @ybd-project/ytdl-core
   npm install instagram-media-scraper
   ```

2. ✅ Create API endpoint structure
3. ✅ Implement YouTube extraction (ytdl-core)
4. ✅ Implement Instagram extraction (instagram-media-scraper)
5. ✅ Implement fallback to cobalt.tools API
6. ✅ Add database caching
7. ✅ Add error handling

### Phase 3: Database Migration (30 minutes)

**File**: `schema/migrations/018-social-media-extractions.sql` (NEW)

1. ✅ Create migration file
2. ✅ Run migration locally
3. ✅ Deploy to production D1

### Phase 4: Testing & Deployment (1 hour)

1. ✅ Test with YouTube URLs
2. ✅ Test with Instagram URLs
3. ✅ Test with TikTok URLs
4. ✅ Test download functionality
5. ✅ Test stream/embed functionality
6. ✅ Build and deploy
7. ✅ Tag release

---

## 🔒 Security Considerations

1. **Rate Limiting**: Implement per-user rate limits
2. **URL Validation**: Sanitize and validate all URLs
3. **CORS**: Handle CORS for media URLs
4. **API Keys**: Store external API keys in environment variables
5. **Copyright**: Add disclaimer about respecting copyright/terms of service

---

## 📈 Success Metrics

- ✅ Users can download videos from YouTube/Instagram/TikTok
- ✅ Stream/embed functionality works
- ✅ Metadata extraction is accurate
- ✅ Response time < 5 seconds for extraction
- ✅ 90%+ success rate for public content

---

## 🚀 Future Enhancements

**Phase 4** (Optional, future):
- Batch download multiple posts
- Scheduled monitoring of social accounts
- Change detection (new posts, deleted posts)
- Engagement tracking over time
- Advanced analytics dashboard
- Self-hosted Python service for advanced features

---

## 📚 Resources

- [@ybd-project/ytdl-core docs](https://www.npmjs.com/package/@ybd-project/ytdl-core)
- [instagram-media-scraper GitHub](https://github.com/ahmedrangel/instagram-media-scraper)
- [cobalt.tools API docs](https://github.com/wukko/cobalt)
- [Cloudflare Workers Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)

---

**Created**: 2025-10-06
**Author**: AI Assistant
**Status**: ✅ Ready for Implementation
