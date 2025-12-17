import { useCallback, useState } from 'react'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ExtractionProgress } from '@/types/extraction'

interface FileUploaderProps {
  onFileSelected: (file: File) => void
  progress?: ExtractionProgress
  maxSizeMB?: number
  acceptedFileTypes?: string[]
}

const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'text/html',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
]

const DEFAULT_MAX_SIZE_MB = 10

export function FileUploader({
  onFileSelected,
  progress,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedFileTypes = DEFAULT_ACCEPTED_TYPES
}: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit`
    }

    // Check file type
    if (!acceptedFileTypes.includes(file.type) && file.type !== '') {
      // Also check extension as fallback
      const ext = file.name.split('.').pop()?.toLowerCase()
      const allowedExts = ['pdf', 'html', 'htm', 'txt', 'docx', 'doc']
      if (!ext || !allowedExts.includes(ext)) {
        return `File type not supported. Accepted types: PDF, HTML, TXT, DOCX`
      }
    }

    return null
  }

  const handleFile = useCallback((file: File) => {
    setError(null)

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setSelectedFile(file)
    onFileSelected(file)
  }, [onFileSelected])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }, [handleFile])

  const clearFile = () => {
    setSelectedFile(null)
    setError(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    return <FileText className="h-6 w-6 text-blue-600" />
  }

  const isProcessing = progress && progress.status !== 'idle' && progress.status !== 'complete' && progress.status !== 'error'

  return (
    <div className="w-full space-y-4">
      {/* Drag and Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/10'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleChange}
          accept={acceptedFileTypes.join(',')}
          disabled={isProcessing}
        />

        {!selectedFile ? (
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Supported formats: PDF, HTML, TXT, DOCX (Max {maxSizeMB}MB)
            </p>
          </label>
        ) : (
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 flex-1">
              {getFileIcon(selectedFile.name)}
              <div className="text-left flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            {!isProcessing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                className="ml-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {progress && progress.status !== 'idle' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {progress.message || 'Processing...'}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {progress.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Status Error */}
      {progress?.status === 'error' && progress.message && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{progress.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
