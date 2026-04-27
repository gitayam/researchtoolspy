/**
 * Mode of Delivery Form (BCW Step 8)
 *
 * Source: Michie, S., Atkins, L., West, R. (2014). The Behaviour Change Wheel:
 *   A Guide to Designing Interventions, Step 8 / Box 2.9.
 *
 * P2-4 — see docs/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md.
 * Canon: irregularpedia.org/general/behavior-analysis/ (The 8-Step Intervention Design Process).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export type DeliveryMode = 'face_to_face' | 'broadcast' | 'internet' | 'app' | 'print' | 'phone' | 'mail' | 'other'
export type DeliveryGroupSize = 'individual' | 'small_group' | 'large_group' | 'population'
export type DeliveryFrequency = 'one_off' | 'sequence' | 'periodic' | 'continuous'

export interface ModeOfDelivery {
  delivery_modes: DeliveryMode[]
  group_size: DeliveryGroupSize | undefined
  frequency: DeliveryFrequency | undefined
  setting: string
  duration_typical: string
  deliverer: string
  notes: string
}

export const EMPTY_MODE_OF_DELIVERY: ModeOfDelivery = {
  delivery_modes: [],
  group_size: undefined,
  frequency: undefined,
  setting: '',
  duration_typical: '',
  deliverer: '',
  notes: '',
}

export function isModeOfDeliveryComplete(m: ModeOfDelivery): boolean {
  return (
    m.delivery_modes.length > 0 &&
    m.group_size !== undefined &&
    m.frequency !== undefined &&
    m.deliverer.trim().length > 0
  )
}

interface Props {
  mode: ModeOfDelivery
  onChange: (m: ModeOfDelivery) => void
  readOnly?: boolean
}

const DELIVERY_MODE_OPTIONS: Array<{ value: DeliveryMode; label: string; icon: string }> = [
  { value: 'face_to_face', label: 'Face to face', icon: '👤' },
  { value: 'broadcast', label: 'Broadcast media', icon: '📺' },
  { value: 'internet', label: 'Internet', icon: '🌐' },
  { value: 'app', label: 'Mobile app', icon: '📱' },
  { value: 'print', label: 'Print', icon: '📄' },
  { value: 'phone', label: 'Phone', icon: '📞' },
  { value: 'mail', label: 'Mail', icon: '📬' },
  { value: 'other', label: 'Other', icon: '•' },
]

const GROUP_SIZE_OPTIONS: Array<{ value: DeliveryGroupSize; label: string; description: string }> = [
  { value: 'individual', label: 'Individual', description: 'One person at a time' },
  { value: 'small_group', label: 'Small group', description: 'Up to ~12 people' },
  { value: 'large_group', label: 'Large group', description: 'Workshops, classes, audiences' },
  { value: 'population', label: 'Population', description: 'Mass-reach delivery' },
]

const FREQUENCY_OPTIONS: Array<{ value: DeliveryFrequency; label: string; description: string }> = [
  { value: 'one_off', label: 'One-off', description: 'A single delivery event' },
  { value: 'sequence', label: 'Sequence', description: 'A defined series of sessions' },
  { value: 'periodic', label: 'Periodic', description: 'Recurring on a schedule' },
  { value: 'continuous', label: 'Continuous', description: 'Always-on / ambient' },
]

export function ModeOfDeliveryForm({ mode, onChange, readOnly = false }: Props) {
  const toggleDeliveryMode = (value: DeliveryMode) => {
    if (readOnly) return
    const has = mode.delivery_modes.includes(value)
    onChange({
      ...mode,
      delivery_modes: has
        ? mode.delivery_modes.filter((v) => v !== value)
        : [...mode.delivery_modes, value],
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span>📡</span> Mode of Delivery (BCW Step 8)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Delivery modes (multi-select) */}
        <div className="space-y-2">
          <Label>Delivery modes — select all that apply</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {DELIVERY_MODE_OPTIONS.map((opt) => {
              const active = mode.delivery_modes.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleDeliveryMode(opt.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    active
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-pressed={active}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{opt.icon}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Group size (single-select) */}
        <div className="space-y-2">
          <Label>Group size</Label>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {GROUP_SIZE_OPTIONS.map((opt) => {
              const active = mode.group_size === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange({ ...mode, group_size: opt.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    active
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-pressed={active}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{opt.description}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Frequency (single-select) */}
        <div className="space-y-2">
          <Label>Frequency</Label>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {FREQUENCY_OPTIONS.map((opt) => {
              const active = mode.frequency === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange({ ...mode, frequency: opt.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    active
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-pressed={active}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{opt.description}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Setting */}
        <div className="space-y-2">
          <Label htmlFor="setting">Setting</Label>
          <Input
            id="setting"
            value={mode.setting}
            onChange={(e) => onChange({ ...mode, setting: e.target.value })}
            readOnly={readOnly}
            placeholder="e.g., Hospital ward, Community centre, Online"
          />
        </div>

        {/* Typical duration */}
        <div className="space-y-2">
          <Label htmlFor="duration">Typical duration</Label>
          <Input
            id="duration"
            value={mode.duration_typical}
            onChange={(e) => onChange({ ...mode, duration_typical: e.target.value })}
            readOnly={readOnly}
            placeholder="e.g., 30 minutes, 6 weekly sessions, Ongoing"
          />
        </div>

        {/* Deliverer */}
        <div className="space-y-2">
          <Label htmlFor="deliverer">Deliverer</Label>
          <Input
            id="deliverer"
            value={mode.deliverer}
            onChange={(e) => onChange({ ...mode, deliverer: e.target.value })}
            readOnly={readOnly}
            placeholder="Who delivers it? — e.g., Trained nurse, GP, Peer educator, Self-directed"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={mode.notes}
            onChange={(e) => onChange({ ...mode, notes: e.target.value })}
            readOnly={readOnly}
            placeholder="Additional notes about mode of delivery"
            className="min-h-[100px]"
          />
        </div>
      </CardContent>
    </Card>
  )
}
