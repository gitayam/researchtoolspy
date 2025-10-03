import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Download, Link2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EvidenceLinker, EvidenceBadge, EvidencePanel, EntityQuickCreate, type LinkedEvidence, type EvidenceEntityType } from '@/components/evidence'

interface FrameworkItem {
  id: string
  text: string
}

interface FrameworkSection {
  key: string
  label: string
  color: string
  bgColor: string
  icon: string
}

interface GenericFrameworkData {
  id: string
  title: string
  description: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

interface GenericFrameworkViewProps {
  data: GenericFrameworkData
  sections: FrameworkSection[]
  frameworkTitle: string
  onEdit: () => void
  onDelete: () => void
  backPath: string
}

export function GenericFrameworkView({
  data,
  sections,
  frameworkTitle,
  onEdit,
  onDelete,
  backPath
}: GenericFrameworkViewProps) {
  const navigate = useNavigate()

  // Evidence linking state
  const [linkedEvidence, setLinkedEvidence] = useState<LinkedEvidence[]>([])
  const [showEvidenceLinker, setShowEvidenceLinker] = useState(false)
  const [showEvidencePanel, setShowEvidencePanel] = useState(false)
  const [showEntityCreate, setShowEntityCreate] = useState(false)
  const [entityCreateTab, setEntityCreateTab] = useState<EvidenceEntityType>('data')

  // Load linked evidence on mount
  useEffect(() => {
    // TODO: Load linked evidence from API
    setLinkedEvidence([])
  }, [data.id])

  const handleLinkEvidence = async (selected: LinkedEvidence[]) => {
    // TODO: Save links to API
    setLinkedEvidence([...linkedEvidence, ...selected])
  }

  const handleUnlinkEvidence = (entity_type: string, entity_id: string | number) => {
    // TODO: Remove link from API
    setLinkedEvidence(
      linkedEvidence.filter(e => !(e.entity_type === entity_type && e.entity_id === entity_id))
    )
  }

  const handleEntityCreated = (entityType: EvidenceEntityType, entityData: any) => {
    // Auto-link the newly created entity
    const newLink: LinkedEvidence = {
      entity_type: entityType,
      entity_id: entityData.id,
      entity_data: entityData,
      linked_at: new Date().toISOString()
    }
    setLinkedEvidence([...linkedEvidence, newLink])
    setShowEvidencePanel(true) // Show panel to see the newly linked entity
  }

  const openEntityCreate = (type: EvidenceEntityType) => {
    setEntityCreateTab(type)
    setShowEntityCreate(true)
  }

  const SectionView = ({
    section,
    items
  }: {
    section: FrameworkSection
    items: FrameworkItem[]
  }) => (
    <Card className={`border-l-4 ${section.color}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{section.icon}</span>
          {section.label}
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No {section.label.toLowerCase()} identified
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={`p-3 rounded-lg ${section.bgColor} text-sm`}
              >
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {index + 1}.
                </span>{' '}
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.title}
              </h1>
              <EvidenceBadge
                linkedEvidence={linkedEvidence}
                onClick={() => setShowEvidencePanel(!showEvidencePanel)}
                showBreakdown
                size="lg"
              />
            </div>
            {data.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {data.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Entity
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEntityCreate('data')}>
                Create Data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEntityCreate('actor')}>
                Create Actor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEntityCreate('source')}>
                Create Source
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEntityCreate('event')}>
                Create Event
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setShowEvidenceLinker(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Link Evidence
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
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

      {/* Metadata */}
      {(data.created_at || data.updated_at) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
              {data.created_at && (
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {new Date(data.created_at).toLocaleDateString()}
                </div>
              )}
              {data.updated_at && (
                <div>
                  <span className="font-medium">Last Updated:</span>{' '}
                  {new Date(data.updated_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-${sections.length} gap-4 text-center`}>
            {sections.map(section => (
              <div key={section.key} className={`p-4 rounded-lg ${section.bgColor}`}>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {data[section.key]?.length || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {section.label}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Framework Sections */}
      <div className={`grid grid-cols-1 ${sections.length === 4 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6`}>
        {sections.map(section => (
          <SectionView
            key={section.key}
            section={section}
            items={data[section.key] || []}
          />
        ))}
      </div>

      {/* Entity Quick Create Modal */}
      <EntityQuickCreate
        open={showEntityCreate}
        onClose={() => setShowEntityCreate(false)}
        onEntityCreated={handleEntityCreated}
        defaultTab={entityCreateTab}
        frameworkContext={{
          frameworkType: frameworkTitle,
          frameworkId: data.id?.toString()
        }}
      />

      {/* Evidence Linker Modal */}
      <EvidenceLinker
        open={showEvidenceLinker}
        onClose={() => setShowEvidenceLinker(false)}
        onLink={handleLinkEvidence}
        alreadyLinked={linkedEvidence}
        title={`Link Evidence to ${frameworkTitle}`}
        description="Select evidence items to support this analysis"
      />

      {/* Evidence Panel */}
      {showEvidencePanel && (
        <div className="fixed right-0 top-0 h-screen w-96 z-50">
          <EvidencePanel
            linkedEvidence={linkedEvidence}
            onUnlink={handleUnlinkEvidence}
            onClose={() => setShowEvidencePanel(false)}
            title="Linked Evidence"
          />
        </div>
      )}
    </div>
  )
}
