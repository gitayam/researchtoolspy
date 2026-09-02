/** Bounded extraction for public GitHub, GitLab, and Bitbucket repositories. */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'
import { fetchFixedProviderBytes, fetchFixedProviderJson } from '../_shared/fixed-provider'

type Platform = 'github' | 'gitlab' | 'bitbucket'
type RecordValue = Record<string, unknown>

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
  CACHE: KVNamespace
  GITHUB_TOKEN?: string
}

interface RepositoryInfo {
  success: boolean
  platform: string
  repository?: {
    name: string
    fullName: string
    owner: string
    description?: string | null
    homepage?: string | null
    language?: string | null
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
  readme?: { content: string; truncated: boolean }
  latestCommit?: { sha: string; message: string; author: string; date: string; url: string }
  latestRelease?: { name: string; tag: string; publishedAt: string; url: string; description?: string | null }
  recentCommits?: Array<{ sha: string; message: string; author: string; date: string }>
  contributors?: number
  error?: string
}

interface CanonicalRepository { platform: Platform; segments: string[]; identity: string }
interface ParsedCommit { sha: string; message: string; author: string; date: string; url: string }

const ORIGINS: Record<Platform, string> = {
  github: 'https://api.github.com',
  gitlab: 'https://gitlab.com',
  bitbucket: 'https://api.bitbucket.org',
}
const INPUT_HOSTS: Record<Platform, string> = {
  github: 'github.com',
  gitlab: 'gitlab.com',
  bitbucket: 'bitbucket.org',
}
const TIMEOUT_MS = 15_000
const PRIMARY_BYTES = 512 * 1024
const OPTIONAL_BYTES = 1024 * 1024
const README_JSON_BYTES = 2 * 1024 * 1024
const RAW_README_BYTES = 256 * 1024
const DECODED_README_BYTES = 1024 * 1024
const SLUG = /^[A-Za-z0-9._-]{1,100}$/
const RAW_README_TYPES = ['text/plain', 'text/markdown', 'application/octet-stream'] as const

function record(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function req(recordValue: RecordValue, key: string): string | null {
  const value = recordValue[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}
function str(recordValue: RecordValue, key: string): string | undefined {
  const value = recordValue[key]
  return typeof value === 'string' ? value : undefined
}
function nullable(recordValue: RecordValue, key: string): string | null | undefined {
  const value = recordValue[key]
  if (typeof value === 'string') return value
  if (value === null) return null
  return undefined
}
function num(recordValue: RecordValue, key: string): number | undefined {
  const value = recordValue[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
function bool(recordValue: RecordValue, key: string): boolean | undefined {
  return typeof recordValue[key] === 'boolean' ? recordValue[key] : undefined
}
function strings(recordValue: RecordValue, key: string): string[] | undefined {
  const value = recordValue[key]
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : undefined
}
function child(recordValue: RecordValue, key: string): RecordValue | null {
  return record(recordValue[key]) ? recordValue[key] : null
}

function invalidPlatform() {
  return {
    status: 400 as const,
    body: {
      success: false,
      error: 'Could not detect Git platform from URL. Supported platforms: GitHub, GitLab, Bitbucket',
    },
  }
}
function invalidFormat(platform: Platform) {
  const label = platform === 'github' ? 'GitHub' : platform === 'gitlab' ? 'GitLab' : 'Bitbucket'
  const expected = platform === 'github'
    ? 'github.com/owner/repo'
    : platform === 'gitlab' ? 'gitlab.com/group/project' : 'bitbucket.org/workspace/repo'
  return {
    status: 422 as const,
    body: { success: false, platform, error: `Invalid ${label} URL format. Expected: ${expected}` } satisfies RepositoryInfo,
  }
}

function parseRepositoryUrl(input: string, hint: unknown): { repository: CanonicalRepository } | { failure: ReturnType<typeof invalidPlatform | typeof invalidFormat> } {
  const value = input.trim()
  if (!value || value.includes('\\') || value.includes('%')) return { failure: invalidPlatform() }
  let url: URL
  try { url = new URL(value) } catch { return { failure: invalidPlatform() } }
  const hostname = url.hostname.toLowerCase()
  const platform = (Object.entries(INPUT_HOSTS) as Array<[Platform, string]>).find(([, host]) => host === hostname)?.[0]
  if (!platform) return { failure: invalidPlatform() }
  const authority = value.match(/^https:\/\/([^/?#]+)/i)?.[1]?.toLowerCase()
  const rawPath = value.match(/^https:\/\/[^/]+(\/.*)?$/i)?.[1] ?? ''
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || authority !== hostname || url.search || url.hash) return { failure: invalidFormat(platform) }
  if (hint !== undefined && hint !== platform) return { failure: invalidFormat(platform) }
  if (/\/{2,}/.test(rawPath) || /\/(?:\.{1,2})(?:\/|$)/.test(rawPath)) {
    return { failure: invalidFormat(platform) }
  }
  const segments = url.pathname.split('/').slice(1)
  if (segments.at(-1) === '') segments.pop()
  if (segments.some(segment => !SLUG.test(segment))) return { failure: invalidFormat(platform) }
  if (platform === 'gitlab') {
    if (segments.length < 2 || segments.length > 20 || segments.includes('-')) return { failure: invalidFormat(platform) }
    if (segments.join('/').length > 512) return { failure: invalidFormat(platform) }
  } else if (segments.length !== 2) return { failure: invalidFormat(platform) }
  const last = segments.length - 1
  if (segments[last].endsWith('.git')) segments[last] = segments[last].slice(0, -4)
  if (!SLUG.test(segments[last]) || segments[last] === '.' || segments[last] === '..') {
    return { failure: invalidFormat(platform) }
  }
  return { repository: { platform, segments, identity: `${platform}:${segments.join('/')}` } }
}

async function cacheKey(identity: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `git-repository:v2:${hex}`
}
function validCached(value: unknown, platform: Platform): value is RepositoryInfo {
  if (!record(value) || value.success !== true || value.platform !== platform || !record(value.repository)) return false
  return typeof value.repository.name === 'string'
    && typeof value.repository.fullName === 'string'
    && typeof value.repository.owner === 'string'
}
async function cacheRead(cache: KVNamespace | undefined, key: string, platform: Platform): Promise<RepositoryInfo | null> {
  if (!cache) return null
  try {
    const value = await cache.get(key)
    if (value) {
      const parsed: unknown = JSON.parse(value)
      if (validCached(parsed, platform)) return parsed
    }
  } catch { console.warn('[GitRepoExtract] cache read failed') }
  return null
}
async function cacheWrite(cache: KVNamespace | undefined, key: string, result: RepositoryInfo): Promise<void> {
  if (!cache || !result.success) return
  try { await cache.put(key, JSON.stringify(result), { expirationTtl: 3600 }) }
  catch { console.warn('[GitRepoExtract] cache write failed') }
}

function githubHeaders(env: Env): Record<string, string | undefined> {
  return {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ResearchTools-ContentIntelligence',
    Authorization: env.GITHUB_TOKEN ? `token ${env.GITHUB_TOKEN}` : undefined,
  }
}
function json<T>(origin: string, path: readonly string[], options: {
  bytes: number
  query?: Readonly<Record<string, string | number | boolean | undefined>>
  headers?: Readonly<Record<string, string | undefined>>
}) {
  return fetchFixedProviderJson<T>(origin, path, {
    timeoutMs: TIMEOUT_MS,
    maxResponseBytes: options.bytes,
    searchParams: options.query,
    credentialHeaders: options.headers,
  })
}
function preview(content: string) { return { content: content.substring(0, 5000), truncated: content.length > 5000 } }
function validProviderRef(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255
    && value !== '.' && value !== '..'
    && ![...value].some(character => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 31 || codePoint === 127
    })
}
function decodeBase64Readme(value: unknown) {
  if (!record(value) || value.encoding !== 'base64' || typeof value.content !== 'string') return undefined
  const encoded = value.content.replace(/[\t\n\r ]/g, '')
  if (encoded.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return undefined
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const byteLength = encoded.length === 0 ? 0 : encoded.length / 4 * 3 - padding
  if (byteLength > DECODED_README_BYTES) return undefined
  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return preview(new TextDecoder().decode(bytes))
  } catch { return undefined }
}
async function rawReadme(origin: string, path: readonly string[], query?: Readonly<Record<string, string>>) {
  try {
    const result = await fetchFixedProviderBytes(origin, path, {
      timeoutMs: TIMEOUT_MS,
      maxResponseBytes: RAW_README_BYTES,
      allowedContentTypes: RAW_README_TYPES,
      searchParams: query,
    })
    return result.response.ok ? preview(new TextDecoder().decode(result.bytes)) : undefined
  } catch { return undefined }
}

function commitFields(commits: ParsedCommit[]) {
  const recentCommits = commits.map(({ sha, message, author, date }) => ({ sha, message, author, date }))
  return commits.length ? { recentCommits, latestCommit: commits[0] } : { recentCommits }
}
function githubCommits(value: unknown): ParsedCommit[] | undefined {
  if (!Array.isArray(value)) return undefined
  const parsed: ParsedCommit[] = []
  for (const item of value) {
    if (!record(item)) return undefined
    const commit = child(item, 'commit'); const authorData = commit && child(commit, 'author')
    const sha = req(item, 'sha'); const message = commit && req(commit, 'message')
    const author = authorData && req(authorData, 'name'); const date = authorData && req(authorData, 'date')
    const url = req(item, 'html_url')
    if (!sha || !message || !author || !date || !url) return undefined
    parsed.push({ sha: sha.substring(0, 7), message: message.split('\n')[0], author, date, url })
  }
  return parsed
}
function gitlabCommits(value: unknown): ParsedCommit[] | undefined {
  if (!Array.isArray(value)) return undefined
  const parsed: ParsedCommit[] = []
  for (const item of value) {
    if (!record(item)) return undefined
    const sha = req(item, 'short_id'); const message = req(item, 'title'); const author = req(item, 'author_name')
    const date = req(item, 'created_at'); const url = req(item, 'web_url')
    if (!sha || !message || !author || !date || !url) return undefined
    parsed.push({ sha, message, author, date, url })
  }
  return parsed
}
function bitbucketCommits(value: unknown): ParsedCommit[] | undefined {
  if (!record(value) || !Array.isArray(value.values)) return undefined
  const parsed: ParsedCommit[] = []
  for (const item of value.values) {
    if (!record(item)) return undefined
    const authorData = child(item, 'author'); const user = authorData && child(authorData, 'user')
    const links = child(item, 'links'); const html = links && child(links, 'html')
    const sha = req(item, 'hash'); const message = req(item, 'message')
    const author = (user && req(user, 'display_name')) || (authorData && req(authorData, 'raw'))
    const date = req(item, 'date'); const url = html && req(html, 'href')
    if (!sha || !message || !author || !date || !url) return undefined
    parsed.push({ sha: sha.substring(0, 7), message: message.split('\n')[0], author, date, url })
  }
  return parsed
}

async function extractGitHub(repository: CanonicalRepository, env: Env): Promise<RepositoryInfo> {
  const [owner, repo] = repository.segments; const headers = githubHeaders(env)
  try {
    const primary = await json<RecordValue>(ORIGINS.github, ['repos', owner, repo], { bytes: PRIMARY_BYTES, headers })
    if (!primary.response.ok) {
      if (primary.response.status === 404) return { success: false, platform: 'github', error: 'Repository not found. It may be private or the URL is incorrect.' }
      if (primary.response.status === 403) return { success: false, platform: 'github', error: 'GitHub API rate limit exceeded. Try again later.' }
      throw new Error('primary failed')
    }
    const data = primary.data
    if (!record(data)) throw new Error('invalid primary')
    if (data.private !== false || data.visibility !== 'public') {
      return { success: false, platform: 'github', error: 'Repository not found. It may be private or the URL is incorrect.' }
    }
    const name = req(data, 'name'); const fullName = req(data, 'full_name'); const ownerData = child(data, 'owner')
    const ownerName = ownerData && req(ownerData, 'login')
    if (!name || !fullName || !ownerName) throw new Error('invalid primary')

    const calls = await Promise.allSettled([
      json<RecordValue>(ORIGINS.github, ['repos', owner, repo, 'readme'], { bytes: README_JSON_BYTES, headers }),
      json<Record<string, number>>(ORIGINS.github, ['repos', owner, repo, 'languages'], { bytes: 256 * 1024, headers }),
      json<unknown[]>(ORIGINS.github, ['repos', owner, repo, 'commits'], { bytes: OPTIONAL_BYTES, query: { per_page: 5 }, headers }),
      json<RecordValue>(ORIGINS.github, ['repos', owner, repo, 'releases', 'latest'], { bytes: OPTIONAL_BYTES, headers }),
      json<unknown[]>(ORIGINS.github, ['repos', owner, repo, 'contributors'], { bytes: 256 * 1024, query: { per_page: 1 }, headers }),
    ])
    const license = child(data, 'license')
    const result: RepositoryInfo = { success: true, platform: 'github', repository: {
      name, fullName, owner: ownerName, description: nullable(data, 'description'), homepage: nullable(data, 'homepage'),
      language: nullable(data, 'language'), stars: num(data, 'stargazers_count'), forks: num(data, 'forks_count'),
      watchers: num(data, 'watchers_count'), openIssues: num(data, 'open_issues_count'), license: license ? str(license, 'name') : undefined,
      topics: strings(data, 'topics'), createdAt: str(data, 'created_at'), updatedAt: str(data, 'updated_at'), pushedAt: str(data, 'pushed_at'),
      size: num(data, 'size'), defaultBranch: str(data, 'default_branch'), isArchived: bool(data, 'archived'), isFork: bool(data, 'fork'),
    } }
    const [readmeCall, languageCall, commitCall, releaseCall, contributorCall] = calls
    if (readmeCall.status === 'fulfilled' && readmeCall.value.response.ok) result.readme = decodeBase64Readme(readmeCall.value.data)
    if (languageCall.status === 'fulfilled' && languageCall.value.response.ok && record(languageCall.value.data)) {
      const entries = Object.entries(languageCall.value.data)
      if (entries.every(([, value]) => typeof value === 'number' && Number.isFinite(value))) result.repository!.languages = Object.fromEntries(entries) as Record<string, number>
    }
    if (commitCall.status === 'fulfilled' && commitCall.value.response.ok) {
      const commits = githubCommits(commitCall.value.data); if (commits) Object.assign(result, commitFields(commits))
    }
    if (releaseCall.status === 'fulfilled' && releaseCall.value.response.ok && record(releaseCall.value.data)) {
      const release = releaseCall.value.data; const tag = req(release, 'tag_name'); const publishedAt = req(release, 'published_at'); const url = req(release, 'html_url')
      if (tag && publishedAt && url) result.latestRelease = { name: str(release, 'name') || tag, tag, publishedAt, url, description: nullable(release, 'body') }
    }
    if (contributorCall.status === 'fulfilled' && contributorCall.value.response.ok) {
      const match = contributorCall.value.response.headers.get('Link')?.match(/page=(\d+)>; rel="last"/)
      result.contributors = match ? Number.parseInt(match[1], 10) : 1
    }
    return result
  } catch { console.error('[GitRepoExtract] GitHub provider request failed'); return { success: false, platform: 'github', error: 'GitHub extraction failed' } }
}

async function extractGitLab(repository: CanonicalRepository): Promise<RepositoryInfo> {
  const project = repository.segments.join('/'); const base = ['api', 'v4', 'projects', project] as const
  try {
    const primary = await json<RecordValue>(ORIGINS.gitlab, base, { bytes: PRIMARY_BYTES })
    if (!primary.response.ok) {
      if (primary.response.status === 404) return { success: false, platform: 'gitlab', error: 'GitLab project not found or is private.' }
      throw new Error('primary failed')
    }
    const data = primary.data; if (!record(data)) throw new Error('invalid primary')
    const name = req(data, 'name'); const fullName = req(data, 'path_with_namespace'); const namespace = child(data, 'namespace'); const owner = namespace && req(namespace, 'name')
    if (!name || !fullName || !owner) throw new Error('invalid primary')
    const branch = str(data, 'default_branch')
    const calls = await Promise.allSettled([
      branch ? rawReadme(ORIGINS.gitlab, [...base, 'repository', 'files', 'README.md', 'raw'], { ref: branch }) : Promise.resolve(undefined),
      json<unknown[]>(ORIGINS.gitlab, [...base, 'repository', 'commits'], { bytes: OPTIONAL_BYTES, query: { per_page: 5 } }),
      json<unknown[]>(ORIGINS.gitlab, [...base, 'releases'], { bytes: OPTIONAL_BYTES, query: { per_page: 1 } }),
    ])
    const result: RepositoryInfo = { success: true, platform: 'gitlab', repository: {
      name, fullName, owner, description: nullable(data, 'description'), homepage: nullable(data, 'web_url'), language: null,
      stars: num(data, 'star_count'), forks: num(data, 'forks_count'), openIssues: num(data, 'open_issues_count'),
      topics: strings(data, 'topics') || strings(data, 'tag_list'), createdAt: str(data, 'created_at'), updatedAt: str(data, 'last_activity_at'),
      defaultBranch: branch, isArchived: bool(data, 'archived'), isFork: data.forked_from_project !== undefined,
    } }
    if (calls[0].status === 'fulfilled' && calls[0].value) result.readme = calls[0].value
    if (calls[1].status === 'fulfilled' && calls[1].value.response.ok) { const commits = gitlabCommits(calls[1].value.data); if (commits) Object.assign(result, commitFields(commits)) }
    if (calls[2].status === 'fulfilled' && calls[2].value.response.ok && Array.isArray(calls[2].value.data) && record(calls[2].value.data[0])) {
      const release = calls[2].value.data[0]; const links = child(release, '_links'); const releaseName = req(release, 'name'); const tag = req(release, 'tag_name'); const publishedAt = req(release, 'released_at'); const url = links && req(links, 'self')
      if (releaseName && tag && publishedAt && url) result.latestRelease = { name: releaseName, tag, publishedAt, url }
    }
    return result
  } catch { console.error('[GitRepoExtract] GitLab provider request failed'); return { success: false, platform: 'gitlab', error: 'GitLab extraction failed' } }
}

async function extractBitbucket(repository: CanonicalRepository): Promise<RepositoryInfo> {
  const [workspace, repo] = repository.segments; const base = ['2.0', 'repositories', workspace, repo] as const
  try {
    const primary = await json<RecordValue>(ORIGINS.bitbucket, base, { bytes: PRIMARY_BYTES })
    if (!primary.response.ok) {
      if (primary.response.status === 404) return { success: false, platform: 'bitbucket', error: 'Bitbucket repository not found or is private.' }
      throw new Error('primary failed')
    }
    const data = primary.data; if (!record(data)) throw new Error('invalid primary')
    const name = req(data, 'name'); const fullName = req(data, 'full_name'); const ownerData = child(data, 'owner'); const owner = ownerData && req(ownerData, 'display_name')
    if (!name || !fullName || !owner) throw new Error('invalid primary')
    const mainbranch = child(data, 'mainbranch')
    const providerBranch = mainbranch ? str(mainbranch, 'name') : undefined
    const branch = mainbranch ? (validProviderRef(providerBranch) ? providerBranch : undefined) : 'master'
    const calls = await Promise.allSettled([
      branch ? rawReadme(ORIGINS.bitbucket, [...base, 'src', branch, 'README.md']) : Promise.resolve(undefined),
      json<RecordValue>(ORIGINS.bitbucket, [...base, 'commits'], { bytes: OPTIONAL_BYTES, query: { pagelen: 5 } }),
    ])
    const result: RepositoryInfo = { success: true, platform: 'bitbucket', repository: {
      name, fullName, owner, description: nullable(data, 'description'), homepage: nullable(data, 'website'), language: nullable(data, 'language'),
      size: num(data, 'size'), createdAt: str(data, 'created_on'), updatedAt: str(data, 'updated_on'),
      defaultBranch: validProviderRef(providerBranch) ? providerBranch : undefined,
      isFork: data.parent !== undefined,
    } }
    if (calls[0].status === 'fulfilled' && calls[0].value) result.readme = calls[0].value
    if (calls[1].status === 'fulfilled' && calls[1].value.response.ok) { const commits = bitbucketCommits(calls[1].value.data); if (commits) Object.assign(result, commitFields(commits)) }
    return result
  } catch { console.error('[GitRepoExtract] Bitbucket provider request failed'); return { success: false, platform: 'bitbucket', error: 'Bitbucket extraction failed' } }
}

async function extract(repository: CanonicalRepository, env: Env) {
  if (repository.platform === 'github') return extractGitHub(repository, env)
  if (repository.platform === 'gitlab') return extractGitLab(repository)
  return extractBitbucket(repository)
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
    const body = await request.json() as { url?: unknown; platform?: unknown }
    if (!body.url) return new Response(JSON.stringify({ success: false, error: 'URL is required' }), { status: 400, headers: JSON_HEADERS })
    if (typeof body.url !== 'string') return new Response(JSON.stringify(invalidPlatform().body), { status: 400, headers: JSON_HEADERS })
    const parsed = parseRepositoryUrl(body.url, body.platform)
    if ('failure' in parsed) return new Response(JSON.stringify(parsed.failure.body), { status: parsed.failure.status, headers: JSON_HEADERS })
    const key = await cacheKey(parsed.repository.identity)
    const cached = await cacheRead(env.CACHE, key, parsed.repository.platform)
    if (cached) return new Response(JSON.stringify(cached), { status: 200, headers: JSON_HEADERS })
    const result = await extract(parsed.repository, env)
    await cacheWrite(env.CACHE, key, result)
    return new Response(JSON.stringify(result), { status: result.success ? 200 : 422, headers: JSON_HEADERS })
  } catch { console.error('[GitRepoExtract] request failed'); return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), { status: 500, headers: JSON_HEADERS }) }
}

export const onRequestGet: PagesFunction = async () => new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), { status: 405, headers: JSON_HEADERS })
