/**
 * QASection Component
 *
 * Chat-like Q&A interface for asking questions about analyzed content.
 * Features:
 * - Suggested questions for new users
 * - Question input with send button
 * - Loading state while waiting for answer
 * - Copy conversation functionality
 * - Build context from analysis for Q&A
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Bot,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { useAskQuestion } from '@/hooks/content-intelligence'
import { useClipboard } from '@/hooks/useClipboard'
import type { ContentAnalysis } from '@/types/content-intelligence'

interface QASectionProps {
  analysis: ContentAnalysis
}

interface QAMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: string[]
  confidence?: number
  error?: boolean
}

export function QASection({ analysis }: QASectionProps) {
  const [messages, setMessages] = useState<QAMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const askQuestionMutation = useAskQuestion()
  const { copied, copyToClipboard } = useClipboard({
    successMessage: 'Conversation copied to clipboard',
  })

  // Build context from analysis
  const analysisContext = useMemo(() => {
    const entityList = analysis.entities
      ? [
          ...(analysis.entities.people?.map((e) => `${e.name} (person)`) || []),
          ...(analysis.entities.organizations?.map((e) => `${e.name} (organization)`) || []),
          ...(analysis.entities.locations?.map((e) => `${e.name} (location)`) || []),
        ].join(', ')
      : ''

    return `Title: ${analysis.title || 'Untitled'}
URL: ${analysis.url}
Summary: ${analysis.summary || 'No summary available'}
Full Text: ${analysis.extracted_text?.slice(0, 8000) || ''}
Entities: ${entityList || 'None extracted'}`
  }, [analysis])

  // Suggested questions for new users
  const suggestedQuestions = [
    'What are the main arguments in this content?',
    'Who are the key people mentioned?',
    'What is the tone of this content?',
    'What evidence supports the main claims?',
    'Are there any potential biases in this content?',
  ]

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const handleSendQuestion = async (question: string) => {
    if (!question.trim() || askQuestionMutation.isPending) return

    const userMessageId = `user-${Date.now()}`
    const assistantMessageId = `assistant-${Date.now()}`

    // Add user message
    const userMessage: QAMessage = {
      id: userMessageId,
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')

    // Add placeholder assistant message
    const pendingMessage: QAMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, pendingMessage])

    try {
      const response = await askQuestionMutation.mutateAsync({
        analysisId: analysis.id,
        question: question.trim(),
        context: analysisContext,
      })

      // Update assistant message with response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: response.answer,
                sources: response.sources,
                confidence: response.confidence,
              }
            : msg
        )
      )
    } catch (err) {
      console.error('[QASection] Question failed:', err)
      // Update message to show error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: 'Sorry, I encountered an error while processing your question. Please try again.',
                error: true,
              }
            : msg
        )
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendQuestion(inputValue)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    handleSendQuestion(question)
  }

  const handleCopyConversation = () => {
    const conversationText = messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'You' : 'Assistant'
        const timestamp = msg.timestamp.toLocaleTimeString()
        return `[${timestamp}] ${role}: ${msg.content}`
      })
      .join('\n\n')

    const fullText = `Content Intelligence Q&A Conversation
URL: ${analysis.url}
Title: ${analysis.title || 'Untitled'}
Date: ${new Date().toLocaleDateString()}

---

${conversationText}`

    copyToClipboard(fullText)
  }

  const handleClearConversation = () => {
    setMessages([])
  }

  const isPending = askQuestionMutation.isPending

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Ask Questions
            </CardTitle>
            <CardDescription>
              Ask questions about the analyzed content and get AI-powered answers
            </CardDescription>
          </div>
          {messages.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyConversation}
                disabled={copied}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearConversation}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Suggested Questions (shown when no messages) */}
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>Suggested questions to get started:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80 transition-colors py-2 px-3"
                  onClick={() => handleSuggestedQuestion(question)}
                >
                  {question}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Messages Area */}
        {messages.length > 0 && (
          <ScrollArea
            ref={scrollAreaRef}
            className="h-[400px] rounded-lg border bg-muted/30 p-4"
          >
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : message.error
                          ? 'bg-destructive/10 border border-destructive/20'
                          : 'bg-card border'
                    }`}
                  >
                    {/* Message content */}
                    {message.content ? (
                      <>
                        {message.error && (
                          <div className="flex items-center gap-2 text-destructive mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Error</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {/* Confidence badge */}
                        {message.confidence !== undefined && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Confidence: {Math.round(message.confidence * 100)}%
                            </Badge>
                          </div>
                        )}
                        {/* Sources */}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                            <ul className="text-xs space-y-1">
                              {message.sources.map((source, idx) => (
                                <li key={idx} className="text-muted-foreground">
                                  {source}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      // Loading state
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    )}
                    {/* Timestamp */}
                    <p className="text-xs text-muted-foreground mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Input Area */}
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this content..."
            disabled={isPending}
            className="flex-1"
          />
          <Button
            onClick={() => handleSendQuestion(inputValue)}
            disabled={!inputValue.trim() || isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Context indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {analysis.word_count?.toLocaleString() || 0} words
          </Badge>
          <span>|</span>
          <span>Answers based on analyzed content</span>
        </div>
      </CardContent>
    </Card>
  )
}
