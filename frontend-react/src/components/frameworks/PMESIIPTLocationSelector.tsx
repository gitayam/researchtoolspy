import { useState, useEffect } from 'react'
import { MapPin, Calendar } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface LocationData {
  country: string
  region?: string
  city?: string
  time_period_start?: string
  time_period_end?: string
  scope_objectives?: string
}

interface PMESIIPTLocationSelectorProps {
  value: LocationData
  onChange: (data: LocationData) => void
  suggestedLocations?: string[] // From extracted entities
}

export function PMESIIPTLocationSelector({
  value,
  onChange,
  suggestedLocations = []
}: PMESIIPTLocationSelectorProps) {
  const [localData, setLocalData] = useState<LocationData>(value)

  useEffect(() => {
    onChange(localData)
  }, [localData, onChange])

  const updateField = (field: keyof LocationData, val: string) => {
    setLocalData(prev => ({ ...prev, [field]: val }))
  }

  return (
    <Card className="border-l-4 border-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          Geographic Context
        </CardTitle>
        <CardDescription>
          PMESII-PT analysis is location-specific. Define the geographic scope of your analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Country (Required) */}
        <div>
          <Label className="text-sm font-medium">
            Country <span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="e.g., Ukraine, Afghanistan, China"
            value={localData.country || ''}
            onChange={(e) => updateField('country', e.target.value)}
            className="mt-1"
            required
          />
          {suggestedLocations.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Detected locations:</p>
              <div className="flex flex-wrap gap-1">
                {suggestedLocations.slice(0, 5).map((location, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateField('country', location)}
                    className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  >
                    {location}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Region/State (Optional) */}
        <div>
          <Label className="text-sm font-medium">State / Region / Province (Optional)</Label>
          <Input
            placeholder="e.g., Donbas, Helmand, Xinjiang"
            value={localData.region || ''}
            onChange={(e) => updateField('region', e.target.value)}
            className="mt-1"
          />
        </div>

        {/* City (Optional) */}
        <div>
          <Label className="text-sm font-medium">City (Optional)</Label>
          <Input
            placeholder="e.g., Mariupol, Kandahar, Urumqi"
            value={localData.city || ''}
            onChange={(e) => updateField('city', e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Time Period */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Start Date
            </Label>
            <Input
              type="date"
              value={localData.time_period_start || ''}
              onChange={(e) => updateField('time_period_start', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              End Date
            </Label>
            <Input
              type="date"
              value={localData.time_period_end || ''}
              onChange={(e) => updateField('time_period_end', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {/* Scope/Objectives */}
        <div>
          <Label className="text-sm font-medium">Analysis Scope & Objectives</Label>
          <Textarea
            placeholder="Describe the purpose and scope of this analysis... e.g., 'Assess economic and military situation in contested border regions'"
            value={localData.scope_objectives || ''}
            onChange={(e) => updateField('scope_objectives', e.target.value)}
            className="mt-1"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            What specific aspects are you analyzing? What decisions will this support?
          </p>
        </div>

        {/* Helper Info */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs space-y-1">
          <p className="font-medium text-blue-900 dark:text-blue-100">💡 Why location matters:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200 ml-2">
            <li>PMESII-PT evidence is tagged with location for reuse</li>
            <li>Filter analyses by country/region in Evidence Library</li>
            <li>Compare PMESII factors across different locations</li>
            <li>Time period helps track changes and trends</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
