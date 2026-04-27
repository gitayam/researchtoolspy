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
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Info } from 'lucide-react'

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
  notes: ''
}

export function isModeOfDeliveryComplete(m: ModeOfDelivery): boolean {
  return m.delivery_modes.length > 0 && m.group_size !== undefined && m.frequency !== undefined && m.deliverer.trim().length > 0
}

interface Props {
  mode: ModeOfDelivery
  onChange: (m: ModeOfDelivery) => void
  readOnly?: boolean
}

export function ModeOfDeliveryForm({ mode, onChange, readOnly = false }: Props): JSX.Element {
  const handleDeliveryModesChange = (value: string[]) => {
    onChange({ ...mode, delivery_modes: value as DeliveryMode[] })
  }

  const handleGroupSizeChange = (value: string) => {
    onChange({ ...mode, group_size: value as DeliveryGroupSize })
  }

  const handleFrequencyChange = (value: string) => {
    onChange({ ...mode, frequency: value as DeliveryFrequency })
  }

  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...mode, setting: e.target.value })
  }

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...mode, duration_typical: e.target.value })
  }

  const handleDelivererChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...mode, deliverer: e.target.value })
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...mode, notes: e.target.value })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span>📡</span> Mode of Delivery (BCW Step 8)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Delivery modes */}
        <div className="space-y-2">
          <Label htmlFor="delivery-modes">Delivery modes</Label>
          <ToggleGroup
            type="multiple"
            variant="outline"
            value={mode.delivery_modes}
            onValueChange={handleDeliveryModesChange}
            disabled={readOnly}
            className="grid grid-cols-2 gap-2 w-full"
          >
            <ToggleGroupItem value="face_to_face" aria-label="Face to face">
              <span className="flex items-center gap-1">
                <span>👤</span> Face to face
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="broadcast" aria-label="Broadcast media">
              <span className="flex items-center gap-1">
                <span>📺</span> Broadcast media
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="internet" aria-label="Internet">
              <span className="flex items-center gap-1">
                <span>🌐</span> Internet
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="app" aria-label="Mobile app">
              <span className="flex items-center gap-1">
                <span>📱</span> Mobile app
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="print" aria-label="Print">
              <span className="flex items-center gap-1">
                <span>📄</span> Print
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="phone" aria-label="Phone">
              <span className="flex items-center gap-1">
                <span>📞</span> Phone
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="mail" aria-label="Mail">
              <span className="flex items-center gap-1">
                <span>📬</span> Mail
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="other" aria-label="Other">
              <span className="flex items-center gap-1">
                <span>•</span> Other
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Group size */}
        <div className="space-y-2">
          <Label>Group size</Label>
          <RadioGroup
            value={mode.group_size}
            onValueChange={handleGroupSizeChange}
            disabled={readOnly}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="individual" id="individual" />
              <Label htmlFor="individual">Individual</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="small_group" id="small_group" />
              <Label htmlFor="small_group">Small group</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="large_group" id="large_group" />
              <Label htmlFor="large_group">Large group</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="population" id="population" />
              <Label htmlFor="population">Population</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Frequency */}
        <div className="space-y-2">
          <Label>Frequency</Label>
          <RadioGroup
            value={mode.frequency}
            onValueChange={handleFrequencyChange}
            disabled={readOnly}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="one_off" id="one_off" />
              <Label htmlFor="one_off" className="flex items-center gap-1">
                One-off <Info size={14} className="text-gray-400" />
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sequence" id="sequence" />
              <Label htmlFor="sequence" className="flex items-center gap-1">
                Sequence <Info size={14} className="text-gray-400" />
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="periodic" id="periodic" />
              <Label htmlFor="periodic" className="flex items-center gap-1">
                Periodic <Info size={14} className="text-gray-400" />
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="continuous" id="continuous" />
              <Label htmlFor="continuous" className="flex items-center gap-1">
                Continuous <Info size={14} className="text-gray-400" />
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Setting */}
        <div className="space-y-2">
          <Label htmlFor="setting">Setting</Label>
          <Input
            id="setting"
            value={mode.setting}
            onChange={handleSettingChange}
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
            onChange={handleDurationChange}
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
            onChange={handleDelivererChange}
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
            onChange={handleNotesChange}
            readOnly={readOnly}
            placeholder="Additional notes about mode of delivery"
            className="min-h-[100px]"
          />
        </div>
      </CardContent>
    </Card>
  )
}
