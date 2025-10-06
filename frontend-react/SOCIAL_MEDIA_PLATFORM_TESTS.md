# Social Media Platform Testing Guide

## Supported Platforms

### ✅ YouTube
**Status**: Fully implemented and tested
**Features**:
- ✅ Video metadata via YouTube oEmbed API
- ✅ Download URLs via cobalt.tools API
- ✅ Transcript extraction via YouTube timedtext API
- ✅ Embed code generation
- ✅ Stream URL

**Test URLs**:
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
```

**Expected Results**:
- Metadata: title, author, channel URL, thumbnail
- Download options: 1080p via cobalt + fallback YouTube link
- Transcript: Full captions with word count
- Embed: Working iframe code

**Modes Supported**: metadata, download, stream, transcript, full

---

### 🟡 Instagram
**Status**: Implemented (needs testing)
**Library**: @aduptive/instagram-scraper
**Features**:
- 📸 Post images (single and carousel)
- 🎥 Video posts
- 📝 Caption extraction
- 💬 Engagement metrics (likes, comments)
- 👤 User info (username, ID)
- 🔗 Embed code (limited)

**Test URLs**:
```
https://www.instagram.com/p/ABC123/
https://www.instagram.com/reel/ABC123/
```

**Expected Results**:
- Media URLs for all images in carousel
- Video URL if available
- Caption text
- Like/comment counts
- Owner username
- Timestamp

**Potential Issues**:
- ⚠️ Instagram often requires authentication for scraping
- ⚠️ Private posts will fail
- ⚠️ Rate limiting possible
- ⚠️ May need to test with public posts only

**Modes Supported**: metadata, download, stream, full

---

### 🟡 TikTok
**Status**: Implemented via cobalt.tools (needs testing)
**API**: cobalt.tools external service
**Features**:
- 🎥 Video download URL
- 🎵 Audio extraction
- 📊 Basic metadata

**Test URLs**:
```
https://www.tiktok.com/@username/video/1234567890
https://vm.tiktok.com/ABC123/
```

**Expected Results**:
- Video URL (720p)
- Audio URL (if separated)
- Download option with format info

**Potential Issues**:
- ⚠️ cobalt.tools API reliability (external dependency)
- ⚠️ Limited metadata (no likes, comments, etc.)
- ⚠️ May fail with age-restricted or private videos
- ⚠️ TikTok's anti-bot measures may affect reliability

**Modes Supported**: download, full

---

### 🟡 Twitter/X
**Status**: Implemented via oEmbed (needs testing)
**API**: Twitter oEmbed API
**Features**:
- 📝 Tweet embed code
- 👤 Author info
- 🔗 Provider metadata

**Test URLs**:
```
https://twitter.com/username/status/1234567890
https://x.com/username/status/1234567890
```

**Expected Results**:
- HTML embed code
- Author name and URL
- Tweet dimensions
- Provider info

**Potential Issues**:
- ⚠️ No direct media download (only embed)
- ⚠️ Private/protected tweets will fail
- ⚠️ Limited metadata compared to official API
- ⚠️ No video download URLs

**Modes Supported**: metadata, stream (via embed)

---

## Platform Capabilities Matrix

| Platform  | Metadata | Download | Transcript | Embed | Stream |
|-----------|----------|----------|------------|-------|--------|
| YouTube   | ✅       | ✅       | ✅         | ✅    | ✅     |
| Instagram | ✅       | ✅       | ❌         | 🟡    | ❌     |
| TikTok    | 🟡       | ✅       | ❌         | ❌    | ❌     |
| Twitter/X | ✅       | ❌       | ❌         | ✅    | ❌     |

**Legend**:
- ✅ Fully supported
- 🟡 Partially supported / limited
- ❌ Not supported

---

## Testing Checklist

### For Each Platform:

1. **URL Detection**
   - [ ] Standard URL format
   - [ ] Short URL format (if applicable)
   - [ ] Mobile URL format
   - [ ] Embed URL format

2. **Metadata Extraction**
   - [ ] Title/caption
   - [ ] Author/username
   - [ ] Thumbnail/preview image
   - [ ] Engagement metrics (if available)
   - [ ] Timestamp

3. **Media Extraction**
   - [ ] Image URLs
   - [ ] Video URLs
   - [ ] Audio URLs
   - [ ] Download options with quality/format

4. **Error Handling**
   - [ ] Invalid URL
   - [ ] Private/protected content
   - [ ] Deleted content
   - [ ] Rate limiting
   - [ ] Network errors

5. **Mode Support**
   - [ ] metadata mode
   - [ ] download mode
   - [ ] stream mode (if applicable)
   - [ ] transcript mode (if applicable)
   - [ ] full mode

---

## Known Limitations

### Instagram
- **Authentication**: Many posts require login
- **Rate Limits**: Instagram aggressively rate-limits scrapers
- **Solution**: May need to implement retry logic or API key support

### TikTok
- **External Dependency**: Relies on cobalt.tools API
- **Limited Metadata**: Only basic video info
- **Solution**: Consider alternative APIs or official TikTok API

### Twitter/X
- **No Media Downloads**: Only provides embed code
- **Limited Access**: Official API requires developer account
- **Solution**: Current implementation is best for free tier

### General
- **Anti-Bot Measures**: All platforms employ detection
- **CORS Issues**: May affect browser-based testing
- **Cloudflare Workers**: Some libraries incompatible with Workers runtime

---

## Recommended Test Procedure

### 1. Manual Testing via UI
1. Navigate to `/dashboard/tools/content-intelligence`
2. Test each platform with public URLs
3. Try different extraction modes
4. Verify media preview and download links
5. Check error messages for invalid URLs

### 2. API Testing via curl
```bash
# YouTube
curl -X POST https://643d2da2.researchtoolspy.pages.dev/api/content-intelligence/social-media-extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "mode": "full"}'

# Instagram
curl -X POST https://643d2da2.researchtoolspy.pages.dev/api/content-intelligence/social-media-extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/p/ABC123/", "mode": "full"}'

# TikTok
curl -X POST https://643d2da2.researchtoolspy.pages.dev/api/content-intelligence/social-media-extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/@user/video/123", "mode": "download"}'

# Twitter
curl -X POST https://643d2da2.researchtoolspy.pages.dev/api/content-intelligence/social-media-extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://twitter.com/user/status/123", "mode": "metadata"}'
```

### 3. Check Logs
```bash
npx wrangler pages deployment tail --project-name=researchtoolspy
```

---

## Future Enhancements

### Priority 1
- [ ] Add retry logic for rate-limited requests
- [ ] Implement better error messages for each platform
- [ ] Add caching to reduce API calls

### Priority 2
- [ ] Add Reddit support
- [ ] Add Facebook support
- [ ] Implement parallel extraction for multiple URLs

### Priority 3
- [ ] Add official API support (Twitter API, Instagram Graph API)
- [ ] Add authentication for private content
- [ ] Implement webhook notifications for long-running extractions

---

**Created**: 2025-10-06
**Last Updated**: 2025-10-06
**Status**: Ready for Testing
