// src/hooks/content-intelligence/useAnalysisState.ts
import { create } from 'zustand'
import type { ContentAnalysis, ProcessingStatus } from '@/types/content-intelligence'
import type { AnalysisTab } from './types'

interface AnalysisStore {
  // UI State
  activeTab: AnalysisTab
  textView: 'summary' | 'fulltext'
  wordCloudView: 'words' | 'phrases' | 'entities'
  linkFilter: 'all' | 'external' | 'internal'
  linkSort: 'references' | 'chronological'
  highlightedEntity: string | null

  // Processing State
  processing: boolean
  status: ProcessingStatus
  progress: number
  currentStep: string

  // Data State
  url: string
  mode: 'quick' | 'normal' | 'full'
  analysis: ContentAnalysis | null
  bypassUrls: Record<string, string>

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
  startProcessing: () => set({ processing: true, status: 'processing' as ProcessingStatus, progress: 0, currentStep: '' }),
  updateProgress: (progress, step) => set({ progress, currentStep: step }),
  setStatus: (status) => set({ status }),
  finishProcessing: () => set({ processing: false, status: 'complete' as ProcessingStatus }),

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

// Action hooks for cleaner API
export const useAnalysisActions = () => useAnalysisStore((state) => ({
  setActiveTab: state.setActiveTab,
  setTextView: state.setTextView,
  setWordCloudView: state.setWordCloudView,
  setLinkFilter: state.setLinkFilter,
  setLinkSort: state.setLinkSort,
  setHighlightedEntity: state.setHighlightedEntity,
  startProcessing: state.startProcessing,
  updateProgress: state.updateProgress,
  setStatus: state.setStatus,
  finishProcessing: state.finishProcessing,
  setUrl: state.setUrl,
  setMode: state.setMode,
  setAnalysis: state.setAnalysis,
  setBypassUrls: state.setBypassUrls,
  reset: state.reset,
}))
