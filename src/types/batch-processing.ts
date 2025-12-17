// Batch Processing Types

export type BatchOperation = 'analyze-url' | 'extract-content' | 'generate-citation' | 'scrape-metadata'
export type BatchItemType = 'url' | 'file'
export type BatchItemStatus = 'pending' | 'processing' | 'success' | 'error'
export type BatchJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused'

export interface BatchItem {
  id: string
  type: BatchItemType
  source: string
  status: BatchItemStatus
  result?: any
  error?: string
  startedAt?: string
  completedAt?: string
  duration?: number
}

export interface BatchOptions {
  maxWorkers: number
  retryFailed: boolean
  stopOnError: boolean
  createDatasets: boolean
}

export interface BatchJob {
  jobId: string
  operation: BatchOperation
  status: BatchJobStatus
  total: number
  processed: number
  succeeded: number
  failed: number
  items: BatchItem[]
  options: BatchOptions
  startedAt: string
  completedAt?: string
  duration?: number
  estimatedTimeRemaining?: number
}

export interface BatchProcessRequest {
  operation: BatchOperation
  items: Array<{
    id?: string
    type: BatchItemType
    source: string
    metadata?: any
  }>
  options?: Partial<BatchOptions>
}

export interface BatchProcessResponse {
  jobId: string
  status: BatchJobStatus
  total: number
  message: string
}

export interface BatchStatusResponse extends BatchJob {}
