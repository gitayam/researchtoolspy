'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Upload, Download, Tag, Clock, Shield, Globe, FileText, Link, Image, Video, Music, MessageSquare, Mail, FileBarChart, MoreHorizontal, Trash2, Edit, Copy, Archive, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Evidence, EvidenceType, EvidenceStatus, CredibilityLevel, EvidenceFilter, EvidenceStatistics } from '@/types/evidence'
import { cn } from '@/lib/utils'

// Mock data for development
const mockEvidence: Evidence[] = [],
    source: {
      name: 'Internal Research Team',
      date: new Date('2024-01-15'),
      organization: 'Research Division',
      credibility: CredibilityLevel.VERY_HIGH
    },
    metadata: {
      collectionDate: new Date('2024-01-15'),
      collectionMethod: 'Primary research and data analysis'
    },
    sats_evaluation: {
      reliability: 5,
      credibility: 5,
      validity: 4,
      relevance: 5,
      significance: 4,
      timeliness: 5,
      accuracy: 4,
      completeness: 4,
      overall_score: 4.5,
      evaluation_date: new Date('2024-01-16'),
      evaluator: 'Senior Analyst'
    },
    frameworks: [
      { framework_type: 'SWOT', framework_id: 'swot-1', usage_context: 'Competitive threats analysis' },
      { framework_type: 'ACH', framework_id: 'ach-2', usage_context: 'Hypothesis validation' }
    ],
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-16'),
    created_by: 'analyst_1',
    version: 1,
    key_points: [
      'Market share increased by 15%',
      'New competitor entered the market',
      'Technology disruption accelerating'
    ]
  },
  {
    id: '2',
    title: 'Social Media Sentiment Analysis',
    description: 'Analysis of public sentiment from Twitter and LinkedIn regarding recent product launch',
    content: 'Social media monitoring results...',
    type: EvidenceType.SOCIAL_MEDIA,
    status: EvidenceStatus.VERIFIED,
    tags: ['social', 'sentiment', 'product-launch', 'public-opinion'],
    source: {
      name: 'Social Media Analytics Platform',
      url: 'https://analytics.example.com',
      date: new Date('2024-01-10'),
      credibility: CredibilityLevel.MODERATE
    },
    metadata: {
      collectionDate: new Date('2024-01-10'),
      collectionMethod: 'Automated social media scraping and NLP analysis'
    },
    frameworks: [
      { framework_type: 'DIME', framework_id: 'dime-1', usage_context: 'Information operations assessment' }
    ],
    created_at: new Date('2024-01-10'),
    updated_at: new Date('2024-01-10'),
    created_by: 'analyst_2',
    version: 1
  },
  {
    id: '3',
    title: 'Leaked Internal Memo',
    description: 'Unverified internal communication from competitor organization',
    content: 'Internal memo content...',
    type: EvidenceType.DOCUMENT,
    status: EvidenceStatus.DISPUTED,
    tags: ['leak', 'unverified', 'competitor', 'sensitive'],
    source: {
      name: 'Anonymous Source',
      date: new Date('2024-01-20'),
      credibility: CredibilityLevel.LOW
    },
    metadata: {
      collectionDate: new Date('2024-01-20'),
      collectionMethod: 'Anonymous submission',
      classification: 'SENSITIVE',
      handling_instructions: 'Verify authenticity before use'
    },
    frameworks: [],
    created_at: new Date('2024-01-20'),
    updated_at: new Date('2024-01-20'),
    created_by: 'analyst_3',
    version: 1,
    contradictions: ['Conflicts with public statements', 'Timeline inconsistencies noted']
  }
]

const mockStats: EvidenceStatistics = {
  total_count: 0,
  by_type: {
    [EvidenceType.DOCUMENT]: 0,
    [EvidenceType.URL]: 0,
    [EvidenceType.REPORT]: 0,
    [EvidenceType.SOCIAL_MEDIA]: 0,
    [EvidenceType.IMAGE]: 0,
    [EvidenceType.VIDEO]: 0,
    [EvidenceType.EMAIL]: 0,
    [EvidenceType.AUDIO]: 0,
    [EvidenceType.TEXT]: 0,
    [EvidenceType.OTHER]: 0
  },
  by_status: {
    [EvidenceStatus.VERIFIED]: 0,
    [EvidenceStatus.DRAFT]: 0,
    [EvidenceStatus.DISPUTED]: 0,
    [EvidenceStatus.ARCHIVED]: 0
  },
  by_credibility: {
    [CredibilityLevel.VERY_HIGH]: 0,
    [CredibilityLevel.HIGH]: 0,
    [CredibilityLevel.MODERATE]: 0,
    [CredibilityLevel.LOW]: 0,
    [CredibilityLevel.VERY_LOW]: 0,
    [CredibilityLevel.UNKNOWN]: 0
  },
  recent_additions: 0,
  pending_evaluation: 0,
  expiring_soon: 0,
  most_used_tags: [],
  framework_usage: []
},
  by_status: {
    [EvidenceStatus.VERIFIED]: 89,
    [EvidenceStatus.DRAFT]: 34,
    [EvidenceStatus.DISPUTED]: 12,
    [EvidenceStatus.ARCHIVED]: 21
  },
  by_credibility: {
    [CredibilityLevel.VERY_HIGH]: 23,
    [CredibilityLevel.HIGH]: 45,
    [CredibilityLevel.MODERATE]: 52,
    [CredibilityLevel.LOW]: 18,
    [CredibilityLevel.VERY_LOW]: 5,
    [CredibilityLevel.UNKNOWN]: 13
  },
  recent_additions: 12,
  pending_evaluation: 27,
  expiring_soon: 3,
  most_used_tags: [
    { tag: 'market', count: 34 },
    { tag: 'competitor', count: 28 },
    { tag: 'financial', count: 23 },
    { tag: 'strategic', count: 19 },
    { tag: 'verified', count: 17 }
  ],
  framework_usage: [
    { framework: 'SWOT', count: 45 },
    { framework: 'ACH', count: 38 },
    { framework: 'DIME', count: 22 },
    { framework: 'COG', count: 18 }
  ]
}

const typeIcons: Record<EvidenceType, React.ReactNode> = {
  [EvidenceType.DOCUMENT]: <FileText className="h-4 w-4" />,
  [EvidenceType.URL]: <Link className="h-4 w-4" />,
  [EvidenceType.IMAGE]: <Image className="h-4 w-4" />,
  [EvidenceType.VIDEO]: <Video className="h-4 w-4" />,
  [EvidenceType.AUDIO]: <Music className="h-4 w-4" />,
  [EvidenceType.TEXT]: <FileText className="h-4 w-4" />,
  [EvidenceType.SOCIAL_MEDIA]: <MessageSquare className="h-4 w-4" />,
  [EvidenceType.EMAIL]: <Mail className="h-4 w-4" />,
  [EvidenceType.REPORT]: <FileBarChart className="h-4 w-4" />,
  [EvidenceType.OTHER]: <FileText className="h-4 w-4" />
}

const statusIcons: Record<EvidenceStatus, React.ReactNode> = {
  [EvidenceStatus.VERIFIED]: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  [EvidenceStatus.DRAFT]: <Edit className="h-4 w-4 text-gray-500" />,
  [EvidenceStatus.DISPUTED]: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  [EvidenceStatus.ARCHIVED]: <Archive className="h-4 w-4 text-blue-500" />
}

const credibilityColors: Record<CredibilityLevel, string> = {
  [CredibilityLevel.VERY_HIGH]: 'bg-green-500',
  [CredibilityLevel.HIGH]: 'bg-green-400',
  [CredibilityLevel.MODERATE]: 'bg-yellow-500',
  [CredibilityLevel.LOW]: 'bg-orange-500',
  [CredibilityLevel.VERY_LOW]: 'bg-red-500',
  [CredibilityLevel.UNKNOWN]: 'bg-gray-400'
}

export default function EvidenceCollectorPage() {
  const [evidence, setEvidence] = useState<Evidence[]>(mockEvidence)
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [filter, setFilter] = useState<EvidenceFilter>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTab, setSelectedTab] = useState('all')
  const [stats] = useState<EvidenceStatistics>(mockStats)

  // Filter evidence based on current filters
  const filteredEvidence = evidence.filter(item => {
    if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !item.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (filter.types && filter.types.length > 0 && !filter.types.includes(item.type)) {
      return false
    }
    if (filter.status && filter.status.length > 0 && !filter.status.includes(item.status)) {
      return false
    }
    if (selectedTab === 'verified' && item.status !== EvidenceStatus.VERIFIED) {
      return false
    }
    if (selectedTab === 'pending' && item.status !== EvidenceStatus.DRAFT) {
      return false
    }
    if (selectedTab === 'disputed' && item.status !== EvidenceStatus.DISPUTED) {
      return false
    }
    return true
  })

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Evidence Collector</h1>
          <p className="text-muted-foreground mt-1">
            Collect, organize, and manage evidence for use across all analysis frameworks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Evidence
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats.recent_additions} this week
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.by_status[EvidenceStatus.VERIFIED]}
            </div>
            <Progress 
              value={(stats.by_status[EvidenceStatus.VERIFIED] / stats.total_count) * 100} 
              className="mt-2 h-1"
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending_evaluation}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires SATS assessment
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Credibility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.by_credibility[CredibilityLevel.VERY_HIGH] + stats.by_credibility[CredibilityLevel.HIGH]}
            </div>
            <div className="flex gap-1 mt-2">
              {Object.entries(credibilityColors).map(([level, color]) => (
                <div
                  key={level}
                  className={cn('h-1 flex-1 rounded', color)}
                  style={{
                    opacity: stats.by_credibility[level as CredibilityLevel] > 0 ? 1 : 0.2
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search evidence by title, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select onValueChange={(value) => setFilter({ ...filter, types: value ? [value as EvidenceType] : [] })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {Object.values(EvidenceType).map(type => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {typeIcons[type]}
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select onValueChange={(value) => setFilter({ ...filter, status: value ? [value as EvidenceStatus] : [] })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                {Object.values(EvidenceStatus).map(status => (
                  <SelectItem key={status} value={status}>
                    <div className="flex items-center gap-2">
                      {statusIcons[status]}
                      <span className="capitalize">{status}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Popular Tags */}
          <div className="flex gap-2 mt-4 items-center">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Popular:</span>
            {stats.most_used_tags.slice(0, 5).map(({ tag, count }) => (
              <Badge 
                key={tag} 
                variant="secondary" 
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => setSearchTerm(tag)}
              >
                {tag} ({count})
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Evidence List */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="all">All Evidence ({stats.total_count})</TabsTrigger>
          <TabsTrigger value="verified">
            Verified ({stats.by_status[EvidenceStatus.VERIFIED]})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({stats.by_status[EvidenceStatus.DRAFT]})
          </TabsTrigger>
          <TabsTrigger value="disputed">
            Disputed ({stats.by_status[EvidenceStatus.DISPUTED]})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value={selectedTab} className="mt-4">
          <div className="grid gap-4">
            {filteredEvidence.map((item) => (
              <Card 
                key={item.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedEvidence(item)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {typeIcons[item.type]}
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        {statusIcons[item.status]}
                      </div>
                      <CardDescription>{item.description}</CardDescription>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    {/* Metadata Row */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {item.source.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.metadata.collectionDate.toLocaleDateString()}
                      </div>
                      {item.source.credibility && (
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          <span className="capitalize">{item.source.credibility.replace('_', ' ')}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* SATS Score */}
                    {item.sats_evaluation && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">SATS Score:</span>
                        <Progress 
                          value={(item.sats_evaluation.overall_score / 5) * 100} 
                          className="flex-1 h-2"
                        />
                        <span className="text-sm font-bold">
                          {item.sats_evaluation.overall_score.toFixed(1)}/5.0
                        </span>
                      </div>
                    )}
                    
                    {/* Framework Usage */}
                    {item.frameworks.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Used in:</span>
                        {item.frameworks.map(fw => (
                          <Badge key={fw.framework_id} variant="secondary" className="text-xs">
                            {fw.framework_type}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Key Points or Issues */}
                    {item.key_points && item.key_points.length > 0 && (
                      <div className="border-l-2 border-green-500 pl-3">
                        <p className="text-sm font-medium mb-1">Key Points:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {item.key_points.slice(0, 2).map((point, idx) => (
                            <li key={idx}>• {point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {item.contradictions && item.contradictions.length > 0 && (
                      <div className="border-l-2 border-yellow-500 pl-3">
                        <p className="text-sm font-medium mb-1 text-yellow-600">Issues:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {item.contradictions.map((issue, idx) => (
                            <li key={idx}>• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}