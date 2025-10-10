/**
 * Framework Usage Panel
 * Shows where an entity (actor, source, event, place) is used across frameworks
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, Target, TrendingUp, BarChart3, FileText, ExternalLink } from 'lucide-react'
import type { EntityType } from './EntitySelector'

interface FrameworkUsage {
  id: string
  type: 'ach' | 'cog' | 'swot' | 'pest' | 'dime' | 'comb' | 'other'
  title: string
  role?: string // How the entity is used in the framework
  created_at: string
  url?: string
}

interface FrameworkUsagePanelProps {
  entityId: string
  entityType: EntityType
  entityName: string
}

const FRAMEWORK_ICONS: Record<string, any> = {
  ach: FileText,
  cog: Target,
  swot: TrendingUp,
  pest: BarChart3,
  dime: Brain,
  comb: Brain,
  other: Brain
}

const FRAMEWORK_NAMES: Record<string, string> = {
  ach: 'Analysis of Competing Hypotheses',
  cog: 'Center of Gravity',
  swot: 'SWOT Analysis',
  pest: 'PEST Analysis',
  dime: 'DIME Framework',
  comb: 'COM-B Analysis',
  other: 'Framework'
}

export function FrameworkUsagePanel({ entityId, entityType, entityName }: FrameworkUsagePanelProps) {
  const navigate = useNavigate()
  const [usage, setUsage] = useState<FrameworkUsage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFrameworkUsage()
  }, [entityId, entityType])

  const loadFrameworkUsage = async () => {
    setLoading(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch(
        `/api/frameworks/entity-usage?entity_id=${entityId}&entity_type=${entityType}`,
        {
          headers: {
            ...(userHash && { 'Authorization': `Bearer ${userHash}` })
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load framework usage')
      }

      const data = await response.json()
      setUsage(data.frameworks || [])
    } catch (error) {
      console.error('Error loading framework usage:', error)
      setUsage([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Framework Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (usage.length === 0) {
    return null // Don't show if not used in any frameworks
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Used in {usage.length} Framework{usage.length !== 1 ? 's' : ''}
        </CardTitle>
        <CardDescription>
          {entityName} is referenced in the following analyses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {usage.map((framework) => {
          const Icon = FRAMEWORK_ICONS[framework.type] || Brain
          const frameworkName = FRAMEWORK_NAMES[framework.type] || 'Framework'

          return (
            <div
              key={framework.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 rounded-md bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{framework.title}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{frameworkName}</span>
                    {framework.role && (
                      <>
                        <span>•</span>
                        <Badge variant="outline" className="text-xs">
                          {framework.role}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (framework.url) {
                    navigate(framework.url)
                  } else {
                    // Fallback navigation based on framework type
                    const urls: Record<string, string> = {
                      ach: `/dashboard/analysis-frameworks/ach-dashboard/${framework.id}`,
                      cog: `/dashboard/analysis-frameworks/cog/${framework.id}`,
                      swot: `/dashboard/analysis-frameworks/swot-dashboard/${framework.id}`,
                    }
                    navigate(urls[framework.type] || '/dashboard')
                  }
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
