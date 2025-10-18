/**
 * Git Repository Extraction Endpoint
 *
 * Provides specialized extraction for Git repository hosting platforms:
 * - GitHub: Repository info, README, latest commits, releases, languages
 * - GitLab: Repository metadata, files, activity
 * - Bitbucket: Repository details, recent commits
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  CACHE: KVNamespace
  GITHUB_TOKEN?: string  // Optional: for higher rate limits
}

interface GitRepoExtractRequest {
  url: string
  platform?: string  // Auto-detected if not provided
}

interface RepositoryInfo {
  success: boolean
  platform: string
  repository?: {
    name: string
    fullName: string
    owner: string
    description?: string
    homepage?: string
    language?: string
    languages?: Record<string, number>
    stars?: number
    forks?: number
    watchers?: number
    openIssues?: number
    license?: string
    topics?: string[]
    createdAt?: string
    updatedAt?: string
    pushedAt?: string
    size?: number
    defaultBranch?: string
    isArchived?: boolean
    isFork?: boolean
  }
  readme?: {
    content: string
    truncated: boolean
  }
  latestCommit?: {
    sha: string
    message: string
    author: string
    date: string
    url: string
  }
  latestRelease?: {
    name: string
    tag: string
    publishedAt: string
    url: string
    description?: string
  }
  recentCommits?: Array<{
    sha: string
    message: string
    author: string
    date: string
  }>
  contributors?: number
  error?: string
}

// ========================================
// Helper Functions
// ========================================

/**
 * Get cached result or fetch fresh
 */
async function getCached<T>(
  cache: KVNamespace | undefined,
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!cache) {
    return await fetcher()
  }

  try {
    const cached = await cache.get(key)
    if (cached) {
      console.log(`[Cache HIT] ${key}`)
      return JSON.parse(cached) as T
    }
  } catch (cacheError) {
    console.warn('[Cache] Read error:', cacheError)
  }

  console.log(`[Cache MISS] ${key}`)
  const result = await fetcher()

  try {
    await cache.put(key, JSON.stringify(result), {
      expirationTtl: ttl
    })
  } catch (cacheError) {
    console.warn('[Cache] Write error:', cacheError)
  }

  return result
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const body: GitRepoExtractRequest = await request.json() as GitRepoExtractRequest
    const { url, platform: providedPlatform } = body

    if (!url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'URL is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Detect platform
    const platform = providedPlatform || detectGitPlatform(url)

    if (!platform) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not detect Git platform from URL. Supported platforms: GitHub, GitLab, Bitbucket'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`[Git Extract] Platform: ${platform}, URL: ${url}`)

    // Create cache key
    const cacheKey = `git:${platform}:${encodeURIComponent(url)}`

    // Route to platform-specific extraction with caching (1 hour TTL)
    const result = await getCached<RepositoryInfo>(
      env.CACHE,
      cacheKey,
      3600,
      async () => {
        switch (platform) {
          case 'github':
            return await extractGitHub(url, env)
          case 'gitlab':
            return await extractGitLab(url)
          case 'bitbucket':
            return await extractBitbucket(url)
          default:
            return {
              success: false,
              platform,
              error: `Platform '${platform}' not yet supported. Supported platforms: GitHub, GitLab, Bitbucket.`
            }
        }
      }
    )

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 422,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Git Extract] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// Platform Detection
// ========================================

function detectGitPlatform(url: string): string | null {
  const urlLower = url.toLowerCase()

  if (urlLower.includes('github.com')) {
    return 'github'
  }
  if (urlLower.includes('gitlab.com')) {
    return 'gitlab'
  }
  if (urlLower.includes('bitbucket.org')) {
    return 'bitbucket'
  }

  return null
}

// ========================================
// GitHub Extraction
// ========================================

async function extractGitHub(url: string, env: Env): Promise<RepositoryInfo> {
  try {
    // Extract owner and repo from URL
    // Format: https://github.com/owner/repo
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/)
    if (!match) {
      return {
        success: false,
        platform: 'github',
        error: 'Invalid GitHub URL format. Expected: github.com/owner/repo'
      }
    }

    const owner = match[1]
    const repo = match[2].replace(/\.git$/, '') // Remove .git suffix if present

    console.log(`[GitHub] Fetching ${owner}/${repo}`)

    // Set up headers with auth token if available
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ResearchTools-ContentIntelligence'
    }

    if (env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${env.GITHUB_TOKEN}`
    }

    // Fetch repository information
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers
    })

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        return {
          success: false,
          platform: 'github',
          error: 'Repository not found. It may be private or the URL is incorrect.'
        }
      }
      if (repoResponse.status === 403) {
        return {
          success: false,
          platform: 'github',
          error: 'GitHub API rate limit exceeded. Try again later.'
        }
      }
      throw new Error(`GitHub API returned ${repoResponse.status}`)
    }

    const repoData = await repoResponse.json() as any

    // Fetch README
    let readme: { content: string, truncated: boolean } | undefined
    try {
      const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers
      })

      if (readmeResponse.ok) {
        const readmeData = await readmeResponse.json() as any
        const content = Buffer.from(readmeData.content, 'base64').toString('utf-8')

        // Limit README to first 5000 characters for performance
        readme = {
          content: content.substring(0, 5000),
          truncated: content.length > 5000
        }
      }
    } catch (readmeError) {
      console.warn('[GitHub] README fetch failed:', readmeError)
    }

    // Fetch languages
    let languages: Record<string, number> | undefined
    try {
      const langsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
        headers
      })

      if (langsResponse.ok) {
        languages = await langsResponse.json() as Record<string, number>
      }
    } catch (langError) {
      console.warn('[GitHub] Languages fetch failed:', langError)
    }

    // Fetch latest commits (up to 5)
    let recentCommits: Array<{ sha: string, message: string, author: string, date: string }> | undefined
    let latestCommit: { sha: string, message: string, author: string, date: string, url: string } | undefined
    try {
      const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`, {
        headers
      })

      if (commitsResponse.ok) {
        const commitsData = await commitsResponse.json() as any[]
        recentCommits = commitsData.map(c => ({
          sha: c.sha.substring(0, 7),
          message: c.commit.message.split('\n')[0], // First line only
          author: c.commit.author.name,
          date: c.commit.author.date
        }))

        if (commitsData.length > 0) {
          const latest = commitsData[0]
          latestCommit = {
            sha: latest.sha.substring(0, 7),
            message: latest.commit.message.split('\n')[0],
            author: latest.commit.author.name,
            date: latest.commit.author.date,
            url: latest.html_url
          }
        }
      }
    } catch (commitsError) {
      console.warn('[GitHub] Commits fetch failed:', commitsError)
    }

    // Fetch latest release
    let latestRelease: { name: string, tag: string, publishedAt: string, url: string, description?: string } | undefined
    try {
      const releaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
        headers
      })

      if (releaseResponse.ok) {
        const releaseData = await releaseResponse.json() as any
        latestRelease = {
          name: releaseData.name || releaseData.tag_name,
          tag: releaseData.tag_name,
          publishedAt: releaseData.published_at,
          url: releaseData.html_url,
          description: releaseData.body
        }
      }
    } catch (releaseError) {
      console.warn('[GitHub] Release fetch failed:', releaseError)
    }

    // Fetch contributors count
    let contributors: number | undefined
    try {
      const contributorsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1`, {
        headers
      })

      if (contributorsResponse.ok) {
        // Get total from Link header
        const linkHeader = contributorsResponse.headers.get('Link')
        if (linkHeader) {
          const match = linkHeader.match(/page=(\d+)>; rel="last"/)
          contributors = match ? parseInt(match[1]) : 1
        } else {
          contributors = 1
        }
      }
    } catch (contributorsError) {
      console.warn('[GitHub] Contributors fetch failed:', contributorsError)
    }

    return {
      success: true,
      platform: 'github',
      repository: {
        name: repoData.name,
        fullName: repoData.full_name,
        owner: repoData.owner.login,
        description: repoData.description,
        homepage: repoData.homepage,
        language: repoData.language,
        languages,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        watchers: repoData.watchers_count,
        openIssues: repoData.open_issues_count,
        license: repoData.license?.name,
        topics: repoData.topics,
        createdAt: repoData.created_at,
        updatedAt: repoData.updated_at,
        pushedAt: repoData.pushed_at,
        size: repoData.size,
        defaultBranch: repoData.default_branch,
        isArchived: repoData.archived,
        isFork: repoData.fork
      },
      readme,
      latestCommit,
      latestRelease,
      recentCommits,
      contributors
    }

  } catch (error) {
    console.error('[GitHub] Extraction failed:', error)
    return {
      success: false,
      platform: 'github',
      error: error instanceof Error ? error.message : 'GitHub extraction failed'
    }
  }
}

// ========================================
// GitLab Extraction
// ========================================

async function extractGitLab(url: string): Promise<RepositoryInfo> {
  try {
    // Extract project path from URL
    // Format: https://gitlab.com/group/subgroup/project
    const match = url.match(/gitlab\.com\/(.+?)(?:\.git)?(?:\/|$)/)
    if (!match) {
      return {
        success: false,
        platform: 'gitlab',
        error: 'Invalid GitLab URL format. Expected: gitlab.com/group/project'
      }
    }

    const projectPath = match[1].replace(/\/$/, '')
    const encodedPath = encodeURIComponent(projectPath)

    console.log(`[GitLab] Fetching project: ${projectPath}`)

    // Fetch project information using GitLab public API
    const projectResponse = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}`, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!projectResponse.ok) {
      if (projectResponse.status === 404) {
        return {
          success: false,
          platform: 'gitlab',
          error: 'GitLab project not found or is private.'
        }
      }
      throw new Error(`GitLab API returned ${projectResponse.status}`)
    }

    const projectData = await projectResponse.json() as any

    // Fetch README
    let readme: { content: string, truncated: boolean } | undefined
    try {
      const readmeResponse = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}/repository/files/README.md/raw?ref=${projectData.default_branch}`)

      if (readmeResponse.ok) {
        const content = await readmeResponse.text()
        readme = {
          content: content.substring(0, 5000),
          truncated: content.length > 5000
        }
      }
    } catch (readmeError) {
      console.warn('[GitLab] README fetch failed:', readmeError)
    }

    // Fetch latest commits
    let recentCommits: Array<{ sha: string, message: string, author: string, date: string }> | undefined
    let latestCommit: { sha: string, message: string, author: string, date: string, url: string } | undefined
    try {
      const commitsResponse = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}/repository/commits?per_page=5`)

      if (commitsResponse.ok) {
        const commitsData = await commitsResponse.json() as any[]
        recentCommits = commitsData.map(c => ({
          sha: c.short_id,
          message: c.title,
          author: c.author_name,
          date: c.created_at
        }))

        if (commitsData.length > 0) {
          const latest = commitsData[0]
          latestCommit = {
            sha: latest.short_id,
            message: latest.title,
            author: latest.author_name,
            date: latest.created_at,
            url: latest.web_url
          }
        }
      }
    } catch (commitsError) {
      console.warn('[GitLab] Commits fetch failed:', commitsError)
    }

    // Fetch latest release/tag
    let latestRelease: { name: string, tag: string, publishedAt: string, url: string } | undefined
    try {
      const releaseResponse = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}/releases?per_page=1`)

      if (releaseResponse.ok) {
        const releases = await releaseResponse.json() as any[]
        if (releases.length > 0) {
          const release = releases[0]
          latestRelease = {
            name: release.name,
            tag: release.tag_name,
            publishedAt: release.released_at,
            url: release._links.self
          }
        }
      }
    } catch (releaseError) {
      console.warn('[GitLab] Release fetch failed:', releaseError)
    }

    return {
      success: true,
      platform: 'gitlab',
      repository: {
        name: projectData.name,
        fullName: projectData.path_with_namespace,
        owner: projectData.namespace.name,
        description: projectData.description,
        homepage: projectData.web_url,
        language: null, // GitLab doesn't provide primary language in basic API
        stars: projectData.star_count,
        forks: projectData.forks_count,
        openIssues: projectData.open_issues_count,
        topics: projectData.topics || projectData.tag_list,
        createdAt: projectData.created_at,
        updatedAt: projectData.last_activity_at,
        defaultBranch: projectData.default_branch,
        isArchived: projectData.archived,
        isFork: projectData.forked_from_project !== undefined
      },
      readme,
      latestCommit,
      latestRelease,
      recentCommits
    }

  } catch (error) {
    console.error('[GitLab] Extraction failed:', error)
    return {
      success: false,
      platform: 'gitlab',
      error: error instanceof Error ? error.message : 'GitLab extraction failed'
    }
  }
}

// ========================================
// Bitbucket Extraction
// ========================================

async function extractBitbucket(url: string): Promise<RepositoryInfo> {
  try {
    // Extract workspace and repo from URL
    // Format: https://bitbucket.org/workspace/repo
    const match = url.match(/bitbucket\.org\/([^\/]+)\/([^\/\?#]+)/)
    if (!match) {
      return {
        success: false,
        platform: 'bitbucket',
        error: 'Invalid Bitbucket URL format. Expected: bitbucket.org/workspace/repo'
      }
    }

    const workspace = match[1]
    const repoSlug = match[2]

    console.log(`[Bitbucket] Fetching ${workspace}/${repoSlug}`)

    // Fetch repository information using Bitbucket API v2.0
    const repoResponse = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}`)

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        return {
          success: false,
          platform: 'bitbucket',
          error: 'Bitbucket repository not found or is private.'
        }
      }
      throw new Error(`Bitbucket API returned ${repoResponse.status}`)
    }

    const repoData = await repoResponse.json() as any

    // Fetch README
    let readme: { content: string, truncated: boolean } | undefined
    try {
      const readmeResponse = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/src/${repoData.mainbranch?.name || 'master'}/README.md`)

      if (readmeResponse.ok) {
        const content = await readmeResponse.text()
        readme = {
          content: content.substring(0, 5000),
          truncated: content.length > 5000
        }
      }
    } catch (readmeError) {
      console.warn('[Bitbucket] README fetch failed:', readmeError)
    }

    // Fetch latest commits
    let recentCommits: Array<{ sha: string, message: string, author: string, date: string }> | undefined
    let latestCommit: { sha: string, message: string, author: string, date: string, url: string } | undefined
    try {
      const commitsResponse = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/commits?pagelen=5`)

      if (commitsResponse.ok) {
        const commitsData = await commitsResponse.json() as any
        recentCommits = commitsData.values?.map((c: any) => ({
          sha: c.hash.substring(0, 7),
          message: c.message.split('\n')[0],
          author: c.author.user?.display_name || c.author.raw,
          date: c.date
        }))

        if (commitsData.values && commitsData.values.length > 0) {
          const latest = commitsData.values[0]
          latestCommit = {
            sha: latest.hash.substring(0, 7),
            message: latest.message.split('\n')[0],
            author: latest.author.user?.display_name || latest.author.raw,
            date: latest.date,
            url: latest.links.html.href
          }
        }
      }
    } catch (commitsError) {
      console.warn('[Bitbucket] Commits fetch failed:', commitsError)
    }

    return {
      success: true,
      platform: 'bitbucket',
      repository: {
        name: repoData.name,
        fullName: repoData.full_name,
        owner: repoData.owner.display_name,
        description: repoData.description,
        homepage: repoData.website,
        language: repoData.language,
        size: repoData.size,
        createdAt: repoData.created_on,
        updatedAt: repoData.updated_on,
        defaultBranch: repoData.mainbranch?.name,
        isFork: repoData.parent !== undefined
      },
      readme,
      latestCommit,
      recentCommits
    }

  } catch (error) {
    console.error('[Bitbucket] Extraction failed:', error)
    return {
      success: false,
      platform: 'bitbucket',
      error: error instanceof Error ? error.message : 'Bitbucket extraction failed'
    }
  }
}
