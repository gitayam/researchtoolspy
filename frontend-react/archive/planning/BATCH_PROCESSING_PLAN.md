# Batch Processing Tool - Implementation Plan

**Created:** October 2, 2025
**Status:** Planning
**Priority:** High (Sprint 3, Tool #4)
**Estimated Time:** 5-7 hours

---

## 🎯 Goal

Build a batch processing tool that can:
1. Process multiple URLs simultaneously
2. Handle bulk file uploads
3. Queue management with priority support
4. Real-time progress tracking
5. Aggregate results from multiple sources
6. Export batch results in various formats
7. Integration with other tools (Content Extraction, URL Analysis, Citations)

---

## 📋 Features

### Phase 1: Batch URL Processing (3-4 hours)
- [ ] Bulk URL input (paste list, CSV upload)
- [ ] URL validation and deduplication
- [ ] Queue management (FIFO, priority)
- [ ] Parallel processing (configurable workers)
- [ ] Real-time progress tracking
- [ ] Individual item status (pending/processing/success/error)
- [ ] Results aggregation

### Phase 2: Batch File Processing (2-3 hours)
- [ ] Multiple file upload
- [ ] File validation (type, size)
- [ ] Processing queue for files
- [ ] Progress tracking per file
- [ ] Batch content extraction
- [ ] Results export

### Phase 3: Integration & Export (1-2 hours)
- [ ] Integration with Content Extraction
- [ ] Integration with URL Analysis
- [ ] Integration with Citations Generator
- [ ] Batch export to JSON/CSV
- [ ] Create datasets from batch results
- [ ] Error handling and retry logic

---

## 🏗️ Architecture

### Frontend Components

```
src/pages/tools/
  └── BatchProcessingPage.tsx (Main page)

src/components/tools/
  ├── BatchURLInput.tsx (URL bulk input)
  ├── BatchFileUpload.tsx (Multiple file upload)
  ├── ProcessingQueue.tsx (Queue visualization)
  ├── ProgressTracker.tsx (Overall progress)
  ├── BatchResults.tsx (Results table)
  └── BatchExport.tsx (Export options)

src/types/
  └── batch-processing.ts (Type definitions)
```

### Backend API

```
functions/api/tools/
  ├── batch-process.ts (Main batch processing endpoint)
  └── batch-status.ts (Check batch status)

Functions needed:
  - POST /api/tools/batch-process - Start batch processing job
  - GET /api/tools/batch-status/:jobId - Get job status
  - POST /api/tools/batch-cancel/:jobId - Cancel job
```

---

## 🔧 Technical Stack

### Batch Processing
- **Queue Management** - In-memory queue with status tracking
- **Parallel Processing** - Process N items concurrently
- **Worker Pool** - Configurable number of workers
- **Progress Events** - Real-time progress updates
- **Error Handling** - Retry failed items with exponential backoff

### Supported Operations
1. **URL Analysis** - Batch analyze multiple URLs
2. **Content Extraction** - Extract from multiple sources
3. **Citation Generation** - Generate citations for multiple sources
4. **Metadata Extraction** - Scrape metadata from URLs

### Processing Modes
- **Sequential** - One at a time (safe, slow)
- **Parallel** - Multiple concurrent (fast, resource-intensive)
- **Adaptive** - Adjust based on success rate

---

## 📝 API Specification

### POST /api/tools/batch-process

**Request:**
```typescript
{
  type: 'url' | 'file' | 'mixed',
  operation: 'analyze' | 'extract' | 'citation' | 'metadata',
  items: Array<{
    id: string,
    type: 'url' | 'file',
    source: string,  // URL or file data
    metadata?: any
  }>,
  options: {
    maxWorkers?: number,  // Default: 3
    retryFailed?: boolean,
    stopOnError?: boolean,
    createDatasets?: boolean
  }
}
```

**Response:**
```typescript
{
  jobId: string,
  status: 'queued' | 'processing' | 'completed' | 'failed',
  total: number,
  processed: number,
  succeeded: number,
  failed: number,
  results: Array<{
    id: string,
    status: 'pending' | 'processing' | 'success' | 'error',
    source: string,
    result?: any,
    error?: string,
    processedAt?: string
  }>,
  startedAt: string,
  completedAt?: string
}
```

---

## 🎨 UI Design

### Layout

```
┌─────────────────────────────────────────────┐
│  Batch Processing                           │
├─────────────────────────────────────────────┤
│                                             │
│  Select Operation:                          │
│  [URL Analysis v] [Content Extraction]      │
│                   [Citation Generator]      │
│                   [Metadata Extraction]     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Input Method                        │   │
│  │ ⦿ Paste URLs                        │   │
│  │ ○ Upload CSV                        │   │
│  │ ○ Upload Files                      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  URLs (one per line):                       │
│  ┌─────────────────────────────────────┐   │
│  │ https://example.com                 │   │
│  │ https://example.org                 │   │
│  │ https://example.net                 │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Options:                                   │
│  ☑ Retry failed items                      │
│  ☐ Stop on first error                     │
│  ☑ Create datasets automatically           │
│  Workers: [3 v] (1-5)                      │
│                                             │
│  [Start Processing] [Clear]                 │
│                                             │
├─────────────────────────────────────────────┤
│  📊 Processing Queue                        │
├─────────────────────────────────────────────┤
│                                             │
│  Overall Progress: ████████░░░░ 8/12 (67%) │
│  ⏱ Elapsed: 00:02:34 | Est. Remaining: 1m  │
│                                             │
│  Status: 5 Succeeded | 3 Processing | 2... │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ ✓ example.com      | 2.3s | Success  │ │
│  │ ✓ example.org      | 1.8s | Success  │ │
│  │ ⟳ example.net      | ...  | Processing│ │
│  │ ⏸ example.info     | ...  | Queued    │ │
│  │ ✗ invalid.xyz      | 0.5s | Failed    │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [Pause] [Resume] [Cancel] [Export Results]│
└─────────────────────────────────────────────┘

Results Table:
┌─────────────────────────────────────────────┐
│  Batch Results                              │
├─────────────────────────────────────────────┤
│  Showing 5 of 12 results                    │
│                                             │
│  URL                  Status    Time        │
│  ─────────────────────────────────────────  │
│  example.com          ✓ Success 2.3s   View│
│  example.org          ✓ Success 1.8s   View│
│  example.net          ⟳ Process ...    -   │
│  example.info         ⏸ Queued  ...    -   │
│  invalid.xyz          ✗ Failed  0.5s   Error│
│                                             │
│  [Export All] [Export Succeeded Only]       │
│  [Create Datasets] [Generate Citations]     │
└─────────────────────────────────────────────┘
```

---

## 🚀 Implementation Steps

### Step 1: Create Type Definitions (30 min)
```typescript
// src/types/batch-processing.ts
export type BatchOperation = 'analyze' | 'extract' | 'citation' | 'metadata'
export type BatchItemType = 'url' | 'file'
export type BatchItemStatus = 'pending' | 'processing' | 'success' | 'error'
export type BatchJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

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
}

export interface BatchOptions {
  maxWorkers: number
  retryFailed: boolean
  stopOnError: boolean
  createDatasets: boolean
}
```

### Step 2: Build Backend API (2-3 hours)
- Implement batch processing queue
- Add worker pool for parallel processing
- Add progress tracking
- Implement retry logic
- Add error handling

### Step 3: Build UI Components (2-3 hours)
- Bulk URL input with CSV support
- File upload for batch files
- Processing queue visualization
- Real-time progress tracking
- Results table with filtering
- Export functionality

### Step 4: Integration & Testing (1 hour)
- Connect UI to API
- Test with various batch sizes
- Error handling
- Performance optimization
- Export to multiple formats

---

## 📚 CSV Format for Bulk URLs

```csv
url,priority,metadata
https://example.com,high,Research paper
https://example.org,normal,Blog post
https://example.net,low,News article
```

---

## 🎯 Success Criteria

- ✅ User can paste multiple URLs for batch processing
- ✅ User can upload CSV file with URLs
- ✅ User can upload multiple files at once
- ✅ Queue shows real-time progress
- ✅ Individual items show status (pending/processing/success/error)
- ✅ Overall progress bar and statistics
- ✅ Failed items can be retried
- ✅ Results can be exported to JSON/CSV
- ✅ Integration with other tools (URL Analysis, Content Extraction)
- ✅ Datasets can be created from batch results

---

## 📈 Future Enhancements

- Scheduled batch jobs
- Recurring batch processing
- Batch job history
- Advanced filtering and sorting
- Batch comparison tools
- API rate limiting awareness
- Distributed processing for large batches
- WebSocket for real-time updates
- Batch job templates

---

**Status**: Ready to implement Phase 1
