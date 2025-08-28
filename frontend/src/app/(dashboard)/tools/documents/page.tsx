'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { 
  FileText, 
  Upload, 
  Download, 
  Eye, 
  Search, 
  FileImage, 
  File,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react'

interface ProcessedDocument {
  id: string
  filename: string
  originalName: string
  fileType: string
  size: number
  status: 'processing' | 'completed' | 'failed'
  progress: number
  uploadedAt: string
  processedAt?: string
  extractedText?: string
  metadata?: {
    pageCount?: number
    wordCount?: number
    language?: string
    title?: string
    author?: string
    subject?: string
    keywords?: string[]
  }
  ocrResults?: {
    confidence: number
    textBlocks: Array<{
      text: string
      confidence: number
      boundingBox: [number, number, number, number]
    }>
  }
}

interface ConversionJob {
  id: string
  name: string
  inputFormat: string
  outputFormat: string
  files: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  startedAt?: string
  completedAt?: string
  results?: Array<{
    original: string
    converted: string
    downloadUrl: string
  }>
}

export default function DocumentProcessingTool() {
  const [activeTab, setActiveTab] = useState('upload')
  const [documents, setDocuments] = useState<ProcessedDocument[]>([])
  const [conversions, setConversions] = useState<ConversionJob[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const supportedFormats = [
    { value: 'pdf', label: 'PDF Document', icon: FileText },
    { value: 'docx', label: 'Word Document', icon: FileText },
    { value: 'txt', label: 'Text File', icon: File },
    { value: 'jpg', label: 'JPEG Image', icon: FileImage },
    { value: 'png', label: 'PNG Image', icon: FileImage },
  ]

  const conversionFormats = [
    { from: 'pdf', to: 'txt', label: 'PDF to Text' },
    { from: 'pdf', to: 'docx', label: 'PDF to Word' },
    { from: 'docx', to: 'pdf', label: 'Word to PDF' },
    { from: 'docx', to: 'txt', label: 'Word to Text' },
    { from: 'jpg', to: 'txt', label: 'Image to Text (OCR)' },
    { from: 'png', to: 'txt', label: 'Image to Text (OCR)' },
  ]

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
    
    const files = Array.from(e.dataTransfer.files)
    setSelectedFiles(prev => [...prev, ...files])
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...files])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadAndProcess = async () => {
    if (selectedFiles.length === 0) return

    for (const file of selectedFiles) {
      const newDoc: ProcessedDocument = {
        id: Date.now().toString() + Math.random(),
        filename: `processed_${file.name}`,
        originalName: file.name,
        fileType: file.type || file.name.split('.').pop() || 'unknown',
        size: file.size,
        status: 'processing',
        progress: 0,
        uploadedAt: new Date().toISOString()
      }

      setDocuments(prev => [newDoc, ...prev])

      // Simulate processing
      const docIndex = 0
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 500))
        setDocuments(prev => prev.map((doc, index) => 
          index === docIndex ? { ...doc, progress } : doc
        ))
      }

      // Complete processing with mock data
      setDocuments(prev => prev.map((doc, index) => 
        index === docIndex ? {
          ...doc,
          status: 'completed',
          processedAt: new Date().toISOString(),
          extractedText: `This is sample extracted text from ${file.name}. In a real implementation, this would contain the actual text extracted from the document using OCR or text parsing libraries.`,
          metadata: {
            pageCount: Math.floor(Math.random() * 20) + 1,
            wordCount: Math.floor(Math.random() * 5000) + 100,
            language: 'en',
            title: `Sample Title from ${file.name}`,
            author: 'Unknown Author',
            keywords: ['sample', 'document', 'processing']
          },
          ocrResults: file.type.startsWith('image/') ? {
            confidence: 85 + Math.random() * 10,
            textBlocks: [
              {
                text: `Sample OCR text block from ${file.name}`,
                confidence: 90,
                boundingBox: [100, 100, 300, 150]
              }
            ]
          } : undefined
        } : doc
      ))
    }

    setSelectedFiles([])
    setActiveTab('documents')
  }

  const downloadExtractedText = (doc: ProcessedDocument) => {
    if (!doc.extractedText) return
    
    const blob = new Blob([doc.extractedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extracted_${doc.originalName}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Document Processing</h1>
        <p className="mt-2 text-gray-600">
          Upload, analyze, and convert documents with OCR and text extraction
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="convert">Convert</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Documents
              </CardTitle>
              <CardDescription>
                Upload documents for text extraction and analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop files here or click to upload
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supports PDF, Word, images, and text files
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                />
                <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                  Select Files
                </Button>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selected Files</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm truncate">{file.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {formatFileSize(file.size)}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button onClick={uploadAndProcess} className="w-full">
                    Process {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Label className="text-sm font-medium col-span-full">Supported Formats</Label>
                {supportedFormats.map((format) => (
                  <div key={format.value} className="flex items-center gap-2 text-xs text-gray-600">
                    <format.icon className="h-3 w-3" />
                    {format.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {documents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No documents processed yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Upload documents to see results here
                </p>
              </CardContent>
            </Card>
          ) : (
            documents.map((doc) => (
              <Card key={doc.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        {doc.originalName}
                      </CardTitle>
                      <CardDescription>
                        {doc.fileType.toUpperCase()} • {formatFileSize(doc.size)} • 
                        Uploaded {new Date(doc.uploadedAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {doc.status === 'completed' && doc.extractedText && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadExtractedText(doc)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {doc.status === 'processing' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processing document...</span>
                        <span>{doc.progress}%</span>
                      </div>
                      <Progress value={doc.progress} />
                    </div>
                  )}

                  {doc.status === 'completed' && doc.metadata && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <Label className="font-medium">Pages</Label>
                        <p className="text-gray-600">{doc.metadata.pageCount || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Words</Label>
                        <p className="text-gray-600">{doc.metadata.wordCount?.toLocaleString() || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Language</Label>
                        <p className="text-gray-600">{doc.metadata.language?.toUpperCase() || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="font-medium">Title</Label>
                        <p className="text-gray-600 truncate">{doc.metadata.title || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  {doc.ocrResults && (
                    <div className="border-t pt-4">
                      <Label className="text-sm font-medium">OCR Results</Label>
                      <p className="text-sm text-gray-600 mb-2">
                        Confidence: {doc.ocrResults.confidence.toFixed(1)}%
                      </p>
                      <div className="bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                        <p className="text-xs text-gray-700">
                          {doc.ocrResults.textBlocks.map(block => block.text).join(' ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {doc.extractedText && (
                    <div className="border-t pt-4">
                      <Label className="text-sm font-medium">Extracted Text Preview</Label>
                      <div className="bg-gray-50 p-3 rounded max-h-32 overflow-y-auto mt-2">
                        <p className="text-xs text-gray-700">
                          {doc.extractedText.substring(0, 500)}
                          {doc.extractedText.length > 500 && '...'}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="convert" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Conversion</CardTitle>
              <CardDescription>
                Convert documents between different formats
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Label className="text-sm font-medium col-span-full">Available Conversions</Label>
                {conversionFormats.map((format, index) => (
                  <Badge key={index} variant="outline" className="justify-center py-2">
                    {format.label}
                  </Badge>
                ))}
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Document conversion feature is coming soon. Upload documents in the Upload tab for text extraction.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Documents
              </CardTitle>
              <CardDescription>
                Search through extracted text from processed documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="Search in document text..." />
                <Button>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Alert>
                <Search className="h-4 w-4" />
                <AlertDescription>
                  Full-text search across all processed documents will be available once you upload and process some documents.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}