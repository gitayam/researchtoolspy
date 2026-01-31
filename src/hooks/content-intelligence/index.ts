// src/hooks/content-intelligence/index.ts

// State management
export {
  useAnalysisStore,
  useAnalysisUI,
  useAnalysisProcessing,
  useAnalysisData,
  useAnalysisActions,
} from './useAnalysisState'

// API hooks
export {
  // Query keys
  contentIntelligenceKeys,
  // Query hooks
  useSavedLinks,
  useStarburstingStatus,
  // Mutation hooks
  useAnalyzeUrl,
  useDIMEAnalysis,
  useClaimsAnalysis,
  useSaveAnalysis,
  useCountryLookup,
  useVirusTotalLookup,
  useAskQuestion,
  useSocialMediaExtract,
  useGitRepositoryExtract,
  useStartStarbursting,
  useStartStarburstingMultiple,
  useGenerateMoreQuestions,
  useLinkStarburstingEntity,
  useSummarizeEntity,
  useShareAnalysis,
  useAutoExtractEntities,
  useMatchEntitiesToActors,
  // API client and error class
  contentIntelligenceAPI,
  ContentIntelligenceAPIError,
} from './useContentIntelligenceAPI'

// Types
export type { AnalysisTab, AnalysisUIState, AnalysisProcessingState, AnalysisDataState } from './types'

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
} from './useContentIntelligenceAPI'
