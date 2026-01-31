// src/components/content-intelligence/WordCloudSection.tsx
import { useMemo, useCallback } from 'react'
import html2canvas from 'html2canvas'
import { BarChart3, Download, Image } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { useAnalysisStore } from '@/hooks/content-intelligence'
import type { ContentAnalysis } from '@/types/content-intelligence'

// Color palette for word cloud badges with hover effects
const WORD_COLORS = [
  'text-blue-600 dark:text-blue-400',
  'text-purple-600 dark:text-purple-400',
  'text-green-600 dark:text-green-400',
  'text-orange-600 dark:text-orange-400',
  'text-pink-600 dark:text-pink-400',
  'text-indigo-600 dark:text-indigo-400',
  'text-teal-600 dark:text-teal-400',
  'text-red-600 dark:text-red-400',
]

interface WordCloudSectionProps {
  analysis: ContentAnalysis
}

// Entity with explicit type for the word cloud display
interface EntityWithType {
  name: string
  count: number
  contexts: string[]
  type: 'person' | 'organization' | 'location'
}

export function WordCloudSection({ analysis }: WordCloudSectionProps) {
  const { toast } = useToast()
  const wordCloudView = useAnalysisStore((state) => state.wordCloudView)
  const setWordCloudView = useAnalysisStore((state) => state.setWordCloudView)

  // Memoize expensive word frequency calculations
  const wordData = useMemo(() => {
    // Single words - filter to only single words (no spaces), sort by frequency
    const singleWords = Object.entries(analysis.word_frequency || {})
      .filter(([word]) => !word.includes(' ') && word.length > 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30)

    // Phrases - only multi-word phrases from top_phrases
    const phrases = (analysis.top_phrases || [])
      .filter((item) => item.phrase.includes(' '))
      .slice(0, 10)

    // Entities - combine people, organizations, and locations
    const allEntities: EntityWithType[] = [
      ...(analysis.entities?.people || []).map((e) => ({ ...e, type: 'person' as const })),
      ...(analysis.entities?.organizations || []).map((e) => ({ ...e, type: 'organization' as const })),
      ...(analysis.entities?.locations || []).map((e) => ({ ...e, type: 'location' as const })),
    ]
    const topEntities = allEntities.sort((a, b) => b.count - a.count).slice(0, 10)

    return {
      singleWords,
      phrases,
      topEntities,
      maxWordCount: singleWords.length > 0 ? Math.max(...singleWords.map(([, c]) => c)) : 1,
      maxPhraseCount: phrases.length > 0 ? Math.max(...phrases.map((p) => p.count)) : 1,
      maxEntityCount: topEntities.length > 0 ? Math.max(...topEntities.map((e) => e.count)) : 1,
    }
  }, [analysis.word_frequency, analysis.top_phrases, analysis.entities])

  // Export word cloud as image
  const exportWordCloud = useCallback(
    async (format: 'png' | 'jpeg', includeMetadata: boolean) => {
      const container = document.getElementById('word-cloud-container')
      if (!container || !analysis) {
        toast({
          title: 'Error',
          description: 'Word cloud not found',
          variant: 'destructive',
        })
        return
      }

      try {
        // Create a wrapper div with metadata if requested
        const exportContainer = document.createElement('div')
        exportContainer.style.padding = '40px'
        exportContainer.style.background = 'white'
        exportContainer.style.width = 'fit-content'
        exportContainer.style.maxWidth = '1200px'

        if (includeMetadata) {
          const metadata = document.createElement('div')
          metadata.style.marginBottom = '20px'
          metadata.style.color = '#000'
          metadata.innerHTML = `
            <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">${wordCloudView.charAt(0).toUpperCase() + wordCloudView.slice(1)} Word Cloud</h2>
            <p style="font-size: 14px; color: #666; margin-bottom: 4px;"><strong>Source:</strong> ${analysis.title || 'Untitled'}</p>
            <p style="font-size: 14px; color: #666;"><strong>URL:</strong> ${analysis.url}</p>
          `
          exportContainer.appendChild(metadata)
        }

        // Clone the word cloud container
        const clone = container.cloneNode(true) as HTMLElement
        clone.removeAttribute('id')
        exportContainer.appendChild(clone)

        // Temporarily add to DOM for rendering (position off-screen)
        exportContainer.style.position = 'absolute'
        exportContainer.style.left = '-9999px'
        exportContainer.style.top = '-9999px'
        document.body.appendChild(exportContainer)

        // Strip Tailwind classes and apply plain RGB colors
        const stripTailwindAndApplyRgb = (element: HTMLElement) => {
          const computedStyle = window.getComputedStyle(element)
          const color = computedStyle.color
          const backgroundColor = computedStyle.backgroundColor
          const fontSize = computedStyle.fontSize
          const fontWeight = computedStyle.fontWeight
          const opacity = computedStyle.opacity

          element.className = ''

          if (color && !color.includes('oklch')) {
            element.style.color = color
          } else if (color) {
            element.style.color = 'rgb(0, 0, 0)'
          }

          if (backgroundColor && !backgroundColor.includes('oklch') && backgroundColor !== 'rgba(0, 0, 0, 0)') {
            element.style.backgroundColor = backgroundColor
          }

          element.style.fontSize = fontSize
          element.style.fontWeight = fontWeight
          element.style.opacity = opacity

          Array.from(element.children).forEach((child) => {
            if (child instanceof HTMLElement) {
              stripTailwindAndApplyRgb(child)
            }
          })
        }

        stripTailwindAndApplyRgb(clone)

        // Replace the gradient background with plain colors
        clone.style.background = 'linear-gradient(135deg, rgb(239, 246, 255) 0%, rgb(250, 245, 255) 100%)'
        clone.style.borderRadius = '8px'
        clone.style.padding = '32px'
        clone.style.minHeight = '300px'
        clone.style.display = 'flex'
        clone.style.flexWrap = 'wrap'
        clone.style.alignItems = 'center'
        clone.style.justifyContent = 'center'
        clone.style.gap = '16px'

        exportContainer.style.setProperty('background-color', '#ffffff', 'important')

        // Capture as canvas
        const canvas = await html2canvas(exportContainer, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
        })

        document.body.removeChild(exportContainer)

        // Convert to blob and download
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              toast({
                title: 'Error',
                description: 'Failed to create image blob',
                variant: 'destructive',
              })
              return
            }
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            const viewName = wordCloudView.charAt(0).toUpperCase() + wordCloudView.slice(1)
            link.download = `wordcloud-${viewName}-${new Date().getTime()}.${format}`
            link.href = url
            link.click()
            URL.revokeObjectURL(url)

            toast({
              title: 'Success',
              description: `Word cloud exported as ${format.toUpperCase()}`,
            })
          },
          `image/${format}`,
          0.95
        )
      } catch (error) {
        toast({
          title: 'Error',
          description: `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'destructive',
        })
      }
    },
    [analysis, wordCloudView, toast]
  )

  // Calculate font size based on count relative to max
  const calculateFontSize = (count: number, maxCount: number, minSize: number, maxSize: number) => {
    return minSize + (count / maxCount) * (maxSize - minSize)
  }

  // Get color class for entity type
  const getEntityColorClass = (type: 'person' | 'organization' | 'location') => {
    switch (type) {
      case 'person':
        return 'text-blue-600 dark:text-blue-400'
      case 'organization':
        return 'text-green-600 dark:text-green-400'
      case 'location':
        return 'text-orange-600 dark:text-orange-400'
    }
  }

  // Get type label for entity
  const getEntityTypeLabel = (type: 'person' | 'organization' | 'location') => {
    switch (type) {
      case 'person':
        return 'Person'
      case 'organization':
        return 'Organization'
      case 'location':
        return 'Location'
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          Word Cloud
        </h3>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={wordCloudView === 'words' ? 'default' : 'outline'}
              onClick={() => setWordCloudView('words')}
            >
              Words
            </Button>
            <Button
              size="sm"
              variant={wordCloudView === 'phrases' ? 'default' : 'outline'}
              onClick={() => setWordCloudView('phrases')}
            >
              Phrases
            </Button>
            <Button
              size="sm"
              variant={wordCloudView === 'entities' ? 'default' : 'outline'}
              onClick={() => setWordCloudView('entities')}
            >
              Entities
            </Button>
          </div>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Image className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Word Cloud</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => exportWordCloud('png', false)}>
                <Download className="h-4 w-4 mr-2" />
                PNG (Image only)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportWordCloud('png', true)}>
                <Download className="h-4 w-4 mr-2" />
                PNG (With title & URL)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => exportWordCloud('jpeg', false)}>
                <Download className="h-4 w-4 mr-2" />
                JPEG (Image only)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportWordCloud('jpeg', true)}>
                <Download className="h-4 w-4 mr-2" />
                JPEG (With title & URL)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Word Cloud Container */}
      <div
        className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-8 min-h-[300px] flex flex-wrap items-center justify-center gap-4"
        id="word-cloud-container"
      >
        {/* Words View */}
        {wordCloudView === 'words' &&
          (wordData.singleWords.length === 0 ? (
            <p className="text-muted-foreground italic">No single words found in analysis</p>
          ) : (
            wordData.singleWords.slice(0, 10).map(([word, count], index) => {
              const fontSize = calculateFontSize(count, wordData.maxWordCount, 20, 56)
              const colorClass = WORD_COLORS[index % WORD_COLORS.length]

              return (
                <span
                  key={word}
                  className={`font-bold ${colorClass} hover:scale-110 transition-transform cursor-default select-none`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.3 }}
                  title={`${word}: ${count} times`}
                >
                  {word}
                </span>
              )
            })
          ))}

        {/* Phrases View */}
        {wordCloudView === 'phrases' &&
          (wordData.phrases.length === 0 ? (
            <p className="text-muted-foreground italic">No phrases found in analysis</p>
          ) : (
            wordData.phrases.map((item, index) => {
              const fontSize = calculateFontSize(item.count, wordData.maxPhraseCount, 16, 48)
              const colorClass = WORD_COLORS[index % WORD_COLORS.length]

              return (
                <span
                  key={index}
                  className={`font-bold ${colorClass} hover:scale-110 transition-transform cursor-default select-none text-center`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.3 }}
                  title={`${item.phrase}: ${item.count} times`}
                >
                  {item.phrase}
                </span>
              )
            })
          ))}

        {/* Entities View */}
        {wordCloudView === 'entities' &&
          (wordData.topEntities.length === 0 ? (
            <p className="text-muted-foreground italic">No entities found in analysis</p>
          ) : (
            wordData.topEntities.map((entity) => {
              const fontSize = calculateFontSize(entity.count, wordData.maxEntityCount, 18, 52)
              const colorClass = getEntityColorClass(entity.type)
              const typeLabel = getEntityTypeLabel(entity.type)

              return (
                <span
                  key={`${entity.type}-${entity.name}`}
                  className={`font-bold ${colorClass} hover:scale-110 transition-transform cursor-default select-none`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.3 }}
                  title={`${entity.name} (${typeLabel}): ${entity.count} mentions`}
                >
                  {entity.name}
                </span>
              )
            })
          ))}
      </div>

      {/* Legend and description */}
      {wordCloudView === 'entities' ? (
        <div className="flex items-center justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-400"></div>
            <span className="text-muted-foreground">People</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-600 dark:bg-green-400"></div>
            <span className="text-muted-foreground">Organizations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-600 dark:bg-orange-400"></div>
            <span className="text-muted-foreground">Locations</span>
          </div>
        </div>
      ) : wordCloudView === 'phrases' ? (
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-center flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-400"></div>
              <span className="text-muted-foreground">Rank 1-2</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-purple-600 dark:bg-purple-400"></div>
              <span className="text-muted-foreground">Rank 3-4</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-600 dark:bg-green-400"></div>
              <span className="text-muted-foreground">Rank 5-6</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-orange-600 dark:bg-orange-400"></div>
              <span className="text-muted-foreground">Rank 7-8</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-pink-600 dark:bg-pink-400"></div>
              <span className="text-muted-foreground">Rank 9-10</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">Top 10 most common phrases (size = frequency)</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Top 10 most frequent single words (size = frequency)
        </p>
      )}
    </Card>
  )
}

export default WordCloudSection
