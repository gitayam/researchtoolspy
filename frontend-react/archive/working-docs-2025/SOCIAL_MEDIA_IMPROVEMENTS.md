# Social Media Extraction Improvements Plan

## Current Issues Summary

| Platform  | Status | Main Issues |
|-----------|--------|-------------|
| YouTube   | ✅ Good | Minor: cobalt.tools dependency |
| Instagram | 🔴 High Risk | Likely broken, needs auth |
| TikTok    | 🟡 Medium Risk | External API dependency |
| Twitter/X | 🟡 Limited | No downloads, embed only |

---

## Phase 1: Critical Fixes (30 minutes)

### 1.1 Add Caching Layer
**Why**: Reduce external API calls, improve performance, avoid rate limits
**Impact**: All platforms

```typescript
// Add to social-media-extract.ts

async function getCached<T>(
  cache: KVNamespace,
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await cache.get(key)
  if (cached) {
    console.log(`[Cache HIT] ${key}`)
    return JSON.parse(cached) as T
  }

  // Cache miss - fetch fresh
  console.log(`[Cache MISS] ${key}`)
  const result = await fetcher()

  // Store in cache
  await cache.put(key, JSON.stringify(result), {
    expirationTtl: ttl
  })

  return result
}

// Usage in extractYouTube:
const cacheKey = `youtube:${videoId}:${mode}`
return await getCached(env.CACHE, cacheKey, 3600, async () => {
  // ... existing extraction logic
})
```

### 1.2 Better Error Messages
**Why**: Users need actionable feedback, not technical jargon

```typescript
// Create error helper
function createUserFriendlyError(
  platform: string,
  technicalError: string,
  suggestion: string
): SocialMediaExtractionResult {
  return {
    success: false,
    platform,
    error: suggestion,
    metadata: {
      technicalDetails: technicalError,
      timestamp: new Date().toISOString()
    }
  }
}

// Usage examples:
// Instagram auth error
return createUserFriendlyError(
  'instagram',
  error.message,
  'This Instagram post may be private or require login. Try a public post from a verified account.'
)

// TikTok API failure
return createUserFriendlyError(
  'tiktok',
  error.message,
  'TikTok video extraction is temporarily unavailable. Please try again in a few minutes.'
)
```

---

## Phase 2: Instagram Fix (1-2 hours)

### Option A: Replace with cobalt.tools (Recommended - 30 min)
**Why**: cobalt.tools already supports Instagram and doesn't need auth

```typescript
async function extractInstagram(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  try {
    // Use cobalt.tools for Instagram (same as TikTok)
    const cobaltResponse = await fetch('https://co.wuk.sh/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        url,
        vCodec: 'h264',
        vQuality: '1080',
        aFormat: 'mp3',
        isAudioOnly: false
      })
    })

    if (!cobaltResponse.ok) {
      throw new Error('Cobalt API request failed')
    }

    const cobaltData = await cobaltResponse.json() as any

    if (cobaltData.status === 'picker') {
      // Instagram carousel - multiple images/videos
      return {
        success: true,
        platform: 'instagram',
        postType: 'carousel',
        mediaUrls: {
          images: cobaltData.picker.map((item: any) => item.url)
        },
        downloadOptions: cobaltData.picker.map((item: any, idx: number) => ({
          quality: 'Original',
          format: item.type,
          url: item.url,
          hasAudio: item.type === 'video',
          hasVideo: item.type === 'video'
        })),
        metadata: {
          itemCount: cobaltData.picker.length,
          extractedVia: 'cobalt.tools'
        }
      }
    } else if (cobaltData.status === 'redirect' || cobaltData.status === 'stream') {
      // Single image/video
      return {
        success: true,
        platform: 'instagram',
        postType: 'single',
        mediaUrls: {
          video: cobaltData.url
        },
        downloadOptions: [{
          quality: 'Original',
          format: 'mp4',
          url: cobaltData.url,
          hasAudio: true,
          hasVideo: true
        }],
        metadata: {
          extractedVia: 'cobalt.tools'
        }
      }
    }

    throw new Error(cobaltData.text || 'Instagram extraction failed')

  } catch (error) {
    return createUserFriendlyError(
      'instagram',
      error instanceof Error ? error.message : 'Unknown error',
      'Could not extract Instagram content. The post may be private or deleted.'
    )
  }
}
```

### Option B: Keep current library but add fallback (1 hour)
**Why**: Get metadata when possible, fallback to cobalt.tools for media

```typescript
async function extractInstagram(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  // Try library first for metadata
  try {
    const scraper = new InstagramScraper()
    const postData = await scraper.getPost(shortcode)

    if (postData) {
      // Success! Return metadata
      return { /* existing implementation */ }
    }
  } catch (scraperError) {
    console.warn('[Instagram] Library failed, trying cobalt.tools fallback')
  }

  // Fallback to cobalt.tools
  return extractInstagramViaCobalt(url, mode)
}
```

### Option C: Use Instagram Graph API (2-3 hours)
**Why**: Official API, most reliable
**Cons**: Requires app setup, access tokens, user permissions

---

## Phase 3: Enhanced Error Handling (1 hour)

### 3.1 Retry Logic with Exponential Backoff

```typescript
async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetcher()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error

      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Max retries exceeded')
}

// Usage:
const result = await fetchWithRetry(async () => {
  const response = await fetch(cobaltUrl, options)
  if (!response.ok) throw new Error('API failed')
  return response.json()
}, 3, 1000)
```

### 3.2 Platform Health Monitoring

```typescript
// Track API health in KV
interface PlatformHealth {
  platform: string
  lastSuccess: string
  lastFailure: string
  failureCount: number
  isHealthy: boolean
}

async function updatePlatformHealth(
  kv: KVNamespace,
  platform: string,
  success: boolean
) {
  const key = `health:${platform}`
  const existing = await kv.get(key)
  const health: PlatformHealth = existing ? JSON.parse(existing) : {
    platform,
    lastSuccess: '',
    lastFailure: '',
    failureCount: 0,
    isHealthy: true
  }

  if (success) {
    health.lastSuccess = new Date().toISOString()
    health.failureCount = 0
    health.isHealthy = true
  } else {
    health.lastFailure = new Date().toISOString()
    health.failureCount++
    health.isHealthy = health.failureCount < 5
  }

  await kv.put(key, JSON.stringify(health), {
    expirationTtl: 86400 // 24 hours
  })
}

// Check before extraction
const health = await getPlatformHealth(env.CACHE, platform)
if (!health.isHealthy) {
  return {
    success: false,
    platform,
    error: `${platform} extraction is currently experiencing issues. Please try again later.`,
    metadata: { health }
  }
}
```

---

## Phase 4: UI Improvements (1 hour)

### 4.1 Platform Status Indicator

```tsx
// Add to ContentIntelligencePage.tsx
const [platformStatus, setPlatformStatus] = useState<Record<string, boolean>>({})

useEffect(() => {
  fetch('/api/content-intelligence/platform-health')
    .then(r => r.json())
    .then(data => setPlatformStatus(data))
}, [])

// In UI:
<div className="flex gap-2 mb-4">
  {['youtube', 'instagram', 'tiktok', 'twitter'].map(platform => (
    <Badge key={platform} variant={platformStatus[platform] ? 'default' : 'destructive'}>
      {platform} {platformStatus[platform] ? '✓' : '⚠'}
    </Badge>
  ))}
</div>
```

### 4.2 Better Loading States

```tsx
// Show which API is being called
const [currentApi, setCurrentApi] = useState('')

// In extraction function:
setCurrentApi('Fetching metadata from YouTube...')
// ... fetch metadata
setCurrentApi('Downloading video via cobalt.tools...')
// ... fetch download URL
setCurrentApi('Extracting transcript...')
// ... fetch transcript

// In UI:
{processing && (
  <div className="flex items-center gap-2">
    <Loader2 className="animate-spin" />
    <span>{currentApi}</span>
  </div>
)}
```

---

## Phase 5: Advanced Features (2-3 hours)

### 5.1 Batch Extraction

```typescript
interface BatchExtractionRequest {
  urls: string[]
  mode: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // ... existing code

  // Handle batch requests
  if ('urls' in body && Array.isArray(body.urls)) {
    const results = await Promise.allSettled(
      body.urls.map(url => extractSocialMedia(url, body.mode, env))
    )

    return new Response(JSON.stringify({
      success: true,
      results: results.map((r, i) => ({
        url: body.urls[i],
        result: r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }
      }))
    }), { headers: { 'Content-Type': 'application/json' } })
  }
}
```

### 5.2 Download Progress Tracking

```typescript
// For large downloads, track progress
async function downloadWithProgress(
  url: string,
  onProgress: (percent: number) => void
): Promise<Blob> {
  const response = await fetch(url)
  const contentLength = response.headers.get('content-length')

  if (!contentLength) {
    return response.blob()
  }

  const total = parseInt(contentLength, 10)
  let loaded = 0

  const reader = response.body!.getReader()
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunks.push(value)
    loaded += value.length
    onProgress((loaded / total) * 100)
  }

  return new Blob(chunks)
}
```

---

## Implementation Priority

### 🔴 IMMEDIATE (Do Now)
1. **Replace Instagram with cobalt.tools** - 30 min
   - Removes authentication issues
   - Uses existing working pattern
   - Low risk, high reward

2. **Add caching layer** - 30 min
   - Reduces external API calls
   - Improves performance
   - Helps with rate limits

### 🟡 SOON (This Week)
3. **Better error messages** - 1 hour
   - Improves user experience
   - Reduces support questions

4. **Retry logic** - 1 hour
   - Handles transient failures
   - More reliable extraction

### 🟢 LATER (Next Sprint)
5. **Health monitoring** - 2 hours
   - Proactive issue detection
   - Better platform reliability

6. **Batch extraction** - 2 hours
   - Nice-to-have feature
   - Useful for power users

---

## Testing Checklist After Improvements

- [ ] YouTube: Test with/without captions
- [ ] Instagram: Test public post, carousel, reel
- [ ] TikTok: Test various video types
- [ ] Twitter: Test regular tweet, thread
- [ ] Cache: Verify second request is faster
- [ ] Errors: Trigger each error type and check messages
- [ ] Retry: Temporarily break API and verify retries work
- [ ] Health: Check platform status endpoint

---

**Created**: 2025-10-06
**Priority**: Phase 1 & 2 should be completed ASAP
**Estimated Total Time**: 4-6 hours for Phases 1-3
