# Instagram Extraction Guide

## Overview

Instagram extraction in Content Intelligence uses a **5-strategy fallback approach** to maximize success rates despite Instagram's aggressive anti-bot measures. The system automatically tries multiple extraction services in sequence until one succeeds.

## Extraction Strategies (Sequential Fallback)

### Strategy 1: Cobalt.tools (Primary)
- **Service**: https://cobalt.tools
- **Supports**: Single images, videos, carousels (multiple media)
- **Features**: High-quality downloads, metadata extraction
- **Reliability**: Good, but may be rate-limited during peak usage

### Strategy 2: SnapInsta (Fallback)
- **Service**: https://snapinsta.app
- **Supports**: Single images and videos
- **Features**: Fast extraction, good uptime
- **Reliability**: Moderate, HTML parsing required

### Strategy 3: InstaDP (Fallback)
- **Service**: https://instadp.com
- **Supports**: Posts and stories
- **Features**: Simple API, quick responses
- **Reliability**: Moderate, may block automated requests

### Strategy 4: SaveInsta (Fallback)
- **Service**: https://saveinsta.app
- **Supports**: Images and videos
- **Features**: Reliable fallback option
- **Reliability**: Moderate, HTML parsing required

### Strategy 5: Instagram oEmbed API (Metadata Only)
- **Service**: https://api.instagram.com/oembed
- **Supports**: Public posts only
- **Features**: Official Instagram API, thumbnail and embed code
- **Limitations**: **No direct download URLs** - only metadata and embed HTML
- **Reliability**: High, but limited functionality

## Caching Layer

### Cache Benefits
- **24-hour TTL**: Successful extractions cached for 1 day
- **Reduces API calls**: Prevents hitting rate limits
- **Faster responses**: Instant results for recently extracted posts
- **Cache key format**: `instagram:{shortcode}:{mode}`

### Cache Behavior
- **Cache hit**: Instant return (< 10ms)
- **Cache miss**: Falls through 5 strategies sequentially
- **Only successful**: Only successful extractions are cached

## Error Handling & Diagnostics

### Intelligent Error Detection

The system analyzes failure patterns across all 5 strategies and provides specific guidance:

#### 1. Rate Limiting Detected
**Symptoms**: HTTP 429 errors or "rate limit" messages

**What this means**: Too many requests in short time period

**Suggestions**:
- Wait 5-10 minutes before retrying
- Try a different network or VPN
- Instagram may be temporarily blocking your IP

#### 2. Post Not Found
**Symptoms**: HTTP 404 errors or "not found" messages

**What this means**: Post deleted or invalid URL

**Suggestions**:
- Verify the Instagram URL is correct
- Check if the post was deleted
- Try accessing the post in a browser first

#### 3. Access Forbidden
**Symptoms**: HTTP 403 errors, "forbidden", or "private" messages

**What this means**: Private account or authentication required

**Suggestions**:
- The post may be from a private account
- Try logging into Instagram first
- Share the post URL after logging in

#### 4. External Services Down
**Symptoms**: HTTP 5xx errors or timeouts across all services

**What this means**: Extraction services experiencing technical issues

**Suggestions**:
- Wait a few minutes and try again
- The extraction services may be temporarily down
- Try again during off-peak hours

#### 5. Instagram Blocking (Most Common)
**Symptoms**: All strategies fail with various errors

**What this means**: Instagram is blocking automated access

**Suggestions**:
- Instagram frequently updates anti-bot measures
- Wait 10-15 minutes and try again
- Try a different Instagram post first
- Download manually from Instagram app/website
- **Manual workaround**: Download from Instagram → Upload to Content Intelligence

## Usage in Content Intelligence

### Automatic Detection
1. Paste any Instagram URL into Content Intelligence
2. System automatically detects it's Instagram
3. Tries all 5 strategies sequentially
4. Returns first successful result

### Supported URL Formats
```
https://www.instagram.com/p/ABC123/        # Standard post
https://www.instagram.com/reel/ABC123/     # Reels
https://www.instagram.com/tv/ABC123/       # IGTV
```

### Post Types Supported
- ✅ Single images
- ✅ Videos and Reels
- ✅ Carousels (multiple images/videos)
- ✅ IGTV videos
- ⚠️ Stories (limited support via InstaDP)
- ❌ Live videos (not supported)

## Manual Workaround

If all automatic extraction methods fail:

1. **Open Instagram** in your browser or app
2. **Navigate to the post** you want to extract
3. **Download media**:
   - Desktop: Right-click → Save Image/Video
   - Mobile: Use Instagram's built-in save/download
4. **Upload to Content Intelligence**:
   - Use the file upload option in Content Intelligence
   - Add Instagram URL as source reference manually

## Technical Details

### Extraction Flow
```
User submits Instagram URL
         ↓
Extract shortcode (post ID)
         ↓
Check cache (24hr TTL)
         ↓
   Cache hit? → Return cached result
         ↓ No
Try Strategy 1: Cobalt.tools
         ↓ Fail
Try Strategy 2: SnapInsta
         ↓ Fail
Try Strategy 3: InstaDP
         ↓ Fail
Try Strategy 4: SaveInsta
         ↓ Fail
Try Strategy 5: oEmbed (metadata only)
         ↓ Fail
Return comprehensive error with diagnostics
```

### Success Rate Estimates

| Scenario | Success Rate | Note |
|----------|--------------|------|
| Public posts (recent) | ~80% | At least one service usually works |
| Public posts (cached) | ~100% | Instant cache hit |
| Private accounts | ~5% | Only oEmbed metadata may work |
| Deleted posts | 0% | Cannot extract deleted content |
| During peak hours | ~60% | Rate limiting more likely |
| With VPN/proxy | Variable | May improve or worsen depending on IP reputation |

## Limitations & Known Issues

### Instagram Anti-Bot Measures
- ✅ **We implement**: 5-strategy fallback, caching, retry logic
- ❌ **Instagram implements**: IP blocking, CAPTCHA challenges, rate limiting
- 📊 **Result**: ~80% success rate for public posts

### Why Extraction Can Fail
1. **Instagram's aggressive blocking**: Constantly updated anti-bot measures
2. **Third-party service issues**: External services may be down or blocked
3. **Private accounts**: Cannot extract from private accounts without authentication
4. **Deleted content**: Cannot extract deleted posts
5. **Network issues**: Cloudflare Workers IP may be temporarily blocked

### Alternative Solutions

#### Option A: Browser Extension (Future)
- Install browser extension with user's Instagram cookies
- Bypasses IP blocking issues
- Requires user authentication
- **Status**: Not yet implemented

#### Option B: Instagram Graph API (Official)
- Requires Instagram Business/Creator account
- Requires app review and approval
- Only works for own content
- **Status**: Not suitable for public content extraction

#### Option C: Manual Upload (Available Now)
- Download from Instagram manually
- Upload to Content Intelligence
- 100% success rate
- **Status**: Available - recommended workaround

## Best Practices

### For Users
1. ✅ **Use during off-peak hours** (better success rate)
2. ✅ **Cache results** (system does this automatically)
3. ✅ **Wait 10-15 min between failures** (avoid rate limiting)
4. ✅ **Try different posts** (verify service availability)
5. ✅ **Use manual workaround** when automated methods fail

### For Developers
1. ✅ **Always use fallback chain** (implemented)
2. ✅ **Cache successful results** (implemented - 24hr TTL)
3. ✅ **Provide specific error messages** (implemented)
4. ✅ **Implement retry logic** (implemented - 2 retries with exponential backoff)
5. ✅ **Don't abuse rate limits** (caching helps prevent this)

## Troubleshooting

### "All 5 extraction methods failed"

**Check diagnostics** in error message for specific failures:
- Look for patterns (all 429s = rate limiting)
- Note which services failed (all = Instagram blocking)
- Follow suggestions in error message

**Common fixes**:
1. Wait 10-15 minutes
2. Try a different Instagram post
3. Check if post is accessible in browser
4. Use manual workaround

### "Post may be private"

**Issue**: Cannot extract from private accounts without authentication

**Solutions**:
1. Verify account is public in Instagram
2. If private, use manual download method
3. Request account owner to share post publicly

### "Rate limiting detected"

**Issue**: Too many requests in short time

**Solutions**:
1. Wait 5-10 minutes
2. Reduce request frequency
3. Use cached results when available

## Future Improvements

### Planned Enhancements
- [ ] Browser extension for authenticated extraction
- [ ] Instagram Graph API integration (for business accounts)
- [ ] Machine learning to predict best strategy based on URL
- [ ] Proxy rotation to avoid IP blocking
- [ ] Real-time service health monitoring
- [ ] Automatic service endpoint discovery

### Community Contributions
We welcome contributions to improve Instagram extraction:
- New fallback services
- Better error detection
- Performance optimizations
- Documentation improvements

## Related Documentation
- [Content Intelligence Guide](./CONTENT_INTELLIGENCE.md)
- [Social Media Extraction API](../functions/api/content-intelligence/social-media-extract.ts)
- [Bluesky Extraction Guide](./BLUESKY_EXTRACTION.md)

## Support

### Report Issues
If you encounter persistent extraction failures:
1. **GitHub Issues**: [researchtoolspy/issues](https://github.com/gitayam/researchtoolspy/issues)
2. **Label**: `instagram-extraction`
3. **Include**: Instagram URL, error message, timestamp

### Contact
- GitHub: [@gitayam](https://github.com/gitayam)
- Project: [Research Tools](https://github.com/gitayam/researchtoolspy)

---

**Last Updated**: 2025-10-07
**Version**: 2.0.0 (5-strategy fallback with caching)
