import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FileText, ExternalLink, Calendar, Hash, Users, MapPin, Building,
  Target, Brain, TrendingUp, Shield, Network, Loader2, Search, Filter
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useTranslation } from 'react-i18next'

interface ContentItem {
  id: number
  url: string
  title?: string
  summary?: string
  domain?: string
  created_at: string
  word_count?: number
  entities?: {
    people?: string[]
    organizations?: string[]
    locations?: string[]
  }
  from_cache?: boolean
}

export function ContentLibraryPage() {
  const { t } = useTranslation(['contentLibrary'])
  const navigate = useNavigate()
  const { toast } = useToast()

  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState<string>('')

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async () => {
    setLoading(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const workspaceId = localStorage.getItem('omnicore_workspace_id') || '1'

      const headers: HeadersInit = {
        'X-Workspace-ID': workspaceId
      }

      if (userHash && userHash !== 'guest') {
        headers['X-User-Hash'] = userHash
      }

      const response = await fetch('/api/content-library', { headers })

      if (response.ok) {
        const data = await response.json()
        setContent(data.content || [])
      } else {
        toast({ title: t('common:error'), description: t('contentLibrary:alerts.loadFailed'), variant: 'destructive' })
      }
    } catch (error) {
      console.error('Failed to load content:', error)
      toast({ title: t('common:error'), description: t('contentLibrary:alerts.loadFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const suggestFrameworks = (item: ContentItem): Array<{ name: string, icon: any, path: string, reason: string }> => {
    const suggestions = []
    const entities = item.entities || {}
    const hasPeople = entities.people && entities.people.length > 0
    const hasOrgs = entities.organizations && entities.organizations.length > 0
    const hasLocations = entities.locations && entities.locations.length > 0

    // PMESII-PT - good for geopolitical/environmental analysis
    if (hasLocations || hasOrgs) {
      suggestions.push({
        name: 'PMESII-PT',
        icon: TrendingUp,
        path: '/dashboard/analysis-frameworks/pmesii-pt',
        reason: t('contentLibrary:frameworkReasons.pmesii')
      })
    }

    // COG - good when actors/organizations mentioned
    if (hasPeople || hasOrgs) {
      suggestions.push({
        name: 'Center of Gravity',
        icon: Target,
        path: '/dashboard/analysis-frameworks/cog',
        reason: t('contentLibrary:frameworkReasons.cog')
      })
    }

    // Network Analysis - good when multiple entities
    const entityCount = (entities.people?.length || 0) + (entities.organizations?.length || 0)
    if (entityCount >= 3) {
      suggestions.push({
        name: 'Network Analysis',
        icon: Network,
        path: '/dashboard/network',
        reason: t('contentLibrary:frameworkReasons.network')
      })
    }

    // Deception - good for claims/allegations
    if (item.summary?.toLowerCase().includes('claim') || item.summary?.toLowerCase().includes('alleges')) {
      suggestions.push({
        name: 'Deception Detection',
        icon: Shield,
        path: '/dashboard/analysis-frameworks/deception',
        reason: t('contentLibrary:frameworkReasons.deception')
      })
    }

    // Default suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        name: 'SWOT',
        icon: Brain,
        path: '/dashboard/analysis-frameworks/swot-dashboard',
        reason: t('contentLibrary:frameworkReasons.swot')
      })
    }

    return suggestions.slice(0, 3) // Limit to top 3
  }

  const filteredContent = content.filter(item => {
    const matchesSearch = !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.url.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesDomain = !domainFilter || item.domain === domainFilter

    return matchesSearch && matchesDomain
  })

  const uniqueDomains = Array.from(new Set(content.map(c => c.domain).filter(Boolean)))

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          {t('contentLibrary:title')}
        </h1>
        <p className="text-muted-foreground">
          {t('contentLibrary:description')}
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t('contentLibrary:filters.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="">{t('contentLibrary:filters.allDomains')}</option>
            {uniqueDomains.map(domain => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={loadContent}>
            <Filter className="h-4 w-4 mr-2" />
            {t('contentLibrary:filters.refresh')}
          </Button>
        </div>
      </Card>

      {/* Content List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filteredContent.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('contentLibrary:empty.title')}</h3>
          <p className="text-muted-foreground mb-4">
            {t('contentLibrary:empty.description')}
          </p>
          <Button onClick={() => navigate('/dashboard/tools/content-intelligence')}>
            <Search className="h-4 w-4 mr-2" />
            {t('contentLibrary:empty.button')}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredContent.map((item) => {
            const frameworks = suggestFrameworks(item)
            const entities = item.entities || {}

            return (
              <Card key={item.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  {/* Header */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-xl font-semibold line-clamp-2">
                        {item.title || t('contentLibrary:card.untitled')}
                      </h3>
                      {item.from_cache && (
                        <Badge variant="secondary" className="shrink-0">
                          <Hash className="h-3 w-3 mr-1" />
                          {t('contentLibrary:card.cached')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-blue-600 truncate max-w-md"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {item.domain || new URL(item.url).hostname}
                      </a>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {item.word_count && (
                        <span>{item.word_count.toLocaleString()} {t('contentLibrary:card.words')}</span>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  {item.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {item.summary}
                    </p>
                  )}

                  {/* Entities */}
                  {(entities.people?.length || entities.organizations?.length || entities.locations?.length) ? (
                    <div className="flex flex-wrap gap-2">
                      {entities.people?.slice(0, 3).map((person, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {person}
                        </Badge>
                      ))}
                      {entities.organizations?.slice(0, 3).map((org, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <Building className="h-3 w-3 mr-1" />
                          {org}
                        </Badge>
                      ))}
                      {entities.locations?.slice(0, 3).map((loc, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          {loc}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {/* Framework Suggestions */}
                  <div className="border-t pt-4">
                    <div className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      {t('contentLibrary:card.frameworks')}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {frameworks.map((fw, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            // Store content ID for framework to reference
                            localStorage.setItem('source_content_id', item.id.toString())
                            navigate(fw.path)
                          }}
                          className="text-left p-3 rounded-lg border hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <fw.icon className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-sm">{fw.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{fw.reason}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}