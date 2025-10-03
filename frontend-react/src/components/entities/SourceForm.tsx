import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, AlertCircle } from 'lucide-react'
import type { Source, SourceType, SourceAccessLevel, SourceReliability } from '@/types/entities'

interface SourceFormProps {
  source?: Source
  onSubmit: (data: Partial<Source>) => Promise<void>
  onCancel: () => void
}

export function SourceForm({ source, onSubmit, onCancel }: SourceFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: source?.name || '',
    type: (source?.type || 'DOCUMENT') as SourceType,
    description: source?.description || '',
    source_type: source?.source_type || '',
    moses_assessment: source?.moses_assessment || {
      source_vulnerability: 0,
      manipulation_evidence: 0,
      access_level: 'OPEN' as SourceAccessLevel,
      reliability: 'F' as SourceReliability,
      notes: ''
    }
  })

  const calculateReliabilityScore = () => {
    const vulnScore = formData.moses_assessment.source_vulnerability
    const manipScore = formData.moses_assessment.manipulation_evidence
    const avgRisk = (vulnScore + manipScore) / 2

    if (avgRisk <= 1) return 'A'
    if (avgRisk <= 2) return 'B'
    if (avgRisk <= 3) return 'C'
    if (avgRisk <= 4) return 'D'
    return 'E'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const reliability = calculateReliabilityScore()
      await onSubmit({
        ...formData,
        moses_assessment: {
          ...formData.moses_assessment,
          reliability
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save source')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Identify and categorize the source</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Source Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Jane Doe, NY Times Article, CIA Report, whistleblower.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="type">Source Category *</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as SourceType })}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERSON">👤 Person - Human source, witness, informant</SelectItem>
                <SelectItem value="DOCUMENT">📄 Document - Reports, papers, files, records</SelectItem>
                <SelectItem value="WEBSITE">🌐 Website - Online sources, social media, blogs</SelectItem>
                <SelectItem value="DATABASE">🗄️ Database - Structured data repositories</SelectItem>
                <SelectItem value="MEDIA">📸 Media - Audio, video, images, recordings</SelectItem>
                <SelectItem value="SYSTEM">⚙️ System - Technical systems, sensors, equipment</SelectItem>
                <SelectItem value="ORGANIZATION">🏢 Organization - Companies, agencies, groups</SelectItem>
                <SelectItem value="OTHER">❓ Other - Miscellaneous sources</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="source_type">Specific Type/Role</Label>
            <Input
              id="source_type"
              value={formData.source_type}
              onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
              placeholder="e.g., Journalist, Whistleblower, Government Report, News Article"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the source and its capabilities"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* MOSES Assessment */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                MOSES Source Assessment
              </CardTitle>
              <CardDescription>My Own Sources Evaluation - assess source reliability</CardDescription>
            </div>
            <Badge className="bg-blue-100 text-blue-800">
              Reliability: {calculateReliabilityScore()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Source Vulnerability</Label>
                <Badge variant="outline">{formData.moses_assessment.source_vulnerability}/5</Badge>
              </div>
              <Slider
                value={[formData.moses_assessment.source_vulnerability]}
                onValueChange={([v]) => setFormData({
                  ...formData,
                  moses_assessment: {
                    ...formData.moses_assessment,
                    source_vulnerability: v
                  }
                })}
                min={0} max={5} step={1}
              />
              <p className="text-xs text-gray-500">How vulnerable is this source to compromise or manipulation? (0=Not vulnerable, 5=Highly vulnerable)</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Manipulation Evidence</Label>
                <Badge variant="outline">{formData.moses_assessment.manipulation_evidence}/5</Badge>
              </div>
              <Slider
                value={[formData.moses_assessment.manipulation_evidence]}
                onValueChange={([v]) => setFormData({
                  ...formData,
                  moses_assessment: {
                    ...formData.moses_assessment,
                    manipulation_evidence: v
                  }
                })}
                min={0} max={5} step={1}
              />
              <p className="text-xs text-gray-500">Evidence that this source has been manipulated (0=No evidence, 5=Strong evidence)</p>
            </div>

            <div>
              <Label htmlFor="access_level">Access Level</Label>
              <Select
                value={formData.moses_assessment.access_level}
                onValueChange={(v) => setFormData({
                  ...formData,
                  moses_assessment: {
                    ...formData.moses_assessment,
                    access_level: v as SourceAccessLevel
                  }
                })}
              >
                <SelectTrigger id="access_level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXCLUSIVE">🔒 Exclusive - Only we have access</SelectItem>
                  <SelectItem value="LIMITED">🔐 Limited - Small group access</SelectItem>
                  <SelectItem value="SHARED">🤝 Shared - Multiple parties access</SelectItem>
                  <SelectItem value="OPEN">🌐 Open - Publicly available</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              value={formData.moses_assessment.notes}
              onChange={(e) => setFormData({
                ...formData,
                moses_assessment: {
                  ...formData.moses_assessment,
                  notes: e.target.value
                }
              })}
              placeholder="Assessment notes and justification..."
              rows={3}
            />

            <div className="pt-2 border-t">
              <h4 className="text-sm font-semibold mb-2">NATO Reliability Scale (Auto-calculated)</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>A:</strong> Completely reliable (Risk score 0-1)</p>
                <p><strong>B:</strong> Usually reliable (Risk score 1-2)</p>
                <p><strong>C:</strong> Fairly reliable (Risk score 2-3)</p>
                <p><strong>D:</strong> Not usually reliable (Risk score 3-4)</p>
                <p><strong>E:</strong> Unreliable (Risk score 4-5)</p>
                <p><strong>F:</strong> Cannot be judged (Manual override)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : source ? 'Update Source' : 'Create Source'}
        </Button>
      </div>
    </form>
  )
}
