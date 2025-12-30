import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, FileText, Calendar, User, Building, Download, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ACHAnalysis } from '@/types/ach'
import { ACHMatrix } from '@/components/ach/ACHMatrix'
import { ACHAnalysisForm, type ACHFormData } from '@/components/ach/ACHAnalysisForm'
import { ACHShareButton } from '@/components/ach/ACHShareButton'
import { ACHVisualAnalytics } from '@/components/ach/ACHVisualAnalytics'
import { ACHPDFExport } from '@/components/ach/ACHPDFExport'
import { ACHPowerPointExport } from '@/components/ach/ACHPowerPointExport'
import { ACHExcelExport } from '@/components/ach/ACHExcelExport'
import { useTranslation } from 'react-i18next'

export function ACHAnalysisPage() {
  const { t } = useTranslation(['ach', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState<ACHAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [evidenceSelectorOpen, setEvidenceSelectorOpen] = useState(false)

  const loadAnalysis = async () => {
    if (!id) return

    try {
      setLoading(true)
      const response = await fetch(`/api/ach?id=${id}`)
      if (response.ok) {
        const data = await response.json()
        setAnalysis(data)
      } else {
        throw new Error('Analysis not found')
      }
    } catch (error) {
      console.error('Failed to load analysis:', error)
      alert(t('ach:alerts.loadFailed'))
      navigate('/dashboard/analysis-frameworks/ach-dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalysis()
  }, [id])

  const handleUpdateScore = async (
    hypothesisId: string,
    evidenceId: string,
    score: number,
    notes?: string
  ) => {
    if (!analysis) return

    try {
      await fetch('/api/ach/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ach_analysis_id: analysis.id,
          hypothesis_id: hypothesisId,
          evidence_id: evidenceId,
          score,
          notes
        })
      })

      await loadAnalysis()
    } catch (error) {
      console.error('Failed to update score:', error)
      alert(t('ach:alerts.scoreUpdateFailed'))
    }
  }

  const handleAddEvidence = () => {
    // For now, just navigate to evidence page
    // In future, could open a modal to select from existing evidence
    alert(t('ach:alerts.evidenceHint'))
    navigate('/dashboard/evidence')
  }

  const handleRemoveEvidence = async (linkId: string) => {
    if (!confirm(t('ach:alerts.removeEvidenceConfirm'))) return

    try {
      await fetch(`/api/ach/evidence?id=${linkId}`, {
        method: 'DELETE'
      })
      await loadAnalysis()
    } catch (error) {
      console.error('Failed to remove evidence:', error)
      alert(t('ach:alerts.removeEvidenceFailed'))
    }
  }

  const handleEditAnalysis = () => {
    setFormOpen(true)
  }

  const handleSaveAnalysis = async (formData: ACHFormData) => {
    if (!analysis) return

    try {
      // Update analysis
      await fetch(`/api/ach?id=${analysis.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          question: formData.question,
          analyst: formData.analyst,
          organization: formData.organization,
          scale_type: formData.scale_type,
          status: formData.status
        })
      })

      // Update hypotheses (delete removed, update existing, create new)
      if (analysis.hypotheses) {
        for (const oldHyp of analysis.hypotheses) {
          const stillExists = formData.hypotheses.find(h => h.id === oldHyp.id)
          if (!stillExists) {
            await fetch(`/api/ach/hypotheses?id=${oldHyp.id}`, { method: 'DELETE' })
          }
        }
      }

      for (const hyp of formData.hypotheses) {
        if (hyp.id) {
          await fetch(`/api/ach/hypotheses?id=${hyp.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hyp)
          })
        } else {
          await fetch('/api/ach/hypotheses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...hyp, ach_analysis_id: analysis.id })
          })
        }
      }

      // Update evidence links
      const currentLinks = analysis.evidence?.map(e => e.evidence_id) || []
      const newLinks = formData.evidence_ids || []

      // Remove evidence that's no longer selected
      for (const evidenceId of currentLinks) {
        if (!newLinks.includes(evidenceId)) {
          const link = analysis.evidence?.find(e => e.evidence_id === evidenceId)
          if (link?.link_id) {
            await fetch(`/api/ach/evidence?id=${link.link_id}`, {
              method: 'DELETE'
            })
          }
        }
      }

      // Add new evidence links
      for (const evidenceId of newLinks) {
        if (!currentLinks.includes(evidenceId)) {
          await fetch('/api/ach/evidence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ach_analysis_id: analysis.id,
              evidence_id: evidenceId
            })
          })
        }
      }

      await loadAnalysis()
      setFormOpen(false)
    } catch (error) {
      console.error('Error saving analysis:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600 dark:text-gray-400">{t('ach:loadingAnalysis')}</p>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('ach:detail.notFound')}</h2>
        <Button onClick={() => navigate('/dashboard/analysis-frameworks/ach-dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('ach:detail.backToDashboard')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <Button variant="outline" onClick={() => navigate('/dashboard/analysis-frameworks/ach-dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('ach:detail.back')}
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.title}
              </h1>
              <Badge variant="outline">{t(`ach:status.${analysis.status.toLowerCase()}`)}</Badge>
              <Badge variant="secondary">{analysis.scale_type}</Badge>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              <strong>{t('ach:detail.keyQuestion')}</strong> {analysis.question}
            </p>
            {analysis.description && (
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {analysis.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              // Extract actor IDs from linked evidence
              const actorIds: string[] = []

              if (analysis.evidence && analysis.evidence.length > 0) {
                // Fetch each evidence item to get linked actors
                for (const ev of analysis.evidence) {
                  try {
                    const response = await fetch(`/api/evidence-items?id=${ev.evidence_id}`)
                    if (response.ok) {
                      const evidenceData = await response.json()
                      if (evidenceData.linked_actors && Array.isArray(evidenceData.linked_actors)) {
                        actorIds.push(...evidenceData.linked_actors)
                      }
                    }
                  } catch (error) {
                    console.log('Error fetching evidence actors:', error)
                  }
                }
              }

              // Remove duplicates
              const uniqueActorIds = [...new Set(actorIds)]

              navigate('/dashboard/network-graph', {
                state: {
                  highlightEntities: uniqueActorIds,
                  source: 'ach',
                  title: analysis.title
                }
              })
            }}
          >
            <Network className="h-4 w-4 mr-2" />
            {t('ach:detail.viewNetwork')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                {t('ach:detail.export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <div className="w-full">
                  <ACHPDFExport analysis={analysis} size="sm" className="w-full justify-start" />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <div className="w-full">
                  <ACHPowerPointExport analysis={analysis} size="sm" className="w-full justify-start" />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <div className="w-full">
                  <ACHExcelExport analysis={analysis} size="sm" className="w-full justify-start" />
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ACHShareButton
            analysisId={analysis.id}
            isPublic={analysis.is_public || false}
            shareToken={analysis.share_token}
            domain={analysis.domain}
            tags={analysis.tags}
            onUpdate={() => loadAnalysis()}
          />
          <Button onClick={handleEditAnalysis}>
            <Edit className="h-4 w-4 mr-2" />
            {t('ach:detail.editAnalysis')}
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {analysis.analyst && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('ach:detail.analyst')}</p>
                <p className="font-medium">{analysis.analyst}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {analysis.organization && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Building className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('ach:detail.organization')}</p>
                <p className="font-medium">{analysis.organization}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('ach:detail.created')}</p>
              <p className="font-medium">
                {new Date(analysis.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ACH Matrix */}
      <ACHMatrix
        analysis={analysis}
        onUpdateScore={handleUpdateScore}
        onAddEvidence={handleAddEvidence}
        onRemoveEvidence={handleRemoveEvidence}
      />

      {/* Visual Analytics */}
      <ACHVisualAnalytics analysis={analysis} />

      {/* Edit Form */}
      <ACHAnalysisForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveAnalysis}
        initialData={analysis}
        mode="edit"
      />
    </div>
  )
}