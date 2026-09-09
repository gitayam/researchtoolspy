import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  COMBTarget,
  CopingBranch,
  DecisionType,
  HAPAPhase,
  MotivationMode,
  PsychologicalState,
  TimelineEvent,
  TimelineFork,
  TimelineSubStep,
  TTMStage,
} from '@/types/behavior'

const NONE = '__none__'

const DECISION_TYPE_OPTIONS: Array<{ value: DecisionType; label: string }> = [
  { value: 'goal_formation', label: 'Goal formation' },
  { value: 'intention', label: 'Intention' },
  { value: 'action_plan', label: 'Action plan' },
  { value: 'coping_plan', label: 'Coping plan' },
  { value: 'initiation', label: 'Initiation' },
  { value: 'persistence', label: 'Persistence' },
  { value: 'identity', label: 'Identity' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'disengagement', label: 'Disengagement' },
  { value: 'administrative_gate', label: 'Administrative gate' },
]

const TTM_STAGE_OPTIONS: Array<{ value: TTMStage; label: string }> = [
  { value: 'precontemplation', label: 'Precontemplation' },
  { value: 'contemplation', label: 'Contemplation' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'action', label: 'Action' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'relapse', label: 'Relapse' },
  { value: 'decided_not_to_act', label: 'Decided not to act' },
]

const HAPA_PHASE_OPTIONS: Array<{ value: HAPAPhase; label: string }> = [
  { value: 'motivational', label: 'Motivational' },
  { value: 'volitional', label: 'Volitional' },
]

const MOTIVATION_MODE_OPTIONS: Array<{ value: MotivationMode; label: string }> = [
  { value: 'reflective_dominant', label: 'Reflective dominant' },
  { value: 'automatic_dominant', label: 'Automatic dominant' },
  { value: 'contested', label: 'Contested / mixed' },
]

const COM_B_TARGET_OPTIONS: Array<{ value: COMBTarget; label: string }> = [
  { value: 'physical_capability', label: 'Physical capability' },
  { value: 'psychological_capability', label: 'Psychological capability' },
  { value: 'physical_opportunity', label: 'Physical opportunity' },
  { value: 'social_opportunity', label: 'Social opportunity' },
  { value: 'reflective_motivation', label: 'Reflective motivation' },
  { value: 'automatic_motivation', label: 'Automatic motivation' },
]

function optionLabel<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T | undefined,
): string | undefined {
  return options.find(option => option.value === value)?.label
}

function getDecisionType(event: TimelineEvent): DecisionType | undefined {
  if (event.decision_type) return event.decision_type
  if (event.is_decision_point === true) return 'goal_formation'
  if (event.is_decision_point === false) return 'administrative_gate'
  return undefined
}

export function BehaviorTimelineEventSummary({ event }: { event: TimelineEvent }) {
  const decisionType = getDecisionType(event)
  const state = event.psychological_state

  if (
    !decisionType
    && !state
    && !event.com_b_target
    && !event.coping_branches?.length
    && !event.competing_behaviours?.length
  ) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5" data-testid={`event-summary-${event.id}`}>
      {decisionType && (
        <Badge variant="secondary">Decision: {optionLabel(DECISION_TYPE_OPTIONS, decisionType)}</Badge>
      )}
      {state && (
        <Badge variant="outline">
          State: {optionLabel(TTM_STAGE_OPTIONS, state.stage)} · {optionLabel(HAPA_PHASE_OPTIONS, state.phase)}
        </Badge>
      )}
      {event.com_b_target && (
        <Badge variant="outline">COM-B hypothesis: {optionLabel(COM_B_TARGET_OPTIONS, event.com_b_target)}</Badge>
      )}
      {!!event.coping_branches?.length && (
        <Badge variant="outline">{event.coping_branches.length} coping {event.coping_branches.length === 1 ? 'plan' : 'plans'}</Badge>
      )}
      {!!event.competing_behaviours?.length && (
        <Badge variant="outline">{event.competing_behaviours.length} competing {event.competing_behaviours.length === 1 ? 'behavior' : 'behaviors'}</Badge>
      )}
    </div>
  )
}

interface BehaviorTimelineEventDetailsProps {
  event: TimelineEvent
  readOnly?: boolean
  onUpdate: (updates: Partial<TimelineEvent>) => void
}

export function BehaviorTimelineEventDetails({
  event,
  readOnly = false,
  onUpdate,
}: BehaviorTimelineEventDetailsProps) {
  const [newCompetingBehavior, setNewCompetingBehavior] = useState('')
  const [newCopingBranch, setNewCopingBranch] = useState<CopingBranch>({ obstacle: '', response: '' })
  const [newSubStep, setNewSubStep] = useState<TimelineSubStep>({ label: '', description: '', duration: '' })
  const [newFork, setNewFork] = useState<Omit<TimelineFork, 'path'>>({ condition: '', label: '' })
  const decisionType = getDecisionType(event)

  const updatePsychologicalState = <K extends keyof PsychologicalState>(
    key: K,
    value: PsychologicalState[K],
  ) => {
    if (!event.psychological_state) return
    onUpdate({
      psychological_state: {
        ...event.psychological_state,
        [key]: value,
      },
    })
  }

  const addCompetingBehavior = () => {
    const value = newCompetingBehavior.trim()
    if (!value) return
    onUpdate({ competing_behaviours: [...(event.competing_behaviours || []), value] })
    setNewCompetingBehavior('')
  }

  const addCopingBranch = () => {
    const obstacle = newCopingBranch.obstacle.trim()
    const response = newCopingBranch.response.trim()
    if (!obstacle || !response) return
    onUpdate({ coping_branches: [...(event.coping_branches || []), { obstacle, response }] })
    setNewCopingBranch({ obstacle: '', response: '' })
  }

  const addSubStep = () => {
    const label = newSubStep.label.trim()
    if (!label) return
    onUpdate({
      sub_steps: [
        ...(event.sub_steps || []),
        {
          label,
          description: newSubStep.description?.trim() || undefined,
          duration: newSubStep.duration?.trim() || undefined,
        },
      ],
    })
    setNewSubStep({ label: '', description: '', duration: '' })
  }

  const addFork = () => {
    const condition = newFork.condition.trim()
    const label = newFork.label.trim()
    if (!condition || !label) return
    onUpdate({ forks: [...(event.forks || []), { condition, label, path: [] }] })
    setNewFork({ condition: '', label: '' })
  }

  if (readOnly) {
    return (
      <div className="space-y-4 text-sm" data-testid={`event-details-${event.id}`}>
        {event.psychological_state && (
          <div>
            <p className="font-medium">Psychological state</p>
            <p className="text-gray-600 dark:text-gray-400">
              {optionLabel(TTM_STAGE_OPTIONS, event.psychological_state.stage)} ·{' '}
              {optionLabel(HAPA_PHASE_OPTIONS, event.psychological_state.phase)} ·{' '}
              {optionLabel(MOTIVATION_MODE_OPTIONS, event.psychological_state.motivation_mode)}
            </p>
          </div>
        )}
        {!!event.coping_branches?.length && (
          <div>
            <p className="font-medium">Coping plans</p>
            <ul className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
              {event.coping_branches.map((branch, index) => (
                <li key={`${branch.obstacle}-${index}`}>If {branch.obstacle}, then {branch.response}</li>
              ))}
            </ul>
          </div>
        )}
        {!!event.competing_behaviours?.length && (
          <div>
            <p className="font-medium">Competing behaviors</p>
            <ul className="mt-1 list-inside list-disc text-gray-600 dark:text-gray-400">
              {event.competing_behaviours.map((behavior, index) => <li key={`${behavior}-${index}`}>{behavior}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid={`event-details-${event.id}`}>
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
        Model the actor's decision sequence here. Psychological state and COM-B target are working hypotheses for analyst review, not audience-level diagnoses. Confirm those in a linked COM-B Analysis.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`decision-type-${event.id}`}>Decision role</Label>
          <Select
            value={decisionType || NONE}
            onValueChange={(value) => {
              if (value === NONE) {
                onUpdate({ decision_type: undefined, is_decision_point: undefined })
                return
              }
              const next = value as DecisionType
              onUpdate({
                decision_type: next,
                is_decision_point: next !== 'administrative_gate',
              })
            }}
          >
            <SelectTrigger id={`decision-type-${event.id}`} aria-label="Decision role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not classified</SelectItem>
              {DECISION_TYPE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`comb-target-${event.id}`}>COM-B target hypothesis</Label>
          <Select
            value={event.com_b_target || NONE}
            onValueChange={(value) => onUpdate({ com_b_target: value === NONE ? undefined : value as COMBTarget })}
          >
            <SelectTrigger id={`comb-target-${event.id}`} aria-label="COM-B target hypothesis">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No hypothesis</SelectItem>
              {COM_B_TARGET_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Psychological state</p>
            <p className="text-xs text-gray-500">Optional TTM, HAPA, and motivation-mode hypothesis at this step.</p>
          </div>
          {event.psychological_state ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onUpdate({ psychological_state: undefined })}>
              Remove state
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onUpdate({
                psychological_state: {
                  stage: 'contemplation',
                  phase: 'motivational',
                  motivation_mode: 'contested',
                },
              })}
            >
              <Plus className="mr-1 h-3 w-3" /> Add state
            </Button>
          )}
        </div>
        {event.psychological_state && (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`ttm-stage-${event.id}`}>TTM stage</Label>
              <Select
                value={event.psychological_state.stage}
                onValueChange={(value) => updatePsychologicalState('stage', value as TTMStage)}
              >
                <SelectTrigger id={`ttm-stage-${event.id}`} aria-label="TTM stage"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TTM_STAGE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`hapa-phase-${event.id}`}>HAPA phase</Label>
              <Select
                value={event.psychological_state.phase}
                onValueChange={(value) => updatePsychologicalState('phase', value as HAPAPhase)}
              >
                <SelectTrigger id={`hapa-phase-${event.id}`} aria-label="HAPA phase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HAPA_PHASE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`motivation-mode-${event.id}`}>Motivation mode</Label>
              <Select
                value={event.psychological_state.motivation_mode}
                onValueChange={(value) => updatePsychologicalState('motivation_mode', value as MotivationMode)}
              >
                <SelectTrigger id={`motivation-mode-${event.id}`} aria-label="Motivation mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTIVATION_MODE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Coping plans</p>
          <p className="text-xs text-gray-500">Record a foreseen obstacle and the actor's planned response.</p>
        </div>
        {(event.coping_branches || []).map((branch, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input
              value={branch.obstacle}
              aria-label={`Coping obstacle ${index + 1}`}
              onChange={(e) => {
                const branches = [...(event.coping_branches || [])]
                branches[index] = { ...branch, obstacle: e.target.value }
                onUpdate({ coping_branches: branches })
              }}
            />
            <Input
              value={branch.response}
              aria-label={`Coping response ${index + 1}`}
              onChange={(e) => {
                const branches = [...(event.coping_branches || [])]
                branches[index] = { ...branch, response: e.target.value }
                onUpdate({ coping_branches: branches })
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove coping plan ${index + 1}`}
              onClick={() => onUpdate({ coping_branches: event.coping_branches?.filter((_, itemIndex) => itemIndex !== index) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={newCopingBranch.obstacle}
            placeholder="Obstacle (if...)"
            aria-label="New coping obstacle"
            onChange={(e) => setNewCopingBranch(current => ({ ...current, obstacle: e.target.value }))}
          />
          <Input
            value={newCopingBranch.response}
            placeholder="Planned response (then...)"
            aria-label="New coping response"
            onChange={(e) => setNewCopingBranch(current => ({ ...current, response: e.target.value }))}
          />
          <Button type="button" size="sm" variant="outline" onClick={addCopingBranch} disabled={!newCopingBranch.obstacle.trim() || !newCopingBranch.response.trim()}>
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Competing behaviors</p>
          <p className="text-xs text-gray-500">Alternatives competing for the actor's time, attention, or effort.</p>
        </div>
        {!!event.competing_behaviours?.length && (
          <div className="flex flex-wrap gap-2">
            {event.competing_behaviours.map((behavior, index) => (
              <Badge key={`${behavior}-${index}`} variant="secondary" className="gap-1 pr-1">
                {behavior}
                <button
                  type="button"
                  aria-label={`Remove competing behavior ${behavior}`}
                  className="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={() => onUpdate({ competing_behaviours: event.competing_behaviours?.filter((_, itemIndex) => itemIndex !== index) })}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newCompetingBehavior}
            placeholder="Add a competing behavior"
            aria-label="New competing behavior"
            onChange={(e) => setNewCompetingBehavior(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCompetingBehavior()
              }
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={addCompetingBehavior} disabled={!newCompetingBehavior.trim()}>Add</Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Sub-steps</p>
          <p className="text-xs text-gray-500">Break this event into observable actions.</p>
        </div>
        {(event.sub_steps || []).map((step, index) => (
          <div key={index} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1fr_1fr_10rem_auto]">
            <Input
              value={step.label}
              aria-label={`Sub-step ${index + 1} label`}
              onChange={(e) => {
                const steps = [...(event.sub_steps || [])]
                steps[index] = { ...step, label: e.target.value }
                onUpdate({ sub_steps: steps })
              }}
            />
            <Input
              value={step.description || ''}
              aria-label={`Sub-step ${index + 1} description`}
              placeholder="Description"
              onChange={(e) => {
                const steps = [...(event.sub_steps || [])]
                steps[index] = { ...step, description: e.target.value }
                onUpdate({ sub_steps: steps })
              }}
            />
            <Input
              value={step.duration || ''}
              aria-label={`Sub-step ${index + 1} duration`}
              placeholder="Duration"
              onChange={(e) => {
                const steps = [...(event.sub_steps || [])]
                steps[index] = { ...step, duration: e.target.value }
                onUpdate({ sub_steps: steps })
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove sub-step ${index + 1}`}
              onClick={() => onUpdate({ sub_steps: event.sub_steps?.filter((_, itemIndex) => itemIndex !== index) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_10rem_auto]">
          <Input value={newSubStep.label} placeholder="Sub-step label" aria-label="New sub-step label" onChange={(e) => setNewSubStep(current => ({ ...current, label: e.target.value }))} />
          <Input value={newSubStep.description || ''} placeholder="Description" aria-label="New sub-step description" onChange={(e) => setNewSubStep(current => ({ ...current, description: e.target.value }))} />
          <Input value={newSubStep.duration || ''} placeholder="Duration" aria-label="New sub-step duration" onChange={(e) => setNewSubStep(current => ({ ...current, duration: e.target.value }))} />
          <Button type="button" size="sm" variant="outline" onClick={addSubStep} disabled={!newSubStep.label.trim()}>Add</Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Decision forks</p>
          <p className="text-xs text-gray-500">Describe the condition and immediate alternative outcome.</p>
        </div>
        {(event.forks || []).map((fork, index) => (
          <div key={index} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1fr_1fr_auto]">
            <Input
              value={fork.condition}
              aria-label={`Fork ${index + 1} condition`}
              onChange={(e) => {
                const forks = [...(event.forks || [])]
                forks[index] = { ...fork, condition: e.target.value }
                onUpdate({ forks })
              }}
            />
            <Input
              value={fork.label}
              aria-label={`Fork ${index + 1} outcome`}
              onChange={(e) => {
                const forks = [...(event.forks || [])]
                forks[index] = { ...fork, label: e.target.value }
                onUpdate({ forks })
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove fork ${index + 1}`}
              onClick={() => onUpdate({ forks: event.forks?.filter((_, itemIndex) => itemIndex !== index) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {!!fork.path?.length && (
              <p className="text-xs text-gray-500 md:col-span-3">This imported fork contains {fork.path.length} nested path {fork.path.length === 1 ? 'event' : 'events'}.</p>
            )}
          </div>
        ))}
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input value={newFork.condition} placeholder="Condition (if...)" aria-label="New fork condition" onChange={(e) => setNewFork(current => ({ ...current, condition: e.target.value }))} />
          <Input value={newFork.label} placeholder="Alternative outcome" aria-label="New fork outcome" onChange={(e) => setNewFork(current => ({ ...current, label: e.target.value }))} />
          <Button type="button" size="sm" variant="outline" onClick={addFork} disabled={!newFork.condition.trim() || !newFork.label.trim()}>Add</Button>
        </div>
      </div>
    </div>
  )
}
