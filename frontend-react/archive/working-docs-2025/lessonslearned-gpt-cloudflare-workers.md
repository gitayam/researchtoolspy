# Lessons Learned: GPT Integration with Cloudflare Workers

## Overview
This document captures critical lessons learned from integrating OpenAI's GPT models with Cloudflare Pages Functions (Workers). These insights were gained through real production experience and troubleshooting.

---

## 1. Worker Time Limits ⏰

### Issue
Cloudflare Workers have strict execution time limits:
- **Free tier**: 10 seconds CPU time
- **Paid tier**: 30 seconds CPU time (50ms for subrequests)

### Impact
Long-running AI operations (URL scraping + analysis + question generation) would timeout, causing:
- `504 Gateway Timeout` errors
- Lost work and poor UX
- Failed deployments

### Solutions

#### A. Implement Request Timeouts
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

try {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)'
    },
    signal: controller.signal
  })
} catch (fetchError) {
  clearTimeout(timeoutId)
  if (fetchError instanceof Error && fetchError.name === 'AbortError') {
    return new Response(JSON.stringify({
      error: 'URL fetch timeout - page took too long to load'
    }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  throw fetchError
} finally {
  clearTimeout(timeoutId)
}
```

#### B. Two-Phase Loading Strategy
Instead of doing everything in one request:
1. **Phase 1**: Return answered questions immediately
2. **Phase 2**: Optionally generate follow-up questions (user-triggered)

```typescript
// Phase 1: Fast response with answered questions
const extractedData = await extractAnsweredQuestions(content)

// Phase 2: Separate endpoint for follow-up questions
// POST /api/ai/generate-questions
const followUpQuestions = await generateFollowUpQuestions(existingData)
```

#### C. Optimize AI Requests
- Reduce `max_completion_tokens` from 2000 → 800
- Limit content sent to AI: 15KB → 10KB
- Simplify prompts to reduce processing time
- Generate fewer questions: 2-3 → 1-2 per category

---

## 2. Model Configuration 🤖

### Issue: Temperature Parameter Not Supported
```typescript
// ❌ WRONG - This will fail!
{
  model: 'gpt-5-mini',
  temperature: 0.3,  // Error: "Unsupported value: 'temperature' does not support 0.3"
  messages: [...]
}
```

**Error Message**:
```
Unsupported value: 'temperature' does not support 0.3 with this model.
Only the default (1) value is supported.
```

### Solution
Remove the `temperature` parameter entirely:
```typescript
// ✅ CORRECT
{
  model: 'gpt-5-mini',
  messages: [...],
  max_completion_tokens: 800
}
```

### Supported Models
- `gpt-5-mini` ✅ (fastest, cheapest)
- `gpt-5-nano` ✅ (ultra-fast)
- `gpt-5` ✅ (most capable)
- ~~`gpt-4o`~~ ❌ (per user instructions, never use)

---

## 3. Response Validation & Error Handling 🛡️

### Issue: Silent Failures
AI responses sometimes:
- Return empty content
- Have invalid structure
- Fail JSON parsing
- Return null values

### Solution: Comprehensive Validation

```typescript
// 1. Check response structure
if (!data.choices || !data.choices[0] || !data.choices[0].message) {
  console.error('Invalid OpenAI response structure:', data)
  return {
    _error: 'Invalid API response structure',
    _raw: JSON.stringify(data),
    _framework: framework,
    _model: 'gpt-5-mini'
  }
}

// 2. Validate content exists
const responseText = data.choices[0].message.content || ''
if (!responseText.trim()) {
  console.error('AI returned empty response')
  throw new Error('AI returned empty response')
}

// 3. Clean JSON before parsing
const jsonText = responseText
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim()

if (!jsonText) {
  throw new Error('AI returned empty response after cleaning')
}

// 4. Try parsing with error handling
try {
  const parsed = JSON.parse(jsonText)
  return parsed
} catch (parseError) {
  console.error('JSON parse error:', parseError)
  return {
    _parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
    _raw: responseText,
    _framework: framework,
    _model: 'gpt-5-mini'
  }
}
```

### Display Errors in UI
```tsx
{/* Show extraction errors */}
{extractedData._error && (
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
    <h4 className="font-semibold text-red-800 dark:text-red-400 mb-2">
      ⚠️ Extraction Error
    </h4>
    <p className="text-sm text-red-700 dark:text-red-300 mb-2">
      {extractedData._error}
    </p>
    <p className="text-xs text-red-600 dark:text-red-400">
      Model: {extractedData._model || 'unknown'} • Framework: {extractedData._framework || 'unknown'}
    </p>
  </div>
)}

{/* Show parse errors with raw response */}
{extractedData._parseError && (
  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
    <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
      ⚠️ JSON Parsing Error
    </h4>
    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
      The AI response couldn't be parsed as JSON:
    </p>
    <p className="text-xs font-mono text-yellow-600 dark:text-yellow-400 mb-2">
      {extractedData._parseError}
    </p>
    {extractedData._raw && (
      <details className="mt-2">
        <summary className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 cursor-pointer">
          Show raw response
        </summary>
        <pre className="mt-2 text-xs bg-yellow-100 dark:bg-yellow-900/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">
          {extractedData._raw}
        </pre>
      </details>
    )}
  </div>
)}
```

---

## 4. Network Timeout Handling 🌐

### Issue: "Load failed" Errors
External URL fetching would fail with cryptic errors:
```
TypeError: Load failed
```

This happens when:
- Pages load slowly (>15 seconds)
- Sites block bots/scrapers
- Network connectivity issues
- DNS resolution failures

### Solution: User-Friendly Error Messages

```typescript
try {
  const response = await fetch('/api/ai/scrape-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim(), framework })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Server error: ${response.status}`)
  }

  const data = await response.json()
  setScrapedData(data)
} catch (err) {
  console.error('Scraping error:', err)

  // Better error messages for common issues
  let errorMessage = 'Failed to scrape URL'

  if (err instanceof TypeError && err.message === 'Load failed') {
    errorMessage = 'Network error: The request timed out or connection was lost. The page may be too slow to load or blocking requests. Try a different URL.'
  } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
    errorMessage = 'Network error: Unable to connect to the server. Please check your internet connection and try again.'
  } else if (err instanceof Error) {
    errorMessage = err.message
  }

  setError(errorMessage)
}
```

---

## 5. Token & Context Management 📊

### Token Limits
- Input tokens: Varies by model
- Output tokens: Set via `max_completion_tokens`
- Total request size impacts performance

### Best Practices

#### A. Limit Content Size
```typescript
// Truncate content to avoid token limits
const truncatedContent = content.substring(0, 10000) // ~10KB
```

#### B. Optimize Prompts
```typescript
// ❌ Verbose prompt
const prompt = `I want you to carefully analyze this article and extract information
according to the Starbursting framework. Please identify answers to questions in each
of the following categories: Who, What, When, Where, Why, and How. For each category,
please provide detailed answers based on the article content...`

// ✅ Concise prompt
const prompt = `Extract Starbursting analysis from this article. Return ONLY JSON:

Article: ${content.substring(0, 10000)}

Format: {"who": [{"q":"Q?","a":"A"}], "what": [{"q":"Q?","a":"A"}], ...}`
```

#### C. Set Appropriate Token Limits
```typescript
{
  model: 'gpt-5-mini',
  messages: [...],
  max_completion_tokens: 800  // Adjust based on expected response size
}
```

---

## 6. Prompt Engineering for Cloudflare Workers 📝

### Key Principles

1. **Be Explicit About Format**
   ```typescript
   const prompt = `Return ONLY valid JSON. No markdown, no explanations, just JSON.`
   ```

2. **Use Examples**
   ```typescript
   Format: {"who": ["Q1?", "Q2?"], "what": ["Q1?", "Q2?"], ...}
   ```

3. **Request Minimal Output**
   ```typescript
   // Generate 1-2 questions per category (not 2-3)
   const prompt = `Generate 1-2 important follow-up questions for each category`
   ```

4. **Provide Context Efficiently**
   ```typescript
   // Build context from existing data
   const existingQuestions = Object.entries(existingData)
     .map(([category, items]) => {
       if (Array.isArray(items)) {
         return `${category}: ${items.map((item: any) =>
           typeof item === 'object' && item.question ? item.question : item
         ).join(', ')}`
       }
       return ''
     })
     .filter(Boolean)
     .join('\n')
   ```

---

## 7. Debugging & Logging 🔍

### Comprehensive Logging Strategy

```typescript
export const onRequestPost: PagesFunction<Env> = async (context) => {
  console.log(`[Scrape URL] Starting request for framework: ${framework}`)

  try {
    // Log important steps
    console.log(`[Scrape URL] Fetching URL: ${url}`)
    console.log(`[Scrape URL] Content length: ${content.length} chars`)
    console.log(`[Scrape URL] Calling OpenAI for ${framework} extraction`)

    // Log AI response
    console.log(`[Scrape URL] OpenAI response received, choice count: ${extractData.choices?.length}`)

    // Log final data
    console.log(`[Scrape URL] Extracted ${Object.keys(extractedData).length} categories`)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Scrape URL] Error:', error)
    console.error('[Scrape URL] Stack:', error instanceof Error ? error.stack : 'N/A')

    return new Response(JSON.stringify({
      error: 'Scraping failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

### View Logs
```bash
# Tail deployment logs
npx wrangler pages deployment tail <deployment-id> --project-name <project-name> --format pretty

# Or check log files
cat /Users/sac/Library/Preferences/.wrangler/logs/wrangler-*.log
```

---

## 8. Performance Optimization 🚀

### Strategies Used

1. **Parallel Processing** (where possible)
   ```typescript
   const [summary, extractedData] = await Promise.all([
     generateSummary(content),
     extractFrameworkData(content)
   ])
   ```

2. **Lazy Loading** (separate endpoints)
   - `/api/ai/scrape-url` - Fast initial data
   - `/api/ai/generate-questions` - Optional follow-up

3. **Caching** (not implemented yet, but recommended)
   ```typescript
   // Cache URL content for 15 minutes
   const cache = caches.default
   const cacheKey = new Request(url)
   let response = await cache.match(cacheKey)

   if (!response) {
     response = await fetch(url)
     await cache.put(cacheKey, response.clone())
   }
   ```

4. **Reduced Model Calls**
   - Combined operations where possible
   - Reuse summarization for title generation
   - Single extraction pass instead of multiple

---

## 9. Common Pitfalls & Solutions 🚨

### Pitfall 1: Not Handling Partial Failures
**Problem**: AI extracts some data but fails on others
**Solution**: Return partial results with error flags
```typescript
{
  who: [/* extracted data */],
  what: [/* extracted data */],
  _error: "Failed to extract 'when' category",
  _framework: "starbursting"
}
```

### Pitfall 2: Assuming JSON is Always Valid
**Problem**: AI sometimes returns markdown-wrapped JSON
**Solution**: Clean response before parsing
```typescript
const jsonText = responseText
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim()
```

### Pitfall 3: Not Setting User-Agent
**Problem**: Many sites block requests without proper User-Agent
**Solution**: Always set User-Agent header
```typescript
const response = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)'
  }
})
```

### Pitfall 4: Ignoring CORS in Development
**Problem**: Local dev can't call Workers functions
**Solution**: Use Wrangler dev mode
```bash
npm run wrangler:dev
```

---

## 10. Architecture Decisions 🏗️

### Decision 1: Cloudflare Pages Functions vs Workers
**Chose**: Cloudflare Pages Functions
**Reason**:
- Integrated with frontend deployment
- Same deployment pipeline
- Easier environment variable management
- No separate Worker setup needed

### Decision 2: Separate Endpoints vs Single Endpoint
**Chose**: Separate endpoints for different operations
**Reason**:
- `/api/ai/scrape-url` - URL extraction
- `/api/ai/generate-questions` - Follow-up questions
- `/api/ai/generate-title` - Title generation
- Better timeout management
- User controls when heavy operations run
- Clearer error handling per operation

### Decision 3: Client-Side vs Server-Side Processing
**Chose**: Server-side (Cloudflare Functions)
**Reason**:
- Protect API keys
- Centralized rate limiting
- Better error handling
- Consistent processing environment

---

## 11. Cost Optimization 💰

### Token Usage Monitoring
```typescript
// Track token usage in logs
console.log(`[AI] Prompt tokens: ~${promptText.length / 4}`)
console.log(`[AI] Max completion tokens: ${max_completion_tokens}`)
```

### Model Selection
- Use `gpt-5-mini` for most operations (cheapest)
- Use `gpt-5-nano` for simple tasks (fastest)
- Reserve `gpt-5` for complex analysis only

### Caching Strategy
- Cache URL content (15 min TTL)
- Cache analysis results (1 hour TTL)
- Don't cache AI generations (they should be fresh)

---

## 12. Testing Strategies 🧪

### Test Cases to Cover

1. **Happy Path**
   - Valid URL returns structured data
   - All fields populated correctly
   - JSON parses successfully

2. **Error Cases**
   - Invalid URL (404, 500)
   - Timeout scenarios
   - Malformed AI responses
   - Empty content
   - Rate limiting

3. **Edge Cases**
   - Very long articles (>50KB)
   - Articles with no relevant data
   - Non-English content
   - Paywalled content
   - Dynamic JavaScript sites

### Sample Test
```typescript
// Test timeout handling
const controller = new AbortController()
setTimeout(() => controller.abort(), 100) // Force timeout

try {
  await fetch('https://slow-site.com', { signal: controller.signal })
} catch (err) {
  expect(err.name).toBe('AbortError')
}
```

---

## 13. Deployment Checklist ✅

Before deploying AI features:

- [ ] Remove any `temperature` parameters
- [ ] Set appropriate `max_completion_tokens`
- [ ] Implement timeout handling with `AbortController`
- [ ] Add comprehensive error logging
- [ ] Validate AI response structure
- [ ] Clean JSON responses (remove markdown)
- [ ] Test with various URL types
- [ ] Check OPENAI_API_KEY is set in Cloudflare dashboard
- [ ] Verify model names (gpt-5-mini, not gpt-4o)
- [ ] Add user-friendly error messages
- [ ] Test timeout scenarios
- [ ] Monitor deployment logs

---

## 14. Future Improvements 🔮

### Recommendations

1. **Implement Request Queuing**
   - Use Cloudflare Queues for long-running jobs
   - WebSocket for real-time progress updates

2. **Add Retry Logic**
   ```typescript
   async function fetchWithRetry(url: string, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fetch(url)
       } catch (err) {
         if (i === maxRetries - 1) throw err
         await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
       }
     }
   }
   ```

3. **Streaming Responses**
   - Use OpenAI streaming API
   - Stream results to UI as they arrive
   - Better UX for long operations

4. **Rate Limiting**
   - Implement per-user rate limits
   - Use Cloudflare KV for rate limit tracking
   - Return 429 when limits exceeded

5. **Analytics**
   - Track token usage per user
   - Monitor error rates by endpoint
   - Measure response times

---

## Summary

### Top 5 Lessons

1. ⏰ **Respect Worker Time Limits** - 10-30 second max, use timeouts and two-phase loading
2. 🤖 **No Temperature Parameter** - Remove it entirely for gpt-5-mini
3. 🛡️ **Always Validate Responses** - Check structure, content, and parse errors
4. 🌐 **Handle Network Failures Gracefully** - Timeout, retry, user-friendly errors
5. 📊 **Optimize Token Usage** - Limit content, concise prompts, appropriate token limits

### Quick Reference

```typescript
// ✅ Perfect Cloudflare Worker AI Call
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 15000)

try {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: 'Return ONLY valid JSON.' },
        { role: 'user', content: promptText }
      ],
      max_completion_tokens: 800
    })
  })

  if (!response.ok) throw new Error(`AI API error: ${response.status}`)

  const data = await response.json()

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid AI response structure')
  }

  const jsonText = data.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  return JSON.parse(jsonText)
} catch (error) {
  console.error('AI call failed:', error)
  throw error
} finally {
  clearTimeout(timeoutId)
}
```

---

*Document created: 2025-10-04*
*Last updated: 2025-10-04*
*Project: ResearchToolsPy Frontend (Cloudflare Pages)*
