# AI Gateway Setup Instructions
## Research Tools Platform

**Estimated Time**: 10 minutes
**Prerequisites**: Cloudflare account with Pages project deployed

---

## Step 1: Create AI Gateway Instance

1. **Go to Cloudflare Dashboard**
   - Navigate to: https://dash.cloudflare.com/
   - Select your account

2. **Navigate to AI Gateway**
   - Left sidebar → **AI** → **AI Gateway**
   - Click **"Create Gateway"**

3. **Configure Gateway**
   ```
   Gateway Name: research-tools-ai
   Endpoint Slug: research-tools-ai
   Provider: OpenAI
   ```

4. **Click "Create Gateway"**

You should see your new gateway listed with an endpoint URL like:
```
https://gateway.ai.cloudflare.com/v1/{account_id}/research-tools-ai/openai
```

---

## Step 2: Get Your Account ID

1. **From the AI Gateway page**
   - Copy the full gateway URL
   - Extract the account ID (the long string after `/v1/`)

2. **Alternative: From Account Settings**
   - Click on your account name (top left)
   - Go to **Account Home**
   - Account ID is shown on the right side

**Example Account ID**: `1a2b3c4d5e6f7g8h9i0j`

---

## Step 3: Add Environment Variable (Wrangler)

Since we're using Cloudflare Pages, we need to add the account ID as a binding or environment variable.

### Option A: Via Cloudflare Dashboard (Recommended)

1. **Go to Pages Project**
   - Dashboard → **Pages** → **researchtoolspy**
   - Go to **Settings** → **Environment Variables**

2. **Add Variable**
   ```
   Variable Name: AI_GATEWAY_ACCOUNT_ID
   Value: {your-account-id}
   Environment: Production & Preview
   ```

3. **Save and Redeploy**
   - Click "Save"
   - Trigger a new deployment for changes to take effect

### Option B: Via wrangler.toml (Not recommended for secrets)

If you want to use wrangler.toml for non-sensitive values:

```toml
[env.production.vars]
AI_GATEWAY_ACCOUNT_ID = "your-account-id-here"
```

**Note**: Account ID is not sensitive, but using dashboard environment variables is cleaner.

---

## Step 4: Verify Setup

Once deployed, test the gateway is accessible:

```bash
# Test direct OpenAI call (should work)
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test via AI Gateway (should also work once integrated)
curl https://gateway.ai.cloudflare.com/v1/{account_id}/research-tools-ai/openai/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

Both should return a list of models.

---

## Step 5: Configure Caching & Rate Limiting

1. **Go to AI Gateway Settings**
   - Dashboard → AI → AI Gateway → research-tools-ai
   - Click **Settings**

2. **Enable Caching** (Recommended)
   ```
   ✅ Enable Response Caching
   Cache TTL: 3600 seconds (1 hour)
   Cache Key: Request Body + Headers
   ```

3. **Configure Rate Limiting** (Optional at gateway level)
   ```
   Rate Limit: 1000 requests per hour (global)
   Burst Limit: 100 requests per minute
   ```

   **Note**: We'll also implement per-user rate limiting in code.

4. **Enable Analytics**
   ```
   ✅ Log all requests
   ✅ Track token usage
   ✅ Monitor costs
   ```

---

## Step 6: Verify Environment Variable

After adding the environment variable and redeploying:

```bash
# Check environment variables are set
npx wrangler pages deployment list --project-name researchtoolspy
```

Or test in a simple function:

```typescript
export async function onRequest(context) {
  return new Response(JSON.stringify({
    hasAccountId: !!context.env.AI_GATEWAY_ACCOUNT_ID,
    accountId: context.env.AI_GATEWAY_ACCOUNT_ID?.substring(0, 8) + '...'
  }))
}
```

---

## Configuration Summary

After setup, you should have:

- ✅ AI Gateway instance: `research-tools-ai`
- ✅ Gateway URL: `https://gateway.ai.cloudflare.com/v1/{account_id}/research-tools-ai/openai`
- ✅ Environment variable: `AI_GATEWAY_ACCOUNT_ID` set in Cloudflare Pages
- ✅ Caching enabled (1 hour TTL)
- ✅ Analytics enabled

---

## Next Steps

Once setup is complete:

1. **Code will be updated** to use AI Gateway by default
2. **Automatic fallback** to direct OpenAI if gateway fails
3. **Monitor dashboard** for cache hit rates and costs
4. **Deploy changes** and verify integration

---

## Troubleshooting

### Gateway URL not working

**Check**:
- Account ID is correct (copy from dashboard)
- OPENAI_API_KEY is still valid
- Gateway name matches exactly: `research-tools-ai`

### Environment variable not available

**Fix**:
1. Verify variable is set in Pages → Settings → Environment Variables
2. Redeploy the site (env vars only apply to new deployments)
3. Check both Production and Preview environments

### 403 Forbidden errors

**Cause**: Incorrect account ID or gateway name
**Fix**: Double-check the gateway URL in dashboard and update `AI_GATEWAY_ACCOUNT_ID`

---

## Monitoring

Once deployed, monitor performance:

**AI Gateway Dashboard**:
- Requests per minute
- Cache hit rate (target: 60-80%)
- Token usage and costs
- Error rates

**Analytics URL**:
https://dash.cloudflare.com/ → AI → AI Gateway → research-tools-ai → Analytics

---

**Setup complete! Proceed with code integration.** 🚀
