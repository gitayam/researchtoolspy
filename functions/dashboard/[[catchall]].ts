/**
 * Dashboard OG Meta Tag Injector
 *
 * Intercepts ALL /dashboard/* requests. For bot user-agents, returns
 * HTML with appropriate OG tags based on the route. Human visitors
 * pass through to the SPA.
 *
 * Covers: analysis frameworks, tools, surveys, COP, intelligence, etc.
 */

interface Env {
  ASSETS: Fetcher
}

const BOT_UA_PATTERNS = [
  'facebookexternalhit', 'Facebot', 'Twitterbot', 'LinkedInBot',
  'Slackbot', 'Slack-ImgProxy', 'Discordbot', 'WhatsApp',
  'TelegramBot', 'Googlebot', 'bingbot', 'iMessageLinkPreview', 'Applebot',
]

function isBot(ua: string | null): boolean {
  if (!ua) return false
  return BOT_UA_PATTERNS.some(bot => ua.includes(bot))
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Route metadata ──────────────────────────────────────────────

interface PageMeta {
  title: string
  description: string
}

// Analysis frameworks
const FRAMEWORKS: Record<string, PageMeta> = {
  'swot-dashboard': {
    title: 'SWOT Analysis',
    description: 'Identify Strengths, Weaknesses, Opportunities, and Threats with structured SWOT framework analysis.',
  },
  'ach-dashboard': {
    title: 'Analysis of Competing Hypotheses (ACH)',
    description: 'Evaluate multiple hypotheses against evidence using the CIA\'s structured analytic technique.',
  },
  'cog': {
    title: 'Center of Gravity (COG) Analysis',
    description: 'Identify critical capabilities, requirements, and vulnerabilities in adversary systems.',
  },
  'pmesii-pt': {
    title: 'PMESII-PT Framework',
    description: 'Analyze Political, Military, Economic, Social, Information, Infrastructure, Physical, and Time dimensions.',
  },
  'dotmlpf': {
    title: 'DOTMLPF Analysis',
    description: 'Assess Doctrine, Organization, Training, Materiel, Leadership, Personnel, and Facilities.',
  },
  'dime': {
    title: 'DIME Framework',
    description: 'Analyze Diplomatic, Information, Military, and Economic instruments of national power.',
  },
  'pest': {
    title: 'PEST Analysis',
    description: 'Examine Political, Economic, Social, and Technological factors affecting the environment.',
  },
  'deception': {
    title: 'Deception Analysis',
    description: 'Detect and analyze deception using MOM (Motive, Opportunity, Means) and POP assessment frameworks.',
  },
  'behavior': {
    title: 'Behavior Analysis',
    description: 'Analyze behavioral patterns, TTPs, and indicators using structured behavioral frameworks.',
  },
  'comb-analysis': {
    title: 'COM-B / Behaviour Change Wheel',
    description: 'Analyze behavior through Capability, Opportunity, and Motivation using the BCW framework.',
  },
  'starbursting': {
    title: 'Starbursting',
    description: 'Generate comprehensive questions (Who, What, Where, When, Why, How) to explore a topic from all angles.',
  },
  'causeway': {
    title: 'Causeway Analysis',
    description: 'Map causal relationships between factors to understand complex systems and dependencies.',
  },
  'stakeholder': {
    title: 'Stakeholder Analysis',
    description: 'Identify, categorize, and assess stakeholders by interest, influence, and alignment.',
  },
  'surveillance': {
    title: 'Surveillance Framework',
    description: 'Structured framework for monitoring and surveillance operation planning and assessment.',
  },
  'fundamental-flow': {
    title: 'Fundamental Flow Analysis',
    description: 'Analyze fundamental flows of people, goods, money, and information across networks.',
  },
}

// Tools
const TOOLS: Record<string, PageMeta> = {
  'content-intelligence': {
    title: 'Content Intelligence',
    description: 'Analyze URLs with AI-powered entity extraction, sentiment analysis, claim detection, and source verification.',
  },
  'scraping': {
    title: 'Web Scraper',
    description: 'Extract and archive web content from social media platforms and websites for open source research.',
  },
  'content-extraction': {
    title: 'Content Extraction',
    description: 'Extract clean text, metadata, and structured data from web pages and documents.',
  },
  'citations-generator': {
    title: 'Citations Generator',
    description: 'Generate properly formatted academic and intelligence citations from source material.',
  },
  'url': {
    title: 'URL Processing',
    description: 'Batch process and analyze multiple URLs for content intelligence and link analysis.',
  },
  'rage-check': {
    title: 'RageCheck',
    description: 'Analyze social media content for emotional manipulation, outrage bait, and radicalization indicators.',
  },
  'batch-processing': {
    title: 'Batch Processing',
    description: 'Process multiple items in bulk — URLs, entities, evidence, and analysis tasks.',
  },
  'equilibrium-analysis': {
    title: 'Equilibrium Analysis',
    description: 'Model game theory scenarios and equilibrium states between competing actors.',
  },
  'hamilton-rule': {
    title: 'Hamilton Rule Calculator',
    description: 'Evaluate altruistic behavior and kin selection using Hamilton\'s Rule (rB > C).',
  },
  'collection': {
    title: 'Collection Manager',
    description: 'Plan, execute, and track intelligence collection operations across multiple sources.',
  },
  'cross-table': {
    title: 'Cross Table',
    description: 'Structured multi-scorer evaluation tool — compare options against weighted criteria with Delphi-style consensus.',
  },
  'social-media': {
    title: 'Social Media Analysis',
    description: 'Extract, analyze, and monitor social media profiles, posts, and engagement patterns.',
  },
  'ach': {
    title: 'ACH Analysis Tool',
    description: 'Analysis of Competing Hypotheses — weigh evidence against multiple hypotheses systematically.',
  },
  'research-question-generator': {
    title: 'Research Question Generator',
    description: 'AI-powered generation of research questions from intelligence topics and source material.',
  },
  'behavior-analysis': {
    title: 'Behavior Analysis Tool',
    description: 'Structured behavioral analysis with pattern detection and TTP classification.',
  },
}

// Other dashboard sections
const SECTIONS: Record<string, PageMeta> = {
  'surveys': {
    title: 'Survey Drops',
    description: 'Create and manage crowdsourced data collection surveys for open source research teams.',
  },
  'cop': {
    title: 'Common Operating Picture',
    description: 'Real-time intelligence workspace — map, timeline, evidence, RFIs, and team collaboration.',
  },
  'intelligence': {
    title: 'Intelligence Dashboard',
    description: 'AI-powered intelligence synthesis — entity networks, predictions, and contradiction detection.',
  },
  'collaboration': {
    title: 'Collaboration Hub',
    description: 'Team workspaces, shared frameworks, and collaborative intelligence analysis.',
  },
  'settings': {
    title: 'Settings',
    description: 'Account settings, workspace management, and platform configuration.',
  },
}

// ── Route resolver ──────────────────────────────────────────────

function resolvePageMeta(pathname: string): PageMeta {
  // Strip /dashboard/ prefix and trailing slashes
  const path = pathname.replace(/^\/dashboard\/?/, '').replace(/\/$/, '')

  // analysis-frameworks/<slug>[/...]
  const fwMatch = path.match(/^analysis-frameworks\/([^/]+)/)
  if (fwMatch && FRAMEWORKS[fwMatch[1]]) {
    return FRAMEWORKS[fwMatch[1]]
  }

  // tools/<slug>[/...]
  const toolMatch = path.match(/^tools\/([^/]+)/)
  if (toolMatch && TOOLS[toolMatch[1]]) {
    return TOOLS[toolMatch[1]]
  }

  // Top-level sections (surveys, cop, intelligence, etc.)
  const section = path.split('/')[0]
  if (section && SECTIONS[section]) {
    return SECTIONS[section]
  }

  // Fallback
  return {
    title: 'ResearchTools Dashboard',
    description: 'Open source research platform — analyze URLs, build intelligence frameworks, and crowdsource data.',
  }
}

// ── Handler ─────────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const ua = request.headers.get('User-Agent')

  if (!isBot(ua)) {
    return env.ASSETS.fetch(request)
  }

  const url = new URL(request.url)
  const meta = resolvePageMeta(url.pathname)
  const siteUrl = url.origin
  const canonicalUrl = `${siteUrl}${url.pathname}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(meta.title)} — ResearchTools</title>
  <meta name="description" content="${esc(meta.description)}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${esc(meta.title)} — ResearchTools" />
  <meta property="og:description" content="${esc(meta.description)}" />
  <meta property="og:image" content="${siteUrl}/og-default.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(meta.title)}" />
  <meta property="og:site_name" content="ResearchTools" />
  <meta property="og:locale" content="en_US" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(meta.title)} — ResearchTools" />
  <meta name="twitter:description" content="${esc(meta.description)}" />
  <meta name="twitter:image" content="${siteUrl}/og-default.png" />
  <meta name="twitter:image:alt" content="${esc(meta.title)}" />

  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <h1>${esc(meta.title)}</h1>
  <p>${esc(meta.description)}</p>
  <a href="${canonicalUrl}">Open in ResearchTools</a>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
