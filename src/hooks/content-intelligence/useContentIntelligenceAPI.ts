// src/hooks/content-intelligence/useContentIntelligenceAPI.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  contentIntelligenceAPI,
  ContentIntelligenceAPIError,
  type AnalyzeUrlResponse,
  type DIMEAnalysisResponse,
  type ClaimsAnalysisResponse,
  type CountryLookupResponse,
  type VirusTotalResponse,
  type AskQuestionResponse,
  type SocialMediaExtractResponse,
  type GitRepositoryExtractResponse,
  type StarburstingResponse,
  type StarburstingStatusResponse,
  type EntitySummaryResponse,
  type ShareAnalysisResponse,
  type SaveAnalysisResponse,
  type AutoExtractEntitiesResponse,
} from '@/lib/api/content-intelligence'
import { useToast } from '@/components/ui/use-toast'
import { useAnalysisStore } from './useAnalysisState'
import type { SavedLink } from '@/types/content-intelligence'

// ============================================
// Query Keys
// ============================================

export const contentIntelligenceKeys = {
  all: ['content-intelligence'] as const,
  savedLinks: () => [...contentIntelligenceKeys.all, 'saved-links'] as const,
  savedLinksWithLimit: (limit: number) =>
    [...contentIntelligenceKeys.savedLinks(), { limit }] as const,
  analysis: (id: string | number) =>
    [...contentIntelligenceKeys.all, 'analysis', id] as const,
  starbursting: (sessionId: string) =>
    [...contentIntelligenceKeys.all, 'starbursting', sessionId] as const,
  starburstingStatus: (sessionId: string) =>
    [...contentIntelligenceKeys.starbursting(sessionId), 'status'] as const,
}

// ============================================
// Query Hooks
// ============================================

/**
 * Hook to fetch saved links for the current user
 */
export function useSavedLinks(limit?: number) {
  return useQuery<SavedLink[], ContentIntelligenceAPIError>({
    queryKey: limit
      ? contentIntelligenceKeys.savedLinksWithLimit(limit)
      : contentIntelligenceKeys.savedLinks(),
    queryFn: () => contentIntelligenceAPI.getSavedLinks(limit),
    staleTime: 30_000, // Consider data stale after 30 seconds
  })
}

/**
 * Hook to poll starbursting session status
 * Automatically polls while status is 'processing'
 */
export function useStarburstingStatus(sessionId: string | null) {
  return useQuery<StarburstingStatusResponse, ContentIntelligenceAPIError>({
    queryKey: contentIntelligenceKeys.starburstingStatus(sessionId || ''),
    queryFn: () => contentIntelligenceAPI.getStarburstingStatus(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data
      // Poll every 2 seconds while processing
      return data?.status === 'processing' ? 2000 : false
    },
  })
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Hook to analyze a URL
 */
export function useAnalyzeUrl() {
  const { toast } = useToast()
  const store = useAnalysisStore()
  const queryClient = useQueryClient()

  return useMutation<
    AnalyzeUrlResponse,
    ContentIntelligenceAPIError,
    { url: string; mode: 'quick' | 'normal' | 'full' }
  >({
    mutationFn: ({ url, mode }) => contentIntelligenceAPI.analyzeUrl(url, mode),
    onMutate: () => {
      store.startProcessing()
    },
    onSuccess: (data) => {
      store.setAnalysis(data.analysis)
      store.finishProcessing()
      if (data.bypass_urls) {
        store.setBypassUrls(data.bypass_urls)
      }
      // Invalidate saved links to show newly analyzed content if saved
      queryClient.invalidateQueries({ queryKey: contentIntelligenceKeys.savedLinks() })
    },
    onError: (error) => {
      store.setStatus('error')
      // Check if the error is due to content being blocked
      if (error.message.includes('blocked') || error.message.includes('paywall')) {
        const encodedUrl = encodeURIComponent(store.url)
        store.setBypassUrls({
          '12ft': `https://12ft.io/proxy?q=${encodedUrl}`,
          wayback: `https://web.archive.org/web/*/${store.url}`,
          archive_is: `https://archive.is/${store.url}`,
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

/**
 * Hook to run DIME framework analysis
 */
export function useDIMEAnalysis() {
  const { toast } = useToast()

  return useMutation<
    DIMEAnalysisResponse,
    ContentIntelligenceAPIError,
    { analysisId: string | number; content: string }
  >({
    mutationFn: ({ analysisId, content }) =>
      contentIntelligenceAPI.runDIMEAnalysis(analysisId, content),
    onError: (error) => {
      toast({
        title: 'DIME Analysis Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to run claims extraction and deception analysis
 */
export function useClaimsAnalysis() {
  const { toast } = useToast()

  return useMutation<
    ClaimsAnalysisResponse,
    ContentIntelligenceAPIError,
    { analysisId: string | number }
  >({
    mutationFn: ({ analysisId }) => contentIntelligenceAPI.runClaimsAnalysis(analysisId),
    onSuccess: (data) => {
      const totalClaims = data.claim_analysis?.summary?.total_claims || 0
      toast({
        title: 'Claims Analysis Complete',
        description: `${totalClaims} claims analyzed successfully`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Claims Analysis Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to save an analysis to the user's library
 */
export function useSaveAnalysis() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation<
    SaveAnalysisResponse,
    ContentIntelligenceAPIError,
    { url: string; analysis_id: string | number; note?: string; tags?: string[] }
  >({
    mutationFn: (data) => contentIntelligenceAPI.saveAnalysis(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contentIntelligenceKeys.savedLinks() })
      toast({
        title: 'Analysis Saved',
        description: 'Your analysis has been saved successfully.',
      })
    },
    onError: (error) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to look up country/origin information for a domain
 */
export function useCountryLookup() {
  const { toast } = useToast()

  return useMutation<CountryLookupResponse, ContentIntelligenceAPIError, string>({
    mutationFn: (url) => contentIntelligenceAPI.lookupCountry(url),
    onError: (error) => {
      toast({
        title: 'Country Lookup Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to run VirusTotal security scan on a URL
 */
export function useVirusTotalLookup() {
  const { toast } = useToast()

  return useMutation<VirusTotalResponse, ContentIntelligenceAPIError, string>({
    mutationFn: (url) => contentIntelligenceAPI.virusTotalLookup(url),
    onError: (error) => {
      toast({
        title: 'VirusTotal Lookup Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to ask a question about the analyzed content
 */
export function useAskQuestion() {
  const { toast } = useToast()

  return useMutation<
    AskQuestionResponse,
    ContentIntelligenceAPIError,
    { analysisId: string | number; question: string; context: string }
  >({
    mutationFn: ({ analysisId, question, context }) =>
      contentIntelligenceAPI.askQuestion(analysisId, question, context),
    onError: (error) => {
      toast({
        title: 'Question Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to extract social media post data
 */
export function useSocialMediaExtract() {
  const { toast } = useToast()

  return useMutation<SocialMediaExtractResponse, ContentIntelligenceAPIError, string>({
    mutationFn: (url) => contentIntelligenceAPI.extractSocialMedia(url),
    onError: (error) => {
      toast({
        title: 'Social Media Extraction Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to extract git repository information
 */
export function useGitRepositoryExtract() {
  const { toast } = useToast()

  return useMutation<GitRepositoryExtractResponse, ContentIntelligenceAPIError, string>({
    mutationFn: (url) => contentIntelligenceAPI.extractGitRepository(url),
    onError: (error) => {
      toast({
        title: 'Git Repository Extraction Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to start a starbursting analysis session
 */
export function useStartStarbursting() {
  const { toast } = useToast()

  return useMutation<
    StarburstingResponse,
    ContentIntelligenceAPIError,
    { analysisId: string | number; title?: string }
  >({
    mutationFn: ({ analysisId, title }) =>
      contentIntelligenceAPI.startStarbursting(analysisId, title),
    onSuccess: () => {
      toast({
        title: 'Starbursting Started',
        description: 'Generating 5W1H questions for your content...',
      })
    },
    onError: (error) => {
      toast({
        title: 'Starbursting Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to start starbursting with multiple analysis sources
 */
export function useStartStarburstingMultiple() {
  const { toast } = useToast()

  return useMutation<
    StarburstingResponse,
    ContentIntelligenceAPIError,
    { analysisIds: (string | number)[]; title?: string }
  >({
    mutationFn: ({ analysisIds, title }) =>
      contentIntelligenceAPI.startStarburstingMultiple(analysisIds, title),
    onSuccess: (data) => {
      toast({
        title: 'Starbursting Started',
        description: `Analyzing ${data.sources_count} source${data.sources_count !== 1 ? 's' : ''}...`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Starbursting Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to generate more questions for a starbursting session
 */
export function useGenerateMoreQuestions() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation<
    StarburstingResponse,
    ContentIntelligenceAPIError,
    { sessionId: string; existingQuestions?: Record<string, unknown> }
  >({
    mutationFn: ({ sessionId, existingQuestions }) =>
      contentIntelligenceAPI.generateMoreQuestions(sessionId, existingQuestions),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: contentIntelligenceKeys.starburstingStatus(sessionId),
      })
      toast({
        title: 'Questions Generated',
        description: 'New questions have been added to your session.',
      })
    },
    onError: (error) => {
      toast({
        title: 'Generate Questions Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to link an entity to an actor in a starbursting session
 */
export function useLinkStarburstingEntity() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation<
    { success: boolean },
    ContentIntelligenceAPIError,
    { sessionId: string; questionId: string; entity: string; actorId: string }
  >({
    mutationFn: ({ sessionId, questionId, entity, actorId }) =>
      contentIntelligenceAPI.linkStarburstingEntity(
        sessionId,
        questionId,
        entity,
        actorId
      ),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: contentIntelligenceKeys.starbursting(sessionId),
      })
      toast({
        title: 'Entity Linked',
        description: 'Entity has been linked to the actor successfully.',
      })
    },
    onError: (error) => {
      toast({
        title: 'Link Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to summarize an entity within the content context
 */
export function useSummarizeEntity() {
  const { toast } = useToast()

  return useMutation<
    EntitySummaryResponse,
    ContentIntelligenceAPIError,
    {
      content: string
      entityName: string
      entityType: string
      contentTitle?: string
    }
  >({
    mutationFn: ({ content, entityName, entityType, contentTitle }) =>
      contentIntelligenceAPI.summarizeEntity(
        content,
        entityName,
        entityType,
        contentTitle
      ),
    onSuccess: (data) => {
      toast({
        title: 'Summary Generated',
        description: `AI summary for "${data.entity}" is ready`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Summary Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to create a shareable link for an analysis
 */
export function useShareAnalysis() {
  const { toast } = useToast()

  return useMutation<ShareAnalysisResponse, ContentIntelligenceAPIError, string | number>(
    {
      mutationFn: (analysisId) => contentIntelligenceAPI.shareAnalysis(analysisId),
      onSuccess: () => {
        toast({
          title: 'Share Link Created',
          description: 'Copy the link to share your analysis.',
        })
      },
      onError: (error) => {
        toast({
          title: 'Share Failed',
          description: error.message,
          variant: 'destructive',
        })
      },
    }
  )
}

/**
 * Hook to auto-extract entities and match to existing actors
 */
export function useAutoExtractEntities() {
  const { toast } = useToast()

  return useMutation<
    AutoExtractEntitiesResponse,
    ContentIntelligenceAPIError,
    string | number
  >({
    mutationFn: (analysisId) => contentIntelligenceAPI.autoExtractEntities(analysisId),
    onError: (error) => {
      toast({
        title: 'Entity Extraction Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Hook to match entities to existing actors
 */
export function useMatchEntitiesToActors() {
  return useMutation<
    Record<string, { id: string; name: string }>,
    ContentIntelligenceAPIError,
    Array<{ name: string; type: string }>
  >({
    mutationFn: (entities) => contentIntelligenceAPI.matchEntitiesToActors(entities),
  })
}

// ============================================
// Re-export types and API client for convenience
// ============================================

export { contentIntelligenceAPI, ContentIntelligenceAPIError }
export type {
  AnalyzeUrlResponse,
  DIMEAnalysisResponse,
  ClaimsAnalysisResponse,
  CountryLookupResponse,
  VirusTotalResponse,
  AskQuestionResponse,
  SocialMediaExtractResponse,
  GitRepositoryExtractResponse,
  StarburstingResponse,
  StarburstingStatusResponse,
  EntitySummaryResponse,
  ShareAnalysisResponse,
  SaveAnalysisResponse,
  AutoExtractEntitiesResponse,
}
