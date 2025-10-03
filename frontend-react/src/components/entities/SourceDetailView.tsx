import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Database, Shield, AlertCircle, CheckCircle, Globe, FileText, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import type { Source } from '@/types/entities'

interface SourceDetailViewProps {
  source: Source
  onEdit: () => void
  onDelete: () => void
}

export function SourceDetailView({ source, onEdit, onDelete }: SourceDetailViewProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  const getSourceTypeIcon = (type: string) => {
    const icons = {
      PERSON: '👤',
      DOCUMENT: '📄',
      WEBSITE: '🌐',
      DATABASE: '🗄️',
      MEDIA: '📺',
      SYSTEM: '💻',
      ORGANIZATION: '🏢',
      OTHER: '❓'
    }
    return icons[type as keyof typeof icons] || icons.OTHER
  }

  const getSourceTypeBadge = (type: string) => {
    const colors = {
      PERSON: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      DOCUMENT: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      WEBSITE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      DATABASE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      MEDIA: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      SYSTEM: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      ORGANIZATION: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    }
    return colors[type as keyof typeof colors] || colors.OTHER
  }

  const getReliabilityInfo = (reliability: string) => {
    const info = {
      'A': { label: 'Completely Reliable', color: 'green', score: 100 },
      'B': { label: 'Usually Reliable', color: 'blue', score: 83 },
      'C': { label: 'Fairly Reliable', color: 'yellow', score: 67 },
      'D': { label: 'Not Usually Reliable', color: 'orange', score: 50 },
      'E': { label: 'Unreliable', color: 'red', score: 33 },
      'F': { label: 'Cannot Be Judged', color: 'gray', score: 0 }
    }
    return info[reliability as keyof typeof info] || info['F']
  }

  const getAccessLevelInfo = (accessLevel: string) => {
    const info = {
      'EXCLUSIVE': { label: 'Exclusive Access', color: 'green', score: 100 },
      'LIMITED': { label: 'Limited Access', color: 'blue', score: 75 },
      'SHARED': { label: 'Shared Access', color: 'yellow', score: 50 },
      'OPEN': { label: 'Open Access', color: 'orange', score: 25 }
    }
    return info[accessLevel as keyof typeof info] || info['OPEN']
  }

  const getRiskColorClasses = (color: string) => {
    const colors = {
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  const reliabilityInfo = source.moses_assessment ? getReliabilityInfo(source.moses_assessment.reliability) : null
  const accessLevelInfo = source.moses_assessment ? getAccessLevelInfo(source.moses_assessment.access_level) : null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard/entities/sources')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sources
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">{getSourceTypeIcon(source.type)}</span>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{source.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getSourceTypeBadge(source.type)}>{source.type}</Badge>
                  {reliabilityInfo && (
                    <Badge className={getRiskColorClasses(reliabilityInfo.color)}>
                      Reliability: {source.moses_assessment!.reliability}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="moses">MOSES Assessment</TabsTrigger>
          <TabsTrigger value="evidence">Linked Evidence</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Information */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {source.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</h3>
                    <p className="text-gray-600 dark:text-gray-400">{source.description}</p>
                  </div>
                )}

                {source.source_type && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Source Type</h3>
                    <p className="text-gray-600 dark:text-gray-400">{source.source_type}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reliabilityInfo && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Reliability Grade</div>
                    <div className="text-2xl font-bold">{source.moses_assessment!.reliability}</div>
                    <div className="text-xs text-gray-600">{reliabilityInfo.label}</div>
                  </div>
                )}
                {accessLevelInfo && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Access Level</div>
                    <div className="text-2xl font-bold">{source.moses_assessment!.access_level}</div>
                    <div className="text-xs text-gray-600">{accessLevelInfo.label}</div>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Linked Evidence</span>
                  <Badge variant="secondary">{(source as any)._evidence_count || 0}</Badge>
                </div>
                <Separator />
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Created: {new Date(source.created_at).toLocaleDateString()}</div>
                  <div>Updated: {new Date(source.updated_at).toLocaleDateString()}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MOSES Assessment Tab */}
        <TabsContent value="moses" className="space-y-6">
          {source.moses_assessment ? (
            <>
              {/* Overall Assessment Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-l-4 border-l-blue-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Source Reliability
                    </CardTitle>
                    <CardDescription>NATO intelligence standard (A-F scale)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-4xl font-bold">{source.moses_assessment.reliability}</span>
                        {reliabilityInfo && (
                          <Badge className={getRiskColorClasses(reliabilityInfo.color)}>
                            {reliabilityInfo.label}
                          </Badge>
                        )}
                      </div>
                      {reliabilityInfo && (
                        <Progress value={reliabilityInfo.score} className="h-3" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Access Level
                    </CardTitle>
                    <CardDescription>Exclusive, Limited, Shared, or Open</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{source.moses_assessment.access_level}</span>
                        {accessLevelInfo && (
                          <Badge className={getRiskColorClasses(accessLevelInfo.color)}>
                            {accessLevelInfo.label}
                          </Badge>
                        )}
                      </div>
                      {accessLevelInfo && (
                        <Progress value={accessLevelInfo.score} className="h-3" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Manipulation Assessment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Source Vulnerability</CardTitle>
                    <CardDescription>Susceptibility to manipulation (0-5 scale)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-3xl font-bold">{source.moses_assessment.source_vulnerability}</span>
                        <span className="text-gray-500">/5</span>
                      </div>
                      <Progress value={(source.moses_assessment.source_vulnerability / 5) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Manipulation Evidence</CardTitle>
                    <CardDescription>Detected manipulation indicators (0-5 scale)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-3xl font-bold">{source.moses_assessment.manipulation_evidence}</span>
                        <span className="text-gray-500">/5</span>
                      </div>
                      <Progress value={(source.moses_assessment.manipulation_evidence / 5) * 100} className="h-2 bg-red-200" />
                      {source.moses_assessment.manipulation_evidence >= 3 && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertCircle className="h-4 w-4" />
                          High manipulation detected
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Assessment Notes */}
              {source.moses_assessment.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Assessment Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {source.moses_assessment.notes}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No MOSES assessment available</p>
                <Button onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Add MOSES Assessment
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Linked Evidence Tab */}
        <TabsContent value="evidence" className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <LinkIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Linked evidence display coming soon</p>
              <p className="text-sm text-gray-400 mt-2">
                View all evidence items sourced from this source
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
