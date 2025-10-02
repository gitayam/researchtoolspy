// URL Processing Types

export interface URLAnalysisRequest {
  url: string
  checkWayback?: boolean
  checkSEO?: boolean
  checkSecurity?: boolean
}

export interface URLMetadata {
  title?: string
  description?: string
  author?: string
  publishDate?: string
  type?: string
  image?: string
  siteName?: string
}

export interface DomainInfo {
  name: string
  protocol: string
  path: string
  registrationDate?: string
  age?: number
  ssl: boolean
  sslExpiry?: string
  ipAddress?: string
  location?: string
}

export interface URLStatus {
  code: number
  ok: boolean
  responseTime: number
  redirects: string[]
  finalUrl: string
  error?: string
}

export interface WaybackSnapshot {
  date: string
  timestamp: string
  url: string
}

export interface WaybackInfo {
  isArchived: boolean
  firstSnapshot?: string
  lastSnapshot?: string
  totalSnapshots?: number
  archiveUrl?: string
  recentSnapshots?: WaybackSnapshot[]
}

export interface ReliabilityBreakdown {
  ssl: number
  domainAge: number
  contentQuality: number
  archiveHistory: number
  responseTime: number
  metadata: number
  security: number
}

export interface ReliabilityScore {
  score: number
  breakdown: ReliabilityBreakdown
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Unknown'
  notes: string[]
}

export interface SEOData {
  metaTags: Record<string, string>
  openGraph: Record<string, string>
  twitterCard: Record<string, string>
  structuredData?: any
}

export interface URLAnalysisResult {
  url: string
  normalizedUrl: string
  metadata: URLMetadata
  domain: DomainInfo
  status: URLStatus
  wayback?: WaybackInfo
  reliability: ReliabilityScore
  seo?: SEOData
  analyzedAt: string
}
