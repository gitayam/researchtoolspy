import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { MOMAssessmentForm } from './MOMAssessmentForm'
import type { MOMAssessment, CreateMOMAssessmentRequest, UpdateMOMAssessmentRequest } from '@/types/entities'

interface MOMAssessmentModalProps {
  open: boolean
  onClose: () => void
  assessment?: MOMAssessment
  actorId?: string
  eventId?: string
  workspaceId: string
  onSuccess?: () => void
}

export function MOMAssessmentModal({
  open,
  onClose,
  assessment,
  actorId,
  eventId,
  workspaceId,
  onSuccess
}: MOMAssessmentModalProps) {
  const isEditing = !!assessment

  const handleSubmit = async (data: CreateMOMAssessmentRequest | UpdateMOMAssessmentRequest) => {
    try {
      const url = isEditing
        ? `/api/mom-assessments/${assessment.id}`
        : `/api/mom-assessments`

      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to save MOM assessment')
      }

      // Success - close modal and notify parent
      onClose()
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Failed to save MOM assessment:', error)
      throw error // Let the form handle the error display
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit MOM Assessment' : 'Create MOM Assessment'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the motive, opportunity, and means assessment for this actor-event relationship.'
              : 'Assess whether an actor had the motive, opportunity, and means to be involved in this event.'}
          </DialogDescription>
        </DialogHeader>
        <MOMAssessmentForm
          assessment={assessment}
          actorId={actorId}
          eventId={eventId}
          workspaceId={workspaceId}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
