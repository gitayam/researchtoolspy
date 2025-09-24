// Shared TypeScript types for Cloudflare Workers

// Environment bindings
export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespaces
  SESSIONS: KVNamespace;
  RATE_LIMITS: KVNamespace;
  CACHE: KVNamespace;
  ANONYMOUS_SESSIONS: KVNamespace;

  // R2 Buckets
  DOCUMENTS?: R2Bucket;
  EXPORTS?: R2Bucket;
  ASSETS?: R2Bucket;

  // Queues
  DOCUMENT_QUEUE?: Queue;
  REPORT_QUEUE?: Queue;
  EMAIL_QUEUE?: Queue;

  // Environment Variables
  JWT_SECRET: string;
  OPENAI_API_KEY?: string;
  ENVIRONMENT?: 'production' | 'staging' | 'development';

  // Service bindings (for worker-to-worker communication)
  AUTH_SERVICE?: Fetcher;
  FRAMEWORK_SERVICE?: Fetcher;
  SWOT_SERVICE?: Fetcher;
  ACH_SERVICE?: Fetcher;
  BEHAVIORAL_SERVICE?: Fetcher;
  DECEPTION_SERVICE?: Fetcher;
  DOTMLPF_SERVICE?: Fetcher;
  PMESII_SERVICE?: Fetcher;
  DIME_SERVICE?: Fetcher;
  PEST_SERVICE?: Fetcher;
  VRIO_SERVICE?: Fetcher;
  STAKEHOLDER_SERVICE?: Fetcher;
  TREND_SERVICE?: Fetcher;
  SURVEILLANCE_SERVICE?: Fetcher;
  CAUSEWAY_SERVICE?: Fetcher;
  COG_SERVICE?: Fetcher;
  STARBURSTING_SERVICE?: Fetcher;
  FLOW_SERVICE?: Fetcher;
  TOOLS_SERVICE?: Fetcher;
  AI_SERVICE?: Fetcher;
  EXPORT_SERVICE?: Fetcher;
  ANALYTICS_SERVICE?: Fetcher;
  USERS_SERVICE?: Fetcher;
}

// User types
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  hashed_password?: string;
  account_hash?: string;
  is_active: boolean;
  is_verified: boolean;
  role: UserRole;
  organization?: string;
  department?: string;
  bio?: string;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'admin' | 'analyst' | 'researcher' | 'viewer';

// Authentication types
export interface JWTPayload {
  sub: string; // user ID
  email: string;
  username: string;
  role: UserRole;
  exp: number;
  iat: number;
  jti?: string; // JWT ID for revocation
  type?: string; // For refresh tokens
}

export interface AuthSession {
  userId: number;
  username: string;
  email: string;
  role: UserRole;
  token: string;
  refreshToken?: string;
  expiresAt: number;
  createdAt: number;
}

export interface AnonymousSession {
  sessionHash: string;
  createdAt: number;
  lastAccessedAt: number;
  data: Record<string, any>;
}

// Framework types
export type FrameworkType =
  | 'swot'
  | 'cog'
  | 'pmesii_pt'
  | 'dotmlpf'
  | 'ach'
  | 'deception_detection'
  | 'behavioral_analysis'
  | 'starbursting'
  | 'causeway'
  | 'dime'
  | 'pest'
  | 'vrio'
  | 'stakeholder'
  | 'trend'
  | 'surveillance'
  | 'fundamental_flow';

export type FrameworkStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

export interface FrameworkSession {
  id: number;
  title: string;
  description?: string;
  framework_type: FrameworkType;
  status: FrameworkStatus;
  user_id: number;
  data: string; // JSON string
  config?: string; // JSON string
  tags?: string; // JSON string
  version: number;
  ai_suggestions?: string; // JSON string
  ai_analysis_count: number;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    timestamp: number;
    requestId: string;
    processingTime?: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Request types
export interface AuthRequest extends Request {
  user?: User;
  session?: AuthSession;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Rate limiting
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface RateLimitInfo {
  remaining: number;
  reset: number;
  total: number;
}

// Cache types
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  key: string;
  tags?: string[];
}

// Document processing
export interface DocumentExport {
  format: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'json';
  sessionId: number;
  userId: number;
  options?: {
    includeAnalysis?: boolean;
    includeCharts?: boolean;
    includeMetadata?: boolean;
    template?: string;
  };
}

// Research job types
export type ResearchJobType =
  | 'url_processing'
  | 'web_scraping'
  | 'document_processing'
  | 'social_media_analysis'
  | 'osint_collection'
  | 'data_conversion';

export type ResearchJobStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ResearchJob {
  id: number;
  job_type: ResearchJobType;
  job_name?: string;
  status: ResearchJobStatus;
  input_data?: Record<string, any>;
  result_data?: Record<string, any>;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  progress_percentage: number;
  current_step?: string;
  started_at?: string;
  completed_at?: string;
  estimated_completion?: string;
  user_id: number;
  related_urls?: number[];
  related_citations?: number[];
  created_at: string;
  updated_at: string;
}

// Citation types
export interface Citation {
  id: number;
  title: string;
  authors?: string[];
  publication_date?: string;
  source_type: string;
  source_name?: string;
  url?: string;
  doi?: string;
  isbn?: string;
  pmid?: string;
  apa_citation?: string;
  mla_citation?: string;
  chicago_citation?: string;
  bibtex_citation?: string;
  citation_data?: Record<string, any>;
  tags?: string[];
  notes?: string;
  reliability_rating?: number;
  relevance_rating?: number;
  user_id: number;
  processed_url_id?: number;
  created_at: string;
  updated_at: string;
}

// URL processing types
export interface ProcessedUrl {
  id: number;
  url: string;
  url_hash: string;
  title?: string;
  description?: string;
  author?: string;
  domain: string;
  content_type?: string;
  language?: string;
  word_count?: number;
  status_code?: number;
  response_time?: number;
  archived_url?: string;
  wayback_url?: string;
  additional_metadata?: Record<string, any>;
  reliability_score?: number;
  domain_reputation?: 'trusted' | 'neutral' | 'suspicious' | 'malicious';
  processing_status: string;
  error_message?: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

// Error types
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends APIError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends APIError {
  constructor(retryAfter: number) {
    super(429, 'Too many requests', 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncFunction<T = void> = () => Promise<T>;

// Database query builder types
export interface QueryOptions {
  where?: Record<string, any>;
  orderBy?: {
    column: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  offset?: number;
  include?: string[];
}

// Worker context extensions
export interface WorkerContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  requestId: string;
  startTime: number;
}