/**
 * COP Event Type Constants
 *
 * Structured taxonomy for the cop_events bus.
 * Format: {domain}.{action}
 * Domains align with COP entity types.
 */

// -- Domain: task --
export const TASK_CREATED = 'task.created' as const
export const TASK_ASSIGNED = 'task.assigned' as const
export const TASK_STARTED = 'task.started' as const
export const TASK_COMPLETED = 'task.completed' as const
export const TASK_BLOCKED = 'task.blocked' as const
export const TASK_OVERDUE = 'task.overdue' as const
export const TASK_UNBLOCKED = 'task.unblocked' as const
export const TASK_UNASSIGNABLE = 'task.unassignable' as const
export const TASK_DELETED = 'task.deleted' as const

// -- Domain: rfi --
export const RFI_CREATED = 'rfi.created' as const
export const RFI_ANSWERED = 'rfi.answered' as const
export const RFI_ACCEPTED = 'rfi.accepted' as const
export const RFI_OVERDUE = 'rfi.overdue' as const
export const RFI_CLOSED = 'rfi.closed' as const

// -- Domain: evidence --
export const EVIDENCE_CREATED = 'evidence.created' as const
export const EVIDENCE_TAGGED = 'evidence.tagged' as const
export const EVIDENCE_LINKED = 'evidence.linked' as const

// -- Domain: hypothesis --
export const HYPOTHESIS_CREATED = 'hypothesis.created' as const
export const HYPOTHESIS_UPDATED = 'hypothesis.updated' as const
export const HYPOTHESIS_EVIDENCE_LINKED = 'hypothesis.evidence_linked' as const

// -- Domain: persona --
export const PERSONA_CREATED = 'persona.created' as const
export const PERSONA_LINKED = 'persona.linked' as const

// -- Domain: marker --
export const MARKER_CREATED = 'marker.created' as const
export const MARKER_UPDATED = 'marker.updated' as const
export const MARKER_DELETED = 'marker.deleted' as const

// -- Domain: collaborator --
export const COLLABORATOR_ADDED = 'collaborator.added' as const
export const COLLABORATOR_REMOVED = 'collaborator.removed' as const

// -- Domain: share --
export const SHARE_CREATED = 'share.created' as const

// -- Domain: ingest (Phase 2) --
export const INGEST_SUBMISSION_RECEIVED = 'ingest.submission_received' as const
export const INGEST_SUBMISSION_TRIAGED = 'ingest.submission_triaged' as const
export const INGEST_SUBMISSION_REJECTED = 'ingest.submission_rejected' as const

// -- Domain: asset (Phase 4) --
export const ASSET_CREATED = 'asset.created' as const
export const ASSET_UPDATED = 'asset.updated' as const
export const ASSET_STATUS_CHANGED = 'asset.status_changed' as const
export const ASSET_QUOTA_LOW = 'asset.quota_low' as const

// -- Domain: alert --
export const ALERT_DISMISSED = 'alert.dismissed' as const
export const ALERT_ACTIONED = 'alert.actioned' as const
export const ALERT_LINKED = 'alert.linked' as const

// -- Domain: export (Phase 5) --
export const EXPORT_REQUESTED = 'export.requested' as const
export const EXPORT_COMPLETED = 'export.completed' as const
export const EXPORT_FAILED = 'export.failed' as const

// -- Domain: workflow (Phase 6) --
export const WORKFLOW_STAGE_ENTERED = 'workflow.stage_entered' as const
export const WORKFLOW_STAGE_COMPLETED = 'workflow.stage_completed' as const
export const WORKFLOW_PIPELINE_FINISHED = 'workflow.pipeline_finished' as const

// Entity type enum for the entity_type column
export type CopEventEntityType =
  | 'task'
  | 'rfi'
  | 'evidence'
  | 'hypothesis'
  | 'persona'
  | 'marker'
  | 'collaborator'
  | 'share'
  | 'submission'
  | 'asset'
  | 'export'
  | 'alert'
  | 'workflow'

// Union type of all event types
export type CopEventType =
  | typeof TASK_CREATED | typeof TASK_ASSIGNED | typeof TASK_STARTED
  | typeof TASK_COMPLETED | typeof TASK_BLOCKED | typeof TASK_OVERDUE
  | typeof TASK_UNBLOCKED | typeof TASK_UNASSIGNABLE | typeof TASK_DELETED
  | typeof RFI_CREATED | typeof RFI_ANSWERED | typeof RFI_ACCEPTED
  | typeof RFI_OVERDUE | typeof RFI_CLOSED
  | typeof EVIDENCE_CREATED | typeof EVIDENCE_TAGGED | typeof EVIDENCE_LINKED
  | typeof HYPOTHESIS_CREATED | typeof HYPOTHESIS_UPDATED | typeof HYPOTHESIS_EVIDENCE_LINKED
  | typeof PERSONA_CREATED | typeof PERSONA_LINKED
  | typeof MARKER_CREATED | typeof MARKER_UPDATED | typeof MARKER_DELETED
  | typeof COLLABORATOR_ADDED | typeof COLLABORATOR_REMOVED
  | typeof SHARE_CREATED
  | typeof INGEST_SUBMISSION_RECEIVED | typeof INGEST_SUBMISSION_TRIAGED | typeof INGEST_SUBMISSION_REJECTED
  | typeof ASSET_CREATED | typeof ASSET_UPDATED | typeof ASSET_STATUS_CHANGED | typeof ASSET_QUOTA_LOW
  | typeof ALERT_DISMISSED | typeof ALERT_ACTIONED | typeof ALERT_LINKED
  | typeof EXPORT_REQUESTED | typeof EXPORT_COMPLETED | typeof EXPORT_FAILED
  | typeof WORKFLOW_STAGE_ENTERED | typeof WORKFLOW_STAGE_COMPLETED | typeof WORKFLOW_PIPELINE_FINISHED
