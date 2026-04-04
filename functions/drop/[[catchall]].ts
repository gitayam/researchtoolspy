/**
 * Survey OG Meta Tag Injector
 *
 * Intercepts /drop/* requests. For bot user-agents, fetches survey data
 * from D1 and returns HTML with OG meta tags for rich link previews.
 * Human visitors pass through to the SPA.
 */

interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

// Bot user-agents that need server-rendered meta tags for unfurling
const BOT_UA_PATTERNS = [
  'facebookexternalhit', 'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot', 'Slack-ImgProxy',
  'Discordbot',
  'WhatsApp',
  'TelegramBot',
  'Googlebot', 'bingbot',
  'iMessageLinkPreview',
  'Applebot',
]

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false
  return BOT_UA_PATTERNS.some(bot => userAgent.includes(bot))
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const ua = request.headers.get('User-Agent')

  // Human visitors: pass through to SPA
  if (!isBot(ua)) {
    return env.ASSETS.fetch(request)
  }

  // Bot: extract slug/token from URL path
  const url = new URL(request.url)
  const pathParts = url.pathname.replace('/drop/', '').split('/').filter(Boolean)
  const slugOrToken = pathParts[0]

  if (!slugOrToken) {
    return env.ASSETS.fetch(request)
  }

  // Try to find the survey — first by slug, then by token
  let survey = await env.DB.prepare(
    `SELECT title, description, status, submission_count, theme_color, custom_slug, share_token
     FROM survey_drops WHERE custom_slug = ? AND status = 'active'`
  ).bind(slugOrToken).first<{
    title: string | null
    description: string | null
    status: string
    submission_count: number
    theme_color: string | null
    custom_slug: string | null
    share_token: string
  }>()

  if (!survey) {
    survey = await env.DB.prepare(
      `SELECT title, description, status, submission_count, theme_color, custom_slug, share_token
       FROM survey_drops WHERE share_token = ? AND status = 'active'`
    ).bind(slugOrToken).first()
  }

  if (!survey) {
    return env.ASSETS.fetch(request)
  }

  // Build OG meta tags
  const title = survey.title || 'Survey'
  const description = survey.description || 'Submit your response to this research survey'
  const siteUrl = url.origin
  const canonicalUrl = survey.custom_slug
    ? `${siteUrl}/drop/${survey.custom_slug}`
    : `${siteUrl}/drop/${survey.share_token}`
  const submissionText = survey.submission_count > 0
    ? `${survey.submission_count} response${survey.submission_count !== 1 ? 's' : ''} collected`
    : 'Open for submissions'

  const ogImage = `${siteUrl}/og-survey.png`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — ResearchTools Survey</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)} · ${submissionText}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(title)} — Research Survey" />
  <meta property="og:site_name" content="ResearchTools" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)} · ${submissionText}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)} — Research Survey" />

  <!-- Redirect human visitors who somehow land here -->
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p>${submissionText}</p>
  <p><a href="${canonicalUrl}">Open survey</a></p>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
