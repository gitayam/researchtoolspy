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
export const INGEST_SUBMISSION_BLOCKED = 'ingest.submission_blocked' as const
export const INGEST_SUBMISSION_RATE_LIMITED = 'ingest.submission_rate_limited' as const

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

// -- Generic change events (feed: GET /api/cop/:id/changes) --
export const EVIDENCE_UPDATED = 'evidence.updated' as const
export const EVIDENCE_DELETED = 'evidence.deleted' as const
export const EVIDENCE_BATCH_CREATED = 'evidence.batch_created' as const
export const EVIDENCE_IMPORTED = 'evidence.imported' as const
export const MARKER_LOGGED = 'marker.logged' as const
export const RFI_UPDATED = 'rfi.updated' as const
export const RFI_STARRED = 'rfi.starred' as const
export const RFI_UNSTARRED = 'rfi.unstarred' as const
export const RFI_DELETED = 'rfi.deleted' as const
export const RFI_ANSWER_UPDATED = 'rfi.answer_updated' as const
export const TASK_UPDATED = 'task.updated' as const
export const TASK_DEPENDENCY_ADDED = 'task.dependency_added' as const
export const TASK_DEPENDENCY_REMOVED = 'task.dependency_removed' as const
export const TASK_TEMPLATE_CHANGED = 'task.template_changed' as const
export const TIMELINE_CREATED = 'timeline.created' as const
export const TIMELINE_UPDATED = 'timeline.updated' as const
export const TIMELINE_DELETED = 'timeline.deleted' as const
export const CLAIM_CREATED = 'claim.created' as const
export const CLAIM_UPDATED = 'claim.updated' as const
export const CLAIM_DELETED = 'claim.deleted' as const
export const HYPOTHESIS_DELETED = 'hypothesis.deleted' as const
export const PERSONA_UPDATED = 'persona.updated' as const
export const PERSONA_DELETED = 'persona.deleted' as const
export const POO_CREATED = 'poo.created' as const
export const POO_UPDATED = 'poo.updated' as const
export const POO_DELETED = 'poo.deleted' as const
export const ASSET_DELETED = 'asset.deleted' as const
export const WEBCAM_CREATED = 'webcam.created' as const
export const WEBCAM_UPDATED = 'webcam.updated' as const
export const WEBCAM_DELETED = 'webcam.deleted' as const
export const SHARE_UPDATED = 'share.updated' as const
export const SHARE_DELETED = 'share.deleted' as const
export const SESSION_CREATED = 'session.created' as const
export const SESSION_UPDATED = 'session.updated' as const
export const COLLABORATOR_UPDATED = 'collaborator.updated' as const
export const PLAYBOOK_CREATED = 'playbook.created' as const
export const PLAYBOOK_UPDATED = 'playbook.updated' as const
export const PLAYBOOK_DELETED = 'playbook.deleted' as const
export const INTAKE_FORM_CREATED = 'intake_form.created' as const
export const INTAKE_FORM_UPDATED = 'intake_form.updated' as const
export const ACTIVITY_LOGGED = 'activity.logged' as const

// -- Typed changes the chat feed (GET /api/cop/:id/chat-feed) words for a chat reader.
// Each is emitted next to the generic *.updated event of the same write, with the entity
// id and the real actor as created_by, and no user id, name or email in the payload.
/** An RFI moved back to open from answered, accepted or closed. */
export const RFI_REOPENED = 'rfi.reopened' as const
/** A task left 'done'. */
export const TASK_REOPENED = 'task.reopened' as const
/** A task's priority changed; payload { priority }. */
export const TASK_PRIORITY_CHANGED = 'task.priority_changed' as const
/** A marker's confidence became CONFIRMED. */
export const MARKER_CONFIRMED = 'marker.confirmed' as const
/** An evidence item's credibility changed (an editor reviewed it); payload { credibility }. */
export const EVIDENCE_REVIEWED = 'evidence.reviewed' as const
// Evidence filed under a question or task (cop-evidence-links.ts): one event on each end,
// payload { link_id, target_type } (+ via: 'tip' when the tipster chose the question).
export const EVIDENCE_LINK_UPDATED = 'evidence.link_updated' as const
export const EVIDENCE_UNLINKED = 'evidence.unlinked' as const
/** A team vote on a filing: counts only, created_by 0. Never in the chat feed. */
export const EVIDENCE_LINK_VOTED = 'evidence.link_voted' as const
/** Emitted by functions/api/cop/_middleware.ts for a successful write that emitted nothing. */
export const ENTITY_CHANGED = 'entity.changed' as const

/**
 * The entity_type vocabulary of the change feed (GET /api/cop/:id/changes). Clients map
 * these to the panels and layers they refetch. Every write emits one of these.
 */
export const COP_FEED_ENTITY_TYPES = [
  'evidence', 'marker', 'rfi', 'task', 'timeline', 'claim', 'hypothesis', 'persona', 'poo',
  'asset', 'webcam', 'tag', 'upload', 'submission', 'share', 'session', 'playbook', 'activity',
] as const
export type CopFeedEntityType = (typeof COP_FEED_ENTITY_TYPES)[number]

/**
 * Entity types written before the feed vocabulary existed, and what the feed shows
 * them as. New code emits feed types only.
 */
export const LEGACY_ENTITY_TYPES: Readonly<Record<string, CopFeedEntityType>> = {
  // Team activity, never shown on a share link (publicFeedTypes has no 'activity').
  collaborator: 'activity',
  export: 'activity',
  alert: 'activity',
  workflow: 'playbook',
}

// Entity type enum for the entity_type column: the feed vocabulary, plus the legacy
// types some older emitters still write (mapped by LEGACY_ENTITY_TYPES in the feed).
export type CopEventEntityType =
  | CopFeedEntityType
  | 'collaborator'
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
  | typeof INGEST_SUBMISSION_BLOCKED | typeof INGEST_SUBMISSION_RATE_LIMITED
  | typeof ASSET_CREATED | typeof ASSET_UPDATED | typeof ASSET_STATUS_CHANGED | typeof ASSET_QUOTA_LOW
  | typeof ALERT_DISMISSED | typeof ALERT_ACTIONED | typeof ALERT_LINKED
  | typeof EXPORT_REQUESTED | typeof EXPORT_COMPLETED | typeof EXPORT_FAILED
  | typeof WORKFLOW_STAGE_ENTERED | typeof WORKFLOW_STAGE_COMPLETED | typeof WORKFLOW_PIPELINE_FINISHED
  | typeof EVIDENCE_UPDATED | typeof EVIDENCE_DELETED | typeof EVIDENCE_BATCH_CREATED | typeof EVIDENCE_IMPORTED
  | typeof MARKER_LOGGED
  | typeof RFI_UPDATED | typeof RFI_STARRED | typeof RFI_UNSTARRED | typeof RFI_DELETED | typeof RFI_ANSWER_UPDATED
  | typeof TASK_UPDATED | typeof TASK_DEPENDENCY_ADDED | typeof TASK_DEPENDENCY_REMOVED | typeof TASK_TEMPLATE_CHANGED
  | typeof TIMELINE_CREATED | typeof TIMELINE_UPDATED | typeof TIMELINE_DELETED
  | typeof CLAIM_CREATED | typeof CLAIM_UPDATED | typeof CLAIM_DELETED
  | typeof HYPOTHESIS_DELETED | typeof PERSONA_UPDATED | typeof PERSONA_DELETED
  | typeof POO_CREATED | typeof POO_UPDATED | typeof POO_DELETED
  | typeof ASSET_DELETED
  | typeof WEBCAM_CREATED | typeof WEBCAM_UPDATED | typeof WEBCAM_DELETED
  | typeof SHARE_UPDATED | typeof SHARE_DELETED
  | typeof SESSION_CREATED | typeof SESSION_UPDATED | typeof COLLABORATOR_UPDATED
  | typeof PLAYBOOK_CREATED | typeof PLAYBOOK_UPDATED | typeof PLAYBOOK_DELETED
  | typeof INTAKE_FORM_CREATED | typeof INTAKE_FORM_UPDATED
  | typeof ACTIVITY_LOGGED | typeof ENTITY_CHANGED
  | typeof RFI_REOPENED | typeof TASK_REOPENED | typeof TASK_PRIORITY_CHANGED | typeof MARKER_CONFIRMED
  | typeof EVIDENCE_REVIEWED | typeof EVIDENCE_LINK_UPDATED | typeof EVIDENCE_UNLINKED | typeof EVIDENCE_LINK_VOTED
