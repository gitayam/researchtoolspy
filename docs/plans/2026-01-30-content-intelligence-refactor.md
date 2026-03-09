# ContentIntelligencePage Refactor - Stability, Performance & Usefulness

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the 5,570-line monolithic ContentIntelligencePage into a stable, performant, and analyst-friendly component architecture.

**Architecture:** Extract custom hooks for state management (leveraging existing Zustand), create focused sub-components, centralize API calls with React Query (already installed), and implement proper memoization.

**Tech Stack:** React 19, Zustand (existing), React Query (existing), TypeScript

---

## Executive Summary

The ContentIntelligencePage has **critical architectural issues**:
- **31 useState hooks** causing state chaos and re-render cascades
- **5,570 lines** in a single component (should be ~300-500)
- **25+ API endpoints** with inconsistent error handling
- **Zero memoization** causing performance degradation
- **38 try-catch blocks** with different error patterns

This plan prioritizes **stability first**, then **performance**, then **usefulness** improvements.

---

## Phase 1: Foundation - Custom Hooks & State Consolidation (Priority: CRITICAL)

### Task 1: Create useAnalysisState Hook

**Files:**
- Create: `src/hooks/content-intelligence/useAnalysisState.ts`
- Create: `src/hooks/content-intelligence/types.ts`

**Step 1: Create types file**

```typescript
// src/hooks/content-intelligence/types.ts
import type { ContentAnalysis, ProcessingStatus, SavedLink, QuestionAnswer } from '@/types/content-intelligence'

export interface AnalysisUIState {
  activeTab: AnalysisTab
  textView: 'summary' | 'fulltext'
  wordCloudView: 'words' | 'phrases' | 'entities'
  linkFilter: 'all' | 'external' | 'internal'
  linkSort: 'references' | 'chronological'
  highlightedEntity: string | null
}

export interface AnalysisProcessingState {
  processing: boolean
  status: ProcessingStatus
  progress: number
  currentStep: string
}

export interface AnalysisDataState {
  url: string
  mode: 'quick' | 'normal' | 'full'
  analysis: ContentAnalysis | null
  bypassUrls: Record<string, string>
}

export type AnalysisTab =
  | 'overview' | 'entities' | 'sentiment' | 'links'
  | 'word-analysis' | 'claims' | 'dime' | 'starbursting' | 'qa'
```

**Step 2: Create the hook**

```typescript
// src/hooks/content-intelligence/useAnalysisState.ts
import { create } from 'zustand'
import type { AnalysisUIState, AnalysisProcessingState, AnalysisDataState } from './types'

interface AnalysisStore extends AnalysisUIState, AnalysisProcessingState, AnalysisDataState {
  // UI Actions
  setActiveTab: (tab: AnalysisTab) => void
  setTextView: (view: 'summary' | 'fulltext') => void
  setWordCloudView: (view: 'words' | 'phrases' | 'entities') => void
  setLinkFilter: (filter: 'all' | 'external' | 'internal') => void
  setLinkSort: (sort: 'references' | 'chronological') => void
  setHighlightedEntity: (entity: string | null) => void

  // Processing Actions
  startProcessing: () => void
  updateProgress: (progress: number, step: string) => void
  setStatus: (status: ProcessingStatus) => void
  finishProcessing: () => void

  // Data Actions
  setUrl: (url: string) => void
  setMode: (mode: 'quick' | 'normal' | 'full') => void
  setAnalysis: (analysis: ContentAnalysis | null) => void
  setBypassUrls: (urls: Record<string, string>) => void

  // Reset
  reset: () => void
}

const initialState = {
  // UI State
  activeTab: 'overview' as AnalysisTab,
  textView: 'summary' as const,
  wordCloudView: 'words' as const,
  linkFilter: 'all' as const,
  linkSort: 'references' as const,
  highlightedEntity: null,

  // Processing State
  processing: false,
  status: 'idle' as ProcessingStatus,
  progress: 0,
  currentStep: '',

  // Data State
  url: '',
  mode: 'normal' as const,
  analysis: null,
  bypassUrls: {},
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  ...initialState,

  // UI Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTextView: (view) => set({ textView: view }),
  setWordCloudView: (view) => set({ wordCloudView: view }),
  setLinkFilter: (filter) => set({ linkFilter: filter }),
  setLinkSort: (sort) => set({ linkSort: sort }),
  setHighlightedEntity: (entity) => set({ highlightedEntity: entity }),

  // Processing Actions
  startProcessing: () => set({ processing: true, status: 'processing', progress: 0, currentStep: '' }),
  updateProgress: (progress, step) => set({ progress, currentStep: step }),
  setStatus: (status) => set({ status }),
  finishProcessing: () => set({ processing: false, status: 'complete' }),

  // Data Actions
  setUrl: (url) => set({ url }),
  setMode: (mode) => set({ mode }),
  setAnalysis: (analysis) => set({ analysis }),
  setBypassUrls: (urls) => set({ bypassUrls: urls }),

  // Reset
  reset: () => set(initialState),
}))

// Selector hooks for performance (prevent unnecessary re-renders)
export const useAnalysisUI = () => useAnalysisStore((state) => ({
  activeTab: state.activeTab,
  textView: state.textView,
  wordCloudView: state.wordCloudView,
  linkFilter: state.linkFilter,
  linkSort: state.linkSort,
  highlightedEntity: state.highlightedEntity,
}))

export const useAnalysisProcessing = () => useAnalysisStore((state) => ({
  processing: state.processing,
  status: state.status,
  progress: state.progress,
  currentStep: state.currentStep,
}))

export const useAnalysisData = () => useAnalysisStore((state) => ({
  url: state.url,
  mode: state.mode,
  analysis: state.analysis,
  bypassUrls: state.bypassUrls,
}))
```

**Step 3: Verify file created**

Run: `ls -la src/hooks/content-intelligence/`

**Step 4: Commit**

```bash
git add src/hooks/content-intelligence/
git commit -m "feat(content-intel): add Zustand store for analysis state

- Create useAnalysisState hook with Zustand
- Consolidate 15 UI/processing/data states into single store
- Add selector hooks to prevent unnecessary re-renders"
```

---

### Task 2: Create useContentIntelligenceAPI Hook with React Query

**Files:**
- Create: `src/hooks/content-intelligence/useContentIntelligenceAPI.ts`
- Create: `src/lib/api/content-intelligence.ts`

**Step 1: Create API client module**

```typescript
// src/lib/api/content-intelligence.ts
import { createLogger } from '@/lib/logger'

const logger = createLogger('ContentIntelligenceAPI')

export class ContentIntelligenceAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message)
    this.name = 'ContentIntelligenceAPIError'
  }
}

function getAuthHeaders(): Record<string, string> {
  const userHash = localStorage.getItem('omnicore_user_hash')
  return userHash ? { 'Authorization': `Bearer ${userHash}` } : {}
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ContentIntelligenceAPIError(
      errorData.error || `Request failed with status ${response.status}`,
      response.status,
      errorData.code
    )
  }
  return response.json()
}

export const contentIntelligenceAPI = {
  async analyzeUrl(url: string, mode: 'quick' | 'normal' | 'full'): Promise<any> {
    logger.debug('Analyzing URL:', { url, mode })
    const response = await fetch('/api/content-intelligence/analyze-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url, mode }),
    })
    return handleResponse(response)
  },

  async runDIMEAnalysis(analysisId: string, content: string): Promise<any> {
    logger.debug('Running DIME analysis:', { analysisId })
    const response = await fetch('/api/content-intelligence/dime-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId, content }),
    })
    return handleResponse(response)
  },

  async runClaimsAnalysis(analysisId: string, content: string, title: string): Promise<any> {
    logger.debug('Running claims analysis:', { analysisId })
    const response = await fetch('/api/content-intelligence/extract-claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId, content, title }),
    })
    return handleResponse(response)
  },

  async getSavedLinks(): Promise<any[]> {
    logger.debug('Fetching saved links')
    const response = await fetch('/api/content-intelligence/saved-links', {
      headers: getAuthHeaders(),
    })
    return handleResponse(response)
  },

  async saveAnalysis(data: { url: string; analysis_id: string; note?: string; tags?: string[] }): Promise<any> {
    logger.debug('Saving analysis:', { analysisId: data.analysis_id })
    const response = await fetch('/api/content-intelligence/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    })
    return handleResponse(response)
  },

  async lookupCountry(url: string): Promise<any> {
    logger.debug('Looking up country for URL:', { url })
    const response = await fetch('/api/content-intelligence/country-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url }),
    })
    return handleResponse(response)
  },

  async askQuestion(analysisId: string, question: string, context: string): Promise<any> {
    logger.debug('Asking question:', { analysisId, question })
    const response = await fetch('/api/content-intelligence/ask-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId, question, context }),
    })
    return handleResponse(response)
  },

  async virusTotalLookup(url: string): Promise<any> {
    logger.debug('VirusTotal lookup:', { url })
    const response = await fetch('/api/content-intelligence/virustotal-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url }),
    })
    return handleResponse(response)
  },

  async extractSocialMedia(url: string): Promise<any> {
    logger.debug('Extracting social media:', { url })
    const response = await fetch('/api/content-intelligence/social-media-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url }),
    })
    return handleResponse(response)
  },

  async extractGitRepository(url: string): Promise<any> {
    logger.debug('Extracting git repository:', { url })
    const response = await fetch('/api/content-intelligence/git-repository-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url }),
    })
    return handleResponse(response)
  },

  async startStarbursting(analysisId: string): Promise<any> {
    logger.debug('Starting starbursting:', { analysisId })
    const response = await fetch('/api/content-intelligence/starbursting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId }),
    })
    return handleResponse(response)
  },

  async getStarburstingStatus(sessionId: string): Promise<any> {
    logger.debug('Getting starbursting status:', { sessionId })
    const response = await fetch(`/api/content-intelligence/starbursting/${sessionId}/status`, {
      headers: getAuthHeaders(),
    })
    return handleResponse(response)
  },

  async generateMoreQuestions(sessionId: string): Promise<any> {
    logger.debug('Generating more questions:', { sessionId })
    const response = await fetch(`/api/content-intelligence/starbursting/${sessionId}/generate-questions`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    return handleResponse(response)
  },

  async summarizeEntity(entity: string, entityType: string, context: string): Promise<any> {
    logger.debug('Summarizing entity:', { entity, entityType })
    const response = await fetch('/api/content-intelligence/summarize-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ entity, entity_type: entityType, context }),
    })
    return handleResponse(response)
  },

  async shareAnalysis(analysisId: string): Promise<any> {
    logger.debug('Sharing analysis:', { analysisId })
    const response = await fetch('/api/content-intelligence/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId }),
    })
    return handleResponse(response)
  },
}
```

**Step 2: Create React Query hooks**

```typescript
// src/hooks/content-intelligence/useContentIntelligenceAPI.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { contentIntelligenceAPI, ContentIntelligenceAPIError } from '@/lib/api/content-intelligence'
import { useToast } from '@/components/ui/use-toast'
import { useAnalysisStore } from './useAnalysisState'

// Query Keys
export const queryKeys = {
  savedLinks: ['content-intelligence', 'saved-links'] as const,
  analysis: (id: string) => ['content-intelligence', 'analysis', id] as const,
  starburstingStatus: (sessionId: string) => ['content-intelligence', 'starbursting', sessionId] as const,
}

// Hooks
export function useSavedLinks() {
  return useQuery({
    queryKey: queryKeys.savedLinks,
    queryFn: () => contentIntelligenceAPI.getSavedLinks(),
    staleTime: 30_000, // 30 seconds
  })
}

export function useAnalyzeUrl() {
  const { toast } = useToast()
  const { setAnalysis, startProcessing, updateProgress, finishProcessing, setStatus, setBypassUrls } = useAnalysisStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ url, mode }: { url: string; mode: 'quick' | 'normal' | 'full' }) =>
      contentIntelligenceAPI.analyzeUrl(url, mode),
    onMutate: () => {
      startProcessing()
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis)
      finishProcessing()
      queryClient.invalidateQueries({ queryKey: queryKeys.savedLinks })
    },
    onError: (error: ContentIntelligenceAPIError) => {
      setStatus('error')

      // Set bypass URLs for blocked sites
      if (error.message.includes('blocked')) {
        const encoded = encodeURIComponent(useAnalysisStore.getState().url)
        setBypassUrls({
          '12ft': `https://12ft.io/proxy?q=${encoded}`,
          'wayback': `https://web.archive.org/web/*/${useAnalysisStore.getState().url}`,
          'archive_is': `https://archive.is/${useAnalysisStore.getState().url}`
        })
      }

      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useDIMEAnalysis() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ analysisId, content }: { analysisId: string; content: string }) =>
      contentIntelligenceAPI.runDIMEAnalysis(analysisId, content),
    onError: (error: ContentIntelligenceAPIError) => {
      toast({
        title: 'DIME Analysis Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useClaimsAnalysis() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ analysisId, content, title }: { analysisId: string; content: string; title: string }) =>
      contentIntelligenceAPI.runClaimsAnalysis(analysisId, content, title),
    onError: (error: ContentIntelligenceAPIError) => {
      toast({
        title: 'Claims Analysis Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useSaveAnalysis() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { url: string; analysis_id: string; note?: string; tags?: string[] }) =>
      contentIntelligenceAPI.saveAnalysis(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedLinks })
      toast({
        title: 'Analysis Saved',
        description: 'Your analysis has been saved successfully.',
      })
    },
    onError: (error: ContentIntelligenceAPIError) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useCountryLookup() {
  return useMutation({
    mutationFn: (url: string) => contentIntelligenceAPI.lookupCountry(url),
  })
}

export function useVirusTotalLookup() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: (url: string) => contentIntelligenceAPI.virusTotalLookup(url),
    onError: (error: ContentIntelligenceAPIError) => {
      toast({
        title: 'VirusTotal Lookup Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useAskQuestion() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ analysisId, question, context }: { analysisId: string; question: string; context: string }) =>
      contentIntelligenceAPI.askQuestion(analysisId, question, context),
    onError: (error: ContentIntelligenceAPIError) => {
      toast({
        title: 'Question Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useSocialMediaExtract() {
  return useMutation({
    mutationFn: (url: string) => contentIntelligenceAPI.extractSocialMedia(url),
  })
}

export function useGitRepositoryExtract() {
  return useMutation({
    mutationFn: (url: string) => contentIntelligenceAPI.extractGitRepository(url),
  })
}

export function useStartStarbursting() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: (analysisId: string) => contentIntelligenceAPI.startStarbursting(analysisId),
    onError: (error: ContentIntelligenceAPIError) => {
      toast({
        title: 'Starbursting Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useStarburstingStatus(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.starburstingStatus(sessionId || ''),
    queryFn: () => contentIntelligenceAPI.getStarburstingStatus(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      // Poll every 2 seconds while processing
      const data = query.state.data
      return data?.status === 'processing' ? 2000 : false
    },
  })
}

export function useGenerateMoreQuestions() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sessionId: string) => contentIntelligenceAPI.generateMoreQuestions(sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.starburstingStatus(sessionId) })
    },
    onError: (error: ContentIntelligenceAPIError) => {
      toast({
        title: 'Generate Questions Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

export function useSummarizeEntity() {
  return useMutation({
    mutationFn: ({ entity, entityType, context }: { entity: string; entityType: string; context: string }) =>
      contentIntelligenceAPI.summarizeEntity(entity, entityType, context),
  })
}

export function useShareAnalysis() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: (analysisId: string) => contentIntelligenceAPI.shareAnalysis(analysisId),
    onSuccess: (data) => {
      toast({
        title: 'Share Link Created',
        description: 'Copy the link to share your analysis.',
      })
      return data.shareUrl
    },
    onError: (error: ContentIntelligenceAPIError) => {
      toast({
        title: 'Share Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}
```

**Step 3: Commit**

```bash
git add src/lib/api/content-intelligence.ts src/hooks/content-intelligence/useContentIntelligenceAPI.ts
git commit -m "feat(content-intel): add React Query hooks for API calls

- Create centralized API client with consistent error handling
- Add ContentIntelligenceAPIError for typed errors
- Create React Query mutations for all 15+ API endpoints
- Add automatic cache invalidation for saved links
- Add polling for starbursting status"
```

---

### Task 3: Create useClipboard Utility Hook

**Files:**
- Create: `src/hooks/useClipboard.ts`

**Step 1: Create the hook**

```typescript
// src/hooks/useClipboard.ts
import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface UseClipboardOptions {
  successMessage?: string
  errorMessage?: string
  timeout?: number
}

export function useClipboard(options: UseClipboardOptions = {}) {
  const {
    successMessage = 'Copied to clipboard',
    errorMessage = 'Failed to copy to clipboard',
    timeout = 2000,
  } = options

  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    // Try modern clipboard API first
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), timeout)
        toast({
          title: 'Copied',
          description: successMessage,
        })
        return true
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)

      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), timeout)
        toast({
          title: 'Copied',
          description: successMessage,
        })
        return true
      }
    } catch {
      // Fall through to error
    }

    toast({
      title: 'Copy Failed',
      description: errorMessage,
      variant: 'destructive',
    })
    return false
  }, [successMessage, errorMessage, timeout, toast])

  return { copied, copyToClipboard }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useClipboard.ts
git commit -m "feat: add useClipboard hook

- Unify clipboard logic into single reusable hook
- Support modern clipboard API with fallback
- Add success/error toast notifications
- Track copied state for UI feedback"
```

---

### Task 4: Create Index File for Hooks

**Files:**
- Create: `src/hooks/content-intelligence/index.ts`

**Step 1: Create index file**

```typescript
// src/hooks/content-intelligence/index.ts
export * from './types'
export * from './useAnalysisState'
export * from './useContentIntelligenceAPI'
```

**Step 2: Commit**

```bash
git add src/hooks/content-intelligence/index.ts
git commit -m "chore: add index file for content-intelligence hooks"
```

---

## Phase 2: Component Extraction (Priority: HIGH)

### Task 5: Extract AnalysisInputForm Component

**Files:**
- Create: `src/components/content-intelligence/AnalysisInputForm.tsx`
- Modify: `src/pages/tools/ContentIntelligencePage.tsx` (lines ~2364-2500)

**Step 1: Create the component**

```typescript
// src/components/content-intelligence/AnalysisInputForm.tsx
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Link2, Loader2, Search, Sparkles, ExternalLink,
  AlertCircle, GitBranch, Video
} from 'lucide-react'
import { useAnalysisStore } from '@/hooks/content-intelligence'
import { useAnalyzeUrl, useCountryLookup } from '@/hooks/content-intelligence'

interface AnalysisInputFormProps {
  onAnalysisComplete?: () => void
}

// URL detection patterns - memoized outside component
const URL_PATTERNS = {
  socialMedia: /^https?:\/\/(www\.)?(twitter|x|facebook|instagram|tiktok|youtube|linkedin)\./i,
  gitRepo: /^https?:\/\/(www\.)?(github|gitlab|bitbucket)\./i,
  video: /^https?:\/\/(www\.)?(youtube|vimeo|dailymotion|twitch)\./i,
}

export function AnalysisInputForm({ onAnalysisComplete }: AnalysisInputFormProps) {
  const { t } = useTranslation()
  const { url, mode, processing, status, progress, currentStep, bypassUrls, setUrl, setMode } = useAnalysisStore()
  const analyzeUrl = useAnalyzeUrl()
  const countryLookup = useCountryLookup()

  const [localUrl, setLocalUrl] = useState(url)

  // Detect URL type for badges
  const urlType = useMemo(() => {
    if (!localUrl) return null
    if (URL_PATTERNS.socialMedia.test(localUrl)) return 'social'
    if (URL_PATTERNS.gitRepo.test(localUrl)) return 'git'
    if (URL_PATTERNS.video.test(localUrl)) return 'video'
    return 'web'
  }, [localUrl])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!localUrl.trim()) return

    setUrl(localUrl)

    // Trigger country lookup in background
    countryLookup.mutate(localUrl)

    // Start analysis
    await analyzeUrl.mutateAsync({ url: localUrl, mode })
    onAnalysisComplete?.()
  }, [localUrl, mode, setUrl, countryLookup, analyzeUrl, onAnalysisComplete])

  const modeOptions = useMemo(() => [
    { value: 'quick', label: t('pages.contentIntelligence.modes.quick'), description: 'Fast extraction' },
    { value: 'normal', label: t('pages.contentIntelligence.modes.normal'), description: 'Balanced analysis' },
    { value: 'full', label: t('pages.contentIntelligence.modes.full'), description: 'Deep analysis' },
  ], [t])

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          {t('pages.contentIntelligence.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL Input */}
          <div className="relative">
            <Input
              type="url"
              placeholder={t('pages.contentIntelligence.urlPlaceholder')}
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              disabled={processing}
              className="pr-24"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              {urlType === 'social' && (
                <Badge variant="secondary" className="text-xs">
                  <Video className="h-3 w-3 mr-1" />
                  Social
                </Badge>
              )}
              {urlType === 'git' && (
                <Badge variant="secondary" className="text-xs">
                  <GitBranch className="h-3 w-3 mr-1" />
                  Git
                </Badge>
              )}
            </div>
          </div>

          {/* Mode Selection */}
          <div className="flex gap-2 flex-wrap">
            {modeOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={mode === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode(option.value as 'quick' | 'normal' | 'full')}
                disabled={processing}
                className="flex-1 min-w-[80px]"
              >
                {option.value === 'full' && <Sparkles className="h-3 w-3 mr-1" />}
                {option.label}
              </Button>
            ))}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={processing || !localUrl.trim()}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {currentStep || t('pages.contentIntelligence.analyzing')}
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                {t('pages.contentIntelligence.analyze')}
              </>
            )}
          </Button>

          {/* Progress Bar */}
          {processing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{currentStep}</p>
            </div>
          )}

          {/* Bypass URLs (shown on blocked sites) */}
          {status === 'error' && Object.keys(bypassUrls).length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">{t('pages.contentIntelligence.blocked')}</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(bypassUrls).map(([name, bypassUrl]) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={bypassUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {name}
                      </a>
                    </Button>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/content-intelligence/AnalysisInputForm.tsx
git commit -m "feat(content-intel): extract AnalysisInputForm component

- Encapsulate URL input, mode selection, and submit logic
- Add URL type detection badges (social, git, video)
- Use useCallback and useMemo for performance
- Integrate with Zustand store and React Query hooks"
```

---

### Task 6: Extract WordCloudSection Component

**Files:**
- Create: `src/components/content-intelligence/WordCloudSection.tsx`

**Step 1: Create the component**

```typescript
// src/components/content-intelligence/WordCloudSection.tsx
import { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { BarChart3, Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import { useAnalysisStore } from '@/hooks/content-intelligence'
import type { ContentAnalysis } from '@/types/content-intelligence'

interface WordCloudSectionProps {
  analysis: ContentAnalysis
}

// Color palette for word cloud
const WORD_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
]

export function WordCloudSection({ analysis }: WordCloudSectionProps) {
  const { t } = useTranslation()
  const { wordCloudView, setWordCloudView } = useAnalysisStore()

  // Memoize expensive word frequency calculations
  const wordData = useMemo(() => {
    const singleWords = Object.entries(analysis.word_frequency || {})
      .filter(([word]) => word.length > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)

    const maxCount = Math.max(...singleWords.map(([, count]) => count), 1)

    return {
      words: singleWords.map(([word, count], index) => ({
        word,
        count,
        size: 12 + (count / maxCount) * 24,
        color: WORD_COLORS[index % WORD_COLORS.length],
      })),
      maxCount,
    }
  }, [analysis.word_frequency])

  const phraseData = useMemo(() => {
    const phrases = Object.entries(analysis.key_phrases || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)

    const maxCount = Math.max(...phrases.map(([, count]) => count), 1)

    return {
      phrases: phrases.map(([phrase, count], index) => ({
        phrase,
        count,
        size: 10 + (count / maxCount) * 16,
        color: WORD_COLORS[index % WORD_COLORS.length],
      })),
      maxCount,
    }
  }, [analysis.key_phrases])

  const entityData = useMemo(() => {
    if (!analysis.entities) return { entities: [], maxCount: 1 }

    const entityCounts: Record<string, { count: number; type: string }> = {}
    for (const entity of analysis.entities) {
      if (entityCounts[entity.name]) {
        entityCounts[entity.name].count++
      } else {
        entityCounts[entity.name] = { count: 1, type: entity.type }
      }
    }

    const sorted = Object.entries(entityCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 25)

    const maxCount = Math.max(...sorted.map(([, data]) => data.count), 1)

    return {
      entities: sorted.map(([name, data], index) => ({
        name,
        count: data.count,
        type: data.type,
        size: 10 + (data.count / maxCount) * 18,
        color: WORD_COLORS[index % WORD_COLORS.length],
      })),
      maxCount,
    }
  }, [analysis.entities])

  const handleExport = useCallback(async () => {
    const element = document.getElementById('word-cloud-content')
    if (!element) return

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
    })

    const link = document.createElement('a')
    link.download = `word-cloud-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t('pages.contentIntelligence.sections.wordAnalysis.label')}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={wordCloudView} onValueChange={(v) => setWordCloudView(v as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="words">Words</TabsTrigger>
            <TabsTrigger value="phrases">Phrases</TabsTrigger>
            <TabsTrigger value="entities">Entities</TabsTrigger>
          </TabsList>

          <div id="word-cloud-content" className="p-4 bg-white rounded-lg">
            <TabsContent value="words" className="flex flex-wrap gap-2 justify-center">
              {wordData.words.map(({ word, count, size, color }) => (
                <Badge
                  key={word}
                  variant="secondary"
                  className={`${color} text-white cursor-default transition-transform hover:scale-110`}
                  style={{ fontSize: `${size}px`, padding: `${size / 4}px ${size / 2}px` }}
                >
                  {word}
                  <span className="ml-1 opacity-70">({count})</span>
                </Badge>
              ))}
            </TabsContent>

            <TabsContent value="phrases" className="flex flex-wrap gap-2 justify-center">
              {phraseData.phrases.map(({ phrase, count, size, color }) => (
                <Badge
                  key={phrase}
                  variant="secondary"
                  className={`${color} text-white cursor-default transition-transform hover:scale-110`}
                  style={{ fontSize: `${size}px`, padding: `${size / 4}px ${size / 2}px` }}
                >
                  {phrase}
                  <span className="ml-1 opacity-70">({count})</span>
                </Badge>
              ))}
            </TabsContent>

            <TabsContent value="entities" className="flex flex-wrap gap-2 justify-center">
              {entityData.entities.map(({ name, count, type, size, color }) => (
                <Badge
                  key={name}
                  variant="secondary"
                  className={`${color} text-white cursor-default transition-transform hover:scale-110`}
                  style={{ fontSize: `${size}px`, padding: `${size / 4}px ${size / 2}px` }}
                  title={type}
                >
                  {name}
                  <span className="ml-1 opacity-70">({count})</span>
                </Badge>
              ))}
            </TabsContent>
          </div>
        </Tabs>

        {/* Legend */}
        <div className="mt-4 text-xs text-muted-foreground text-center">
          {wordCloudView === 'words' && `Top ${wordData.words.length} words by frequency`}
          {wordCloudView === 'phrases' && `Top ${phraseData.phrases.length} key phrases`}
          {wordCloudView === 'entities' && `Top ${entityData.entities.length} named entities`}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/content-intelligence/WordCloudSection.tsx
git commit -m "feat(content-intel): extract WordCloudSection component

- Memoize expensive word frequency calculations
- Add export to PNG functionality
- Support words, phrases, and entities views
- Add hover effects and visual improvements"
```

---

### Task 7: Extract SharePanel Component

**Files:**
- Create: `src/components/content-intelligence/SharePanel.tsx`

**Step 1: Create the component**

```typescript
// src/components/content-intelligence/SharePanel.tsx
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Share2, Copy, Check, Mail, Send, ExternalLink, Loader2, MoreVertical } from 'lucide-react'
import { useClipboard } from '@/hooks/useClipboard'
import { useShareAnalysis } from '@/hooks/content-intelligence'
import type { ContentAnalysis } from '@/types/content-intelligence'

interface SharePanelProps {
  analysis: ContentAnalysis
}

export function SharePanel({ analysis }: SharePanelProps) {
  const { t } = useTranslation()
  const [showDialog, setShowDialog] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const { copied, copyToClipboard } = useClipboard()
  const shareAnalysis = useShareAnalysis()

  const handleShare = useCallback(async () => {
    if (shareUrl) {
      setShowDialog(true)
      return
    }

    const result = await shareAnalysis.mutateAsync(analysis.id)
    if (result?.shareUrl) {
      setShareUrl(result.shareUrl)
      setShowDialog(true)
    }
  }, [analysis.id, shareUrl, shareAnalysis])

  const handleCopyLink = useCallback(() => {
    if (shareUrl) {
      copyToClipboard(shareUrl)
    }
  }, [shareUrl, copyToClipboard])

  const handleCopySummary = useCallback(() => {
    const summary = `📊 Content Analysis: ${analysis.title || 'Untitled'}

🔗 Source: ${analysis.url}

📝 Summary:
${analysis.summary || 'No summary available'}

📈 Key Stats:
- Reading Time: ${analysis.reading_time || 'N/A'}
- Word Count: ${analysis.word_count || 'N/A'}
- Entities Found: ${analysis.entities?.length || 0}

${shareUrl ? `🔗 Full Analysis: ${shareUrl}` : ''}

Generated with Research Tools`

    copyToClipboard(summary)
  }, [analysis, shareUrl, copyToClipboard])

  const handleEmailShare = useCallback(() => {
    const subject = encodeURIComponent(`Analysis: ${analysis.title || 'Content Analysis'}`)
    const body = encodeURIComponent(`
I'd like to share this analysis with you:

${analysis.title || 'Content Analysis'}
${analysis.url}

${shareUrl ? `View full analysis: ${shareUrl}` : ''}
`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }, [analysis, shareUrl])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleShare} disabled={shareAnalysis.isPending}>
            {shareAnalysis.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Get Share Link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopySummary}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Summary
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleEmailShare}>
            <Mail className="h-4 w-4 mr-2" />
            Share via Email
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl || analysis.url)}&text=${encodeURIComponent(analysis.title || '')}`
              window.open(url, '_blank')
            }}
          >
            <Send className="h-4 w-4 mr-2" />
            Share via Telegram
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Analysis</DialogTitle>
            <DialogDescription>
              Copy this link to share the analysis with others.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={shareUrl || ''} readOnly className="font-mono text-sm" />
            <Button onClick={handleCopyLink} variant="secondary">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/content-intelligence/SharePanel.tsx
git commit -m "feat(content-intel): extract SharePanel component

- Add share link generation with caching
- Add copy summary functionality
- Add email and Telegram share options
- Use centralized useClipboard hook"
```

---

### Task 8: Extract QASection Component

**Files:**
- Create: `src/components/content-intelligence/QASection.tsx`

**Step 1: Create the component**

```typescript
// src/components/content-intelligence/QASection.tsx
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Send, Loader2, User, Bot, Copy, Check } from 'lucide-react'
import { useAskQuestion } from '@/hooks/content-intelligence'
import { useClipboard } from '@/hooks/useClipboard'
import type { ContentAnalysis, QuestionAnswer } from '@/types/content-intelligence'

interface QASectionProps {
  analysis: ContentAnalysis
}

export function QASection({ analysis }: QASectionProps) {
  const { t } = useTranslation()
  const [question, setQuestion] = useState('')
  const [qaHistory, setQaHistory] = useState<QuestionAnswer[]>([])
  const askQuestion = useAskQuestion()
  const { copied, copyToClipboard } = useClipboard()

  // Build context from analysis for Q&A
  const analysisContext = useMemo(() => {
    return `
Title: ${analysis.title || 'Unknown'}
URL: ${analysis.url}

Summary:
${analysis.summary || 'No summary available'}

Full Text:
${analysis.full_text?.slice(0, 8000) || 'No text available'}

Entities:
${analysis.entities?.map(e => `- ${e.name} (${e.type})`).join('\n') || 'None'}
`.trim()
  }, [analysis])

  const handleAskQuestion = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || askQuestion.isPending) return

    const userQuestion = question.trim()
    setQuestion('')

    // Add user question to history immediately
    const newQuestion: QuestionAnswer = {
      id: Date.now().toString(),
      question: userQuestion,
      answer: null,
      timestamp: new Date().toISOString(),
      loading: true,
    }
    setQaHistory(prev => [...prev, newQuestion])

    try {
      const result = await askQuestion.mutateAsync({
        analysisId: analysis.id,
        question: userQuestion,
        context: analysisContext,
      })

      // Update with answer
      setQaHistory(prev =>
        prev.map(qa =>
          qa.id === newQuestion.id
            ? { ...qa, answer: result.answer, loading: false }
            : qa
        )
      )
    } catch (error) {
      // Update with error
      setQaHistory(prev =>
        prev.map(qa =>
          qa.id === newQuestion.id
            ? { ...qa, answer: 'Sorry, I couldn\'t answer that question. Please try again.', loading: false, error: true }
            : qa
        )
      )
    }
  }, [question, askQuestion, analysis.id, analysisContext])

  const handleCopyConversation = useCallback(() => {
    const text = qaHistory
      .map(qa => `Q: ${qa.question}\nA: ${qa.answer || 'No answer'}`)
      .join('\n\n')
    copyToClipboard(text)
  }, [qaHistory, copyToClipboard])

  const suggestedQuestions = useMemo(() => [
    'What are the main arguments in this content?',
    'Who are the key people mentioned?',
    'What is the tone of this content?',
    'Are there any potential biases?',
    'What are the key facts presented?',
  ], [])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t('pages.contentIntelligence.sections.qa.label')}
        </CardTitle>
        {qaHistory.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleCopyConversation}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {/* Q&A History */}
        <ScrollArea className="flex-1 mb-4">
          {qaHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Ask questions about the analyzed content</p>

              {/* Suggested Questions */}
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium">Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.slice(0, 3).map((q, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setQuestion(q)}
                    >
                      {q}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {qaHistory.map((qa) => (
                <div key={qa.id} className="space-y-2">
                  {/* User Question */}
                  <div className="flex items-start gap-2">
                    <div className="bg-primary rounded-full p-1.5">
                      <User className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <div className="flex-1 bg-primary/10 rounded-lg p-3">
                      <p className="text-sm">{qa.question}</p>
                    </div>
                  </div>

                  {/* AI Answer */}
                  <div className="flex items-start gap-2">
                    <div className="bg-muted rounded-full p-1.5">
                      <Bot className="h-3 w-3" />
                    </div>
                    <div className={`flex-1 rounded-lg p-3 ${qa.error ? 'bg-destructive/10' : 'bg-muted'}`}>
                      {qa.loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{qa.answer}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Question Input */}
        <form onSubmit={handleAskQuestion} className="flex gap-2">
          <Input
            placeholder="Ask a question about this content..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={askQuestion.isPending}
          />
          <Button type="submit" disabled={!question.trim() || askQuestion.isPending}>
            {askQuestion.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/content-intelligence/QASection.tsx
git commit -m "feat(content-intel): extract QASection component

- Add Q&A interface with chat-like UI
- Add suggested questions for new users
- Add copy conversation functionality
- Show loading and error states properly"
```

---

### Task 9: Update Component Index

**Files:**
- Modify: `src/components/content-intelligence/index.ts` (create if not exists)

**Step 1: Create/update index**

```typescript
// src/components/content-intelligence/index.ts
export { ActorPicker } from './ActorPicker'
export { AnalysisLayout } from './AnalysisLayout'
export { AnalysisSidebar } from './AnalysisSidebar'
export { ClaimAnalysisDisplay } from './ClaimAnalysisDisplay'
export { ClaimEntityLinker } from './ClaimEntityLinker'
export { ClaimEvidenceLinker } from './ClaimEvidenceLinker'
export { StarburstingEntityLinker } from './StarburstingEntityLinker'

// New components
export { AnalysisInputForm } from './AnalysisInputForm'
export { WordCloudSection } from './WordCloudSection'
export { SharePanel } from './SharePanel'
export { QASection } from './QASection'
```

**Step 2: Commit**

```bash
git add src/components/content-intelligence/index.ts
git commit -m "chore: update content-intelligence component index"
```

---

## Phase 3: Performance Optimizations (Priority: MEDIUM)

### Task 10: Add Memoization to Sections Array

**Files:**
- Modify: `src/pages/tools/ContentIntelligencePage.tsx` (lines ~123-206)

**Step 1: Extract sections to useMemo**

Find this code pattern (around lines 123-206):
```typescript
const sections = analysis ? [
  { id: 'overview' as AnalysisTab, ... },
  ...
] : []
```

Replace with:
```typescript
// Add this import at top
import { useMemo } from 'react'

// Replace sections definition with memoized version
const sections = useMemo(() => {
  if (!analysis) return []

  return [
    {
      id: 'overview' as AnalysisTab,
      label: t('pages.contentIntelligence.sections.overview.label'),
      icon: FileText,
      description: t('pages.contentIntelligence.sections.overview.description'),
      isAutomatic: true,
      status: 'complete' as const,
    },
    {
      id: 'entities' as AnalysisTab,
      label: t('pages.contentIntelligence.sections.entities.label'),
      icon: Users,
      description: t('pages.contentIntelligence.sections.entities.description'),
      isAutomatic: true,
      status: 'complete' as const,
    },
    // ... rest of sections
  ]
}, [analysis, t, claimsLoading, claimsAnalysis, dimeLoading, dimeAnalysis, starburstingStatus])
```

**Step 2: Commit**

```bash
git add src/pages/tools/ContentIntelligencePage.tsx
git commit -m "perf(content-intel): memoize sections array

- Wrap sections definition in useMemo
- Only recalculate when analysis or status changes
- Reduces unnecessary re-renders"
```

---

### Task 11: Add useCallback to Event Handlers

**Files:**
- Modify: `src/pages/tools/ContentIntelligencePage.tsx`

**Step 1: Identify and wrap key handlers**

Find handlers like `handleAnalyze`, `handleSave`, `runDIMEAnalysis`, etc. and wrap with useCallback.

Example pattern:
```typescript
// Before
const runDIMEAnalysis = async () => {
  if (!analysis?.full_text || !analysis?.id) return
  // ...
}

// After
const runDIMEAnalysis = useCallback(async () => {
  if (!analysis?.full_text || !analysis?.id) return
  // ...
}, [analysis?.full_text, analysis?.id, /* other deps */])
```

**Step 2: Commit**

```bash
git add src/pages/tools/ContentIntelligencePage.tsx
git commit -m "perf(content-intel): add useCallback to event handlers

- Wrap async handlers with useCallback
- Add proper dependency arrays
- Prevents unnecessary re-renders of child components"
```

---

## Phase 4: Analyst Usefulness Improvements (Priority: MEDIUM)

### Task 12: Add Analysis Summary Export

**Files:**
- Create: `src/components/content-intelligence/AnalysisSummaryExport.tsx`

**Step 1: Create the component**

```typescript
// src/components/content-intelligence/AnalysisSummaryExport.tsx
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { FileDown, FileText, Table, Presentation, Copy, Check } from 'lucide-react'
import { useClipboard } from '@/hooks/useClipboard'
import type { ContentAnalysis } from '@/types/content-intelligence'

interface AnalysisSummaryExportProps {
  analysis: ContentAnalysis
  dimeAnalysis?: any
  claimsAnalysis?: any
}

export function AnalysisSummaryExport({ analysis, dimeAnalysis, claimsAnalysis }: AnalysisSummaryExportProps) {
  const { t } = useTranslation()
  const { copied, copyToClipboard } = useClipboard()

  // Generate markdown report
  const markdownReport = useMemo(() => {
    const sections: string[] = [
      `# Content Analysis Report`,
      `**Generated:** ${new Date().toISOString()}`,
      `**URL:** ${analysis.url}`,
      `**Title:** ${analysis.title || 'Untitled'}`,
      '',
      '## Summary',
      analysis.summary || 'No summary available',
      '',
      '## Key Statistics',
      `- **Word Count:** ${analysis.word_count || 'N/A'}`,
      `- **Reading Time:** ${analysis.reading_time || 'N/A'}`,
      `- **Entities Found:** ${analysis.entities?.length || 0}`,
      '',
    ]

    // Add entities section
    if (analysis.entities && analysis.entities.length > 0) {
      sections.push('## Entities')
      const entityGroups: Record<string, string[]> = {}
      for (const entity of analysis.entities) {
        if (!entityGroups[entity.type]) entityGroups[entity.type] = []
        if (!entityGroups[entity.type].includes(entity.name)) {
          entityGroups[entity.type].push(entity.name)
        }
      }
      for (const [type, names] of Object.entries(entityGroups)) {
        sections.push(`### ${type}`)
        sections.push(names.map(n => `- ${n}`).join('\n'))
        sections.push('')
      }
    }

    // Add sentiment if available
    if (analysis.sentiment_analysis) {
      sections.push('## Sentiment Analysis')
      sections.push(`- **Overall:** ${analysis.sentiment_analysis.overall || 'N/A'}`)
      sections.push(`- **Score:** ${analysis.sentiment_analysis.score || 'N/A'}`)
      sections.push('')
    }

    // Add DIME analysis if available
    if (dimeAnalysis) {
      sections.push('## DIME Analysis')
      if (dimeAnalysis.diplomatic) sections.push(`### Diplomatic\n${dimeAnalysis.diplomatic}`)
      if (dimeAnalysis.informational) sections.push(`### Informational\n${dimeAnalysis.informational}`)
      if (dimeAnalysis.military) sections.push(`### Military\n${dimeAnalysis.military}`)
      if (dimeAnalysis.economic) sections.push(`### Economic\n${dimeAnalysis.economic}`)
      sections.push('')
    }

    // Add claims if available
    if (claimsAnalysis?.claims && claimsAnalysis.claims.length > 0) {
      sections.push('## Claims Identified')
      for (const claim of claimsAnalysis.claims) {
        sections.push(`### ${claim.claim}`)
        sections.push(`- **Confidence:** ${claim.confidence || 'N/A'}`)
        sections.push(`- **Evidence:** ${claim.evidence || 'None'}`)
        sections.push('')
      }
    }

    return sections.join('\n')
  }, [analysis, dimeAnalysis, claimsAnalysis])

  const handleCopyMarkdown = useCallback(() => {
    copyToClipboard(markdownReport)
  }, [markdownReport, copyToClipboard])

  const handleDownloadMarkdown = useCallback(() => {
    const blob = new Blob([markdownReport], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analysis-${analysis.id || Date.now()}.md`
    link.click()
    URL.revokeObjectURL(url)
  }, [markdownReport, analysis.id])

  const handleDownloadJSON = useCallback(() => {
    const exportData = {
      url: analysis.url,
      title: analysis.title,
      summary: analysis.summary,
      entities: analysis.entities,
      sentiment: analysis.sentiment_analysis,
      wordCount: analysis.word_count,
      readingTime: analysis.reading_time,
      dimeAnalysis,
      claimsAnalysis,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analysis-${analysis.id || Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [analysis, dimeAnalysis, claimsAnalysis])

  const handleDownloadCSV = useCallback(() => {
    // Create CSV for entities
    const headers = ['Type', 'Name', 'Count']
    const entityCounts: Record<string, Record<string, number>> = {}

    for (const entity of (analysis.entities || [])) {
      if (!entityCounts[entity.type]) entityCounts[entity.type] = {}
      entityCounts[entity.type][entity.name] = (entityCounts[entity.type][entity.name] || 0) + 1
    }

    const rows: string[][] = [headers]
    for (const [type, names] of Object.entries(entityCounts)) {
      for (const [name, count] of Object.entries(names)) {
        rows.push([type, name, count.toString()])
      }
    }

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `entities-${analysis.id || Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [analysis])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="h-4 w-4 mr-1" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyMarkdown}>
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          Copy as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadMarkdown}>
          <FileText className="h-4 w-4 mr-2" />
          Download Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadJSON}>
          <FileText className="h-4 w-4 mr-2" />
          Download JSON (.json)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadCSV}>
          <Table className="h-4 w-4 mr-2" />
          Download Entities CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/content-intelligence/AnalysisSummaryExport.tsx
git commit -m "feat(content-intel): add AnalysisSummaryExport component

- Add markdown report generation
- Add JSON export with all analysis data
- Add CSV export for entities
- Add copy to clipboard option"
```

---

### Task 13: Add Entity Quick Filter

**Files:**
- Create: `src/components/content-intelligence/EntityQuickFilter.tsx`

**Step 1: Create the component**

```typescript
// src/components/content-intelligence/EntityQuickFilter.tsx
import { useMemo, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, X, Users, Building, MapPin, Calendar, Hash } from 'lucide-react'
import type { ContentAnalysis } from '@/types/content-intelligence'

interface EntityQuickFilterProps {
  analysis: ContentAnalysis
  onEntityClick?: (entity: string, type: string) => void
  highlightedEntity?: string | null
}

const ENTITY_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PERSON: Users,
  ORGANIZATION: Building,
  LOCATION: MapPin,
  DATE: Calendar,
  DEFAULT: Hash,
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  PERSON: 'bg-blue-500',
  ORGANIZATION: 'bg-green-500',
  LOCATION: 'bg-orange-500',
  DATE: 'bg-purple-500',
  GPE: 'bg-teal-500',
  DEFAULT: 'bg-gray-500',
}

export function EntityQuickFilter({ analysis, onEntityClick, highlightedEntity }: EntityQuickFilterProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  // Group and count entities
  const entityData = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    const types = new Set<string>()

    for (const entity of (analysis.entities || [])) {
      types.add(entity.type)
      if (!counts[entity.type]) counts[entity.type] = {}
      counts[entity.type][entity.name] = (counts[entity.type][entity.name] || 0) + 1
    }

    return {
      types: Array.from(types).sort(),
      counts,
      total: analysis.entities?.length || 0,
    }
  }, [analysis.entities])

  // Filter entities based on search and type selection
  const filteredEntities = useMemo(() => {
    const results: Array<{ name: string; type: string; count: number }> = []
    const searchLower = searchTerm.toLowerCase()

    for (const [type, names] of Object.entries(entityData.counts)) {
      if (selectedTypes.length > 0 && !selectedTypes.includes(type)) continue

      for (const [name, count] of Object.entries(names)) {
        if (searchTerm && !name.toLowerCase().includes(searchLower)) continue
        results.push({ name, type, count })
      }
    }

    return results.sort((a, b) => b.count - a.count)
  }, [entityData.counts, searchTerm, selectedTypes])

  const toggleTypeFilter = useCallback((type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }, [])

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setSelectedTypes([])
  }, [])

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search entities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 pr-8"
        />
        {(searchTerm || selectedTypes.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={clearFilters}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-1">
        {entityData.types.map(type => {
          const Icon = ENTITY_TYPE_ICONS[type] || ENTITY_TYPE_ICONS.DEFAULT
          const color = ENTITY_TYPE_COLORS[type] || ENTITY_TYPE_COLORS.DEFAULT
          const isSelected = selectedTypes.includes(type)
          const count = Object.keys(entityData.counts[type] || {}).length

          return (
            <Badge
              key={type}
              variant={isSelected ? 'default' : 'outline'}
              className={`cursor-pointer ${isSelected ? color : ''}`}
              onClick={() => toggleTypeFilter(type)}
            >
              <Icon className="h-3 w-3 mr-1" />
              {type} ({count})
            </Badge>
          )
        })}
      </div>

      {/* Results Count */}
      <p className="text-xs text-muted-foreground">
        Showing {filteredEntities.length} of {Object.values(entityData.counts).reduce((acc, names) => acc + Object.keys(names).length, 0)} unique entities
      </p>

      {/* Entity List */}
      <ScrollArea className="h-[300px]">
        <div className="space-y-1">
          {filteredEntities.map(({ name, type, count }) => {
            const Icon = ENTITY_TYPE_ICONS[type] || ENTITY_TYPE_ICONS.DEFAULT
            const color = ENTITY_TYPE_COLORS[type] || ENTITY_TYPE_COLORS.DEFAULT
            const isHighlighted = highlightedEntity === name

            return (
              <div
                key={`${type}-${name}`}
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                  isHighlighted ? 'bg-primary/20' : 'hover:bg-muted'
                }`}
                onClick={() => onEntityClick?.(name, type)}
              >
                <div className="flex items-center gap-2">
                  <div className={`${color} rounded p-1`}>
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-sm font-medium">{name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {count}×
                </Badge>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/content-intelligence/EntityQuickFilter.tsx
git commit -m "feat(content-intel): add EntityQuickFilter component

- Add searchable entity list
- Add type filtering with badges
- Show entity counts and icons by type
- Support highlighting selected entity"
```

---

## Phase 5: Integration & Final Cleanup (Priority: HIGH)

### Task 14: Integrate New Components into Main Page

**Files:**
- Modify: `src/pages/tools/ContentIntelligencePage.tsx`

**Step 1: Replace inline code with extracted components**

At the top of the file, add imports:
```typescript
import {
  AnalysisInputForm,
  WordCloudSection,
  SharePanel,
  QASection,
  AnalysisSummaryExport,
  EntityQuickFilter,
} from '@/components/content-intelligence'

import {
  useAnalysisStore,
  useAnalysisUI,
  useAnalysisProcessing,
  useAnalysisData,
  useSavedLinks,
  useAnalyzeUrl,
  useDIMEAnalysis,
  useClaimsAnalysis,
} from '@/hooks/content-intelligence'
```

**Step 2: Replace state declarations**

Remove the 31 useState hooks and replace with store hooks:
```typescript
// OLD (remove):
const [url, setUrl] = useState('')
const [mode, setMode] = useState<'quick' | 'normal' | 'full'>('normal')
// ... 29 more

// NEW (add):
const { activeTab, textView, wordCloudView, linkFilter, linkSort, highlightedEntity } = useAnalysisUI()
const { processing, status, progress, currentStep } = useAnalysisProcessing()
const { url, mode, analysis, bypassUrls } = useAnalysisData()
const { data: savedLinks, isLoading: loadingSavedLinks } = useSavedLinks()
```

**Step 3: Replace component instances**

Find the inline input form JSX and replace with:
```tsx
<AnalysisInputForm onAnalysisComplete={() => setActiveTab('overview')} />
```

Find the word cloud section and replace with:
```tsx
{analysis && <WordCloudSection analysis={analysis} />}
```

Find the share dropdown and replace with:
```tsx
{analysis && <SharePanel analysis={analysis} />}
```

Find the Q&A section and replace with:
```tsx
{analysis && <QASection analysis={analysis} />}
```

**Step 4: Commit**

```bash
git add src/pages/tools/ContentIntelligencePage.tsx
git commit -m "refactor(content-intel): integrate extracted components

- Replace 31 useState with Zustand store hooks
- Use extracted AnalysisInputForm, WordCloudSection, SharePanel, QASection
- Reduce main component from 5570 to ~2500 lines
- Improve performance with React Query for API calls"
```

---

### Task 15: Final Verification

**Step 1: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Dev server test**

Run: `npm run dev`
Expected: Page loads and all features work

**Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: finalize ContentIntelligencePage refactor

Complete refactoring includes:
- Zustand store for state management (replaces 31 useState)
- React Query for API calls (replaces 25 fetch calls)
- 6 extracted components (AnalysisInputForm, WordCloudSection, SharePanel, QASection, AnalysisSummaryExport, EntityQuickFilter)
- useClipboard hook (consolidates 3 clipboard implementations)
- Centralized API client with error handling
- useMemo/useCallback for performance

Estimated reduction: 5570 -> ~2500 lines in main component"
```

---

## Summary

| Phase | Tasks | Priority | Estimated Lines Removed |
|-------|-------|----------|------------------------|
| 1: Foundation | 4 | CRITICAL | 0 (new hooks) |
| 2: Component Extraction | 5 | HIGH | ~1500 |
| 3: Performance | 2 | MEDIUM | 0 (optimizations) |
| 4: Analyst Usefulness | 2 | MEDIUM | 0 (new features) |
| 5: Integration | 2 | HIGH | ~1500 |

**Total Improvement:**
- **Before:** 5,570 lines, 31 useState, 25 fetch calls, 0 memoization
- **After:** ~2,500 lines, Zustand store, React Query, proper memoization
- **Performance:** ~50% fewer re-renders, centralized error handling
- **Maintainability:** 6 focused components, reusable hooks, typed API client

---

**Document Version:** 1.0
**Created:** 2026-01-30
**Status:** Ready for Implementation
