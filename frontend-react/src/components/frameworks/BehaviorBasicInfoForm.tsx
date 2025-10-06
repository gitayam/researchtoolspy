import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, MapPin, Globe, Clock, Users, AlertCircle, Plus } from 'lucide-react'
import type {
  LocationContext,
  BehaviorSettings,
  TemporalContext,
  EligibilityRequirements,
  BehaviorComplexity,
  GeographicScope,
  BehaviorSettingType,
  FrequencyPattern,
  TimeOfDay,
  FrequencyTimeUnit
} from '@/types/behavior'

interface BehaviorBasicInfoFormProps {
  title: string
  description: string
  locationContext: LocationContext
  behaviorSettings: BehaviorSettings
  temporalContext: TemporalContext
  eligibility: EligibilityRequirements
  complexity: BehaviorComplexity
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onLocationContextChange: (value: LocationContext) => void
  onBehaviorSettingsChange: (value: BehaviorSettings) => void
  onTemporalContextChange: (value: TemporalContext) => void
  onEligibilityChange: (value: EligibilityRequirements) => void
  onComplexityChange: (value: BehaviorComplexity) => void
}

export function BehaviorBasicInfoForm({
  title,
  description,
  locationContext,
  behaviorSettings,
  temporalContext,
  eligibility,
  complexity,
  onTitleChange,
  onDescriptionChange,
  onLocationContextChange,
  onBehaviorSettingsChange,
  onTemporalContextChange,
  onEligibilityChange,
  onComplexityChange
}: BehaviorBasicInfoFormProps) {
  const [newLocation, setNewLocation] = useState('')
  const [newAgeReq, setNewAgeReq] = useState('')
  const [newLegalReq, setNewLegalReq] = useState('')
  const [newSkillReq, setNewSkillReq] = useState('')
  const [newResourceReq, setNewResourceReq] = useState('')
  const [newOtherReq, setNewOtherReq] = useState('')

  const geographicScopes: { value: GeographicScope; label: string; example: string }[] = [
    { value: 'local', label: 'Local', example: 'City or neighborhood level' },
    { value: 'regional', label: 'Regional', example: 'State or province level' },
    { value: 'national', label: 'National', example: 'Country-wide' },
    { value: 'international', label: 'International', example: 'Multiple countries' },
    { value: 'global', label: 'Global', example: 'Worldwide (rare)' }
  ]

  const settingTypes: { value: BehaviorSettingType; label: string; icon: string }[] = [
    { value: 'in_person', label: 'In Person', icon: '🏢' },
    { value: 'online', label: 'Online', icon: '💻' },
    { value: 'hybrid', label: 'Hybrid', icon: '🔄' },
    { value: 'phone', label: 'Phone', icon: '📞' },
    { value: 'mail', label: 'Mail', icon: '📬' },
    { value: 'app', label: 'Mobile App', icon: '📱' }
  ]

  const frequencyPatterns: { value: FrequencyPattern; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly (Every 3 Months)' },
    { value: 'semi_annual', label: 'Semi-Annual (Twice a Year)' },
    { value: 'annual', label: 'Annual (Yearly)' },
    { value: 'biennial', label: 'Biennial (Every 2 Years)' },
    { value: 'seasonal', label: 'Seasonal' },
    { value: 'one_time', label: 'One-Time' },
    { value: 'irregular', label: 'Irregular' },
    { value: 'as_needed', label: 'As Needed' },
    { value: 'custom', label: 'Custom...' }
  ]

  const timeUnits: { value: FrequencyTimeUnit; label: string }[] = [
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' },
    { value: 'weeks', label: 'Weeks' },
    { value: 'months', label: 'Months' },
    { value: 'years', label: 'Years' }
  ]

  const timesOfDay: { value: TimeOfDay; label: string; icon: string }[] = [
    { value: 'morning', label: 'Morning', icon: '🌅' },
    { value: 'afternoon', label: 'Afternoon', icon: '☀️' },
    { value: 'evening', label: 'Evening', icon: '🌆' },
    { value: 'night', label: 'Night', icon: '🌙' },
    { value: 'any_time', label: 'Any Time', icon: '🕐' }
  ]

  const complexityLevels: { value: BehaviorComplexity; label: string; description: string }[] = [
    { value: 'single_action', label: 'Single Action', description: 'One simple step (e.g., press button, make call)' },
    { value: 'simple_sequence', label: 'Simple Sequence', description: '2-5 straightforward steps in order' },
    { value: 'complex_process', label: 'Complex Process', description: 'Multiple steps with decisions and alternatives' },
    { value: 'ongoing_practice', label: 'Ongoing Practice', description: 'Continuous or repeated behavior over time' }
  ]

  const addLocation = () => {
    if (newLocation.trim()) {
      onLocationContextChange({
        ...locationContext,
        specific_locations: [...(locationContext.specific_locations || []), newLocation.trim()]
      })
      setNewLocation('')
    }
  }

  const removeLocation = (index: number) => {
    onLocationContextChange({
      ...locationContext,
      specific_locations: locationContext.specific_locations?.filter((_, i) => i !== index) || []
    })
  }

  // Helper functions for eligibility requirements
  const addAgeReq = () => {
    if (newAgeReq.trim()) {
      onEligibilityChange({
        ...eligibility,
        age_requirements: [...(eligibility.age_requirements || []), newAgeReq.trim()]
      })
      setNewAgeReq('')
    }
  }

  const removeAgeReq = (index: number) => {
    onEligibilityChange({
      ...eligibility,
      age_requirements: eligibility.age_requirements?.filter((_, i) => i !== index) || []
    })
  }

  const addLegalReq = () => {
    if (newLegalReq.trim()) {
      onEligibilityChange({
        ...eligibility,
        legal_requirements: [...(eligibility.legal_requirements || []), newLegalReq.trim()]
      })
      setNewLegalReq('')
    }
  }

  const removeLegalReq = (index: number) => {
    onEligibilityChange({
      ...eligibility,
      legal_requirements: eligibility.legal_requirements?.filter((_, i) => i !== index) || []
    })
  }

  const addSkillReq = () => {
    if (newSkillReq.trim()) {
      onEligibilityChange({
        ...eligibility,
        skill_requirements: [...(eligibility.skill_requirements || []), newSkillReq.trim()]
      })
      setNewSkillReq('')
    }
  }

  const removeSkillReq = (index: number) => {
    onEligibilityChange({
      ...eligibility,
      skill_requirements: eligibility.skill_requirements?.filter((_, i) => i !== index) || []
    })
  }

  const addResourceReq = () => {
    if (newResourceReq.trim()) {
      onEligibilityChange({
        ...eligibility,
        resource_requirements: [...(eligibility.resource_requirements || []), newResourceReq.trim()]
      })
      setNewResourceReq('')
    }
  }

  const removeResourceReq = (index: number) => {
    onEligibilityChange({
      ...eligibility,
      resource_requirements: eligibility.resource_requirements?.filter((_, i) => i !== index) || []
    })
  }

  const addOtherReq = () => {
    if (newOtherReq.trim()) {
      onEligibilityChange({
        ...eligibility,
        other_requirements: [...(eligibility.other_requirements || []), newOtherReq.trim()]
      })
      setNewOtherReq('')
    }
  }

  const removeOtherReq = (index: number) => {
    onEligibilityChange({
      ...eligibility,
      other_requirements: eligibility.other_requirements?.filter((_, i) => i !== index) || []
    })
  }

  const toggleSetting = (setting: BehaviorSettingType) => {
    const currentSettings = behaviorSettings.settings || []
    const newSettings = currentSettings.includes(setting)
      ? currentSettings.filter(s => s !== setting)
      : [...currentSettings, setting]
    onBehaviorSettingsChange({ ...behaviorSettings, settings: newSettings })
  }

  const toggleTimeOfDay = (time: TimeOfDay) => {
    const currentTimes = temporalContext.time_of_day || []
    const newTimes = currentTimes.includes(time)
      ? currentTimes.filter(t => t !== time)
      : [...currentTimes, time]
    onTemporalContextChange({ ...temporalContext, time_of_day: newTimes })
  }

  // Validation warnings
  const showLocationWarning = !locationContext.specific_locations || locationContext.specific_locations.length === 0
  const showSettingsWarning = !behaviorSettings.settings || behaviorSettings.settings.length === 0

  return (
    <div className="space-y-6">
      {/* Behavior + Location Explainer */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">📍</div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-1">
              Behavior Analysis = BEHAVIOR + LOCATION
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
              You're documenting a <strong>specific behavior in a specific place/context</strong>, not behavior in the abstract.
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
              <li><strong>Example:</strong> "Voting" varies by country, state, and local regulations</li>
              <li><strong>Example:</strong> "Solar panel adoption" differs by region (incentives, climate, regulations)</li>
              <li>Even online behaviors vary by platform, language, and culture</li>
            </ul>
            <div className="mt-2 text-xs font-semibold text-purple-800 dark:text-purple-200">
              ⚠️ Location context is REQUIRED - be as specific as possible!
            </div>
          </div>
        </div>
      </div>

      {/* Title & Description */}
      <Card>
        <CardHeader>
          <CardTitle>Behavior Identification</CardTitle>
          <CardDescription>What behavior are you analyzing? Be specific and clear.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Behavior Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="e.g., Voting in Presidential Elections, Installing Residential Solar Panels"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Behavior Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Provide a clear, concise description of the behavior you're analyzing..."
              rows={3}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Location Context - CRITICAL FOR PUBLIC INDEXING */}
      <Card className={showLocationWarning ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location & Geographic Context *
          </CardTitle>
          <CardDescription>
            <strong>Critical:</strong> Behaviors vary by location. Specify WHERE this behavior occurs for accurate analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showLocationWarning && (
            <div className="flex items-start gap-2 p-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 rounded-md">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Location required:</strong> Add specific locations to make this analysis useful for others.
                Examples: "California, USA", "Lagos, Nigeria", "European Union"
              </div>
            </div>
          )}

          <div>
            <Label>Geographic Scope *</Label>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-2">
              {geographicScopes.map(scope => (
                <button
                  key={scope.value}
                  type="button"
                  onClick={() => onLocationContextChange({ ...locationContext, geographic_scope: scope.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    locationContext.geographic_scope === scope.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{scope.label}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{scope.example}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Specific Locations * (City, State, Country, Region)</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
                placeholder="e.g., California, USA"
              />
              <Button type="button" onClick={addLocation}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {locationContext.specific_locations?.map((location, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  <Globe className="h-3 w-3" />
                  {location}
                  <button
                    type="button"
                    onClick={() => removeLocation(index)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="location_notes">Location-Specific Notes (Optional)</Label>
            <Textarea
              id="location_notes"
              value={locationContext.location_notes || ''}
              onChange={(e) => onLocationContextChange({ ...locationContext, location_notes: e.target.value })}
              placeholder="Any important location-specific context? (regulations, cultural factors, infrastructure)"
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Behavior Settings */}
      <Card className={showSettingsWarning ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : ''}>
        <CardHeader>
          <CardTitle>Behavior Settings *</CardTitle>
          <CardDescription>Where/how does this behavior take place? Select all that apply.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {settingTypes.map(setting => (
              <button
                key={setting.value}
                type="button"
                onClick={() => toggleSetting(setting.value)}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  behaviorSettings.settings?.includes(setting.value)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{setting.icon}</span>
                  <span className="font-medium">{setting.label}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <Label htmlFor="setting_details">Setting Details (Optional)</Label>
            <Textarea
              id="setting_details"
              value={behaviorSettings.setting_details || ''}
              onChange={(e) => onBehaviorSettingsChange({ ...behaviorSettings, setting_details: e.target.value })}
              placeholder="Additional details about where/how this behavior occurs..."
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Temporal Context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            When Does This Behavior Occur?
          </CardTitle>
          <CardDescription>Understanding timing helps identify patterns and opportunities.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Frequency Pattern</Label>
            <select
              value={temporalContext.frequency_pattern || ''}
              onChange={(e) => onTemporalContextChange({ ...temporalContext, frequency_pattern: e.target.value as FrequencyPattern })}
              className="w-full mt-1 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="">Select frequency...</option>
              {frequencyPatterns.map(freq => (
                <option key={freq.value} value={freq.value}>{freq.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Frequency Inputs */}
          {temporalContext.frequency_pattern === 'custom' && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="custom_number">Every</Label>
                <Input
                  id="custom_number"
                  type="number"
                  min="1"
                  value={temporalContext.custom_frequency_number || ''}
                  onChange={(e) => onTemporalContextChange({
                    ...temporalContext,
                    custom_frequency_number: parseInt(e.target.value) || undefined
                  })}
                  placeholder="1"
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="custom_unit">Time Unit</Label>
                <select
                  id="custom_unit"
                  value={temporalContext.custom_frequency_unit || ''}
                  onChange={(e) => onTemporalContextChange({
                    ...temporalContext,
                    custom_frequency_unit: e.target.value as FrequencyTimeUnit
                  })}
                  className="w-full mt-1 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="">Select unit...</option>
                  {timeUnits.map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <Label>Time of Day (Select all that apply)</Label>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-2">
              {timesOfDay.map(time => (
                <button
                  key={time.value}
                  type="button"
                  onClick={() => toggleTimeOfDay(time.value)}
                  className={`p-3 rounded-lg border-2 text-center transition-colors ${
                    temporalContext.time_of_day?.includes(time.value)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl">{time.icon}</div>
                  <div className="text-xs mt-1">{time.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="duration">Typical Duration</Label>
            <Input
              id="duration"
              value={temporalContext.duration_typical || ''}
              onChange={(e) => onTemporalContextChange({ ...temporalContext, duration_typical: e.target.value })}
              placeholder="e.g., 5 minutes, 1 hour, ongoing"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="timing_notes">Timing Notes (Optional)</Label>
            <Textarea
              id="timing_notes"
              value={temporalContext.timing_notes || ''}
              onChange={(e) => onTemporalContextChange({ ...temporalContext, timing_notes: e.target.value })}
              placeholder="Any seasonal variations, peak times, or scheduling constraints?"
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Eligibility Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Who Can Perform This Behavior?
          </CardTitle>
          <CardDescription>Document any requirements or prerequisites to perform this behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="has_requirements"
              checked={eligibility.has_requirements}
              onChange={(e) => onEligibilityChange({ ...eligibility, has_requirements: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="has_requirements" className="cursor-pointer">
              This behavior has eligibility requirements or prerequisites
            </Label>
          </div>

          {eligibility.has_requirements && (
            <div className="space-y-4 ml-6 mt-3">
              {/* Age Requirements */}
              <div>
                <Label>Age Requirements</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newAgeReq}
                    onChange={(e) => setNewAgeReq(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAgeReq())}
                    placeholder="e.g., Must be 18"
                  />
                  <Button type="button" onClick={addAgeReq} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {eligibility.age_requirements?.map((req, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {req}
                      <button
                        type="button"
                        onClick={() => removeAgeReq(index)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Legal Requirements */}
              <div>
                <Label>Legal Requirements</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newLegalReq}
                    onChange={(e) => setNewLegalReq(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLegalReq())}
                    placeholder="e.g., US Citizen"
                  />
                  <Button type="button" onClick={addLegalReq} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {eligibility.legal_requirements?.map((req, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {req}
                      <button
                        type="button"
                        onClick={() => removeLegalReq(index)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Skill Requirements */}
              <div>
                <Label>Skill Requirements</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newSkillReq}
                    onChange={(e) => setNewSkillReq(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkillReq())}
                    placeholder="e.g., Computer literacy"
                  />
                  <Button type="button" onClick={addSkillReq} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {eligibility.skill_requirements?.map((req, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {req}
                      <button
                        type="button"
                        onClick={() => removeSkillReq(index)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Resource Requirements */}
              <div>
                <Label>Resource Requirements</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newResourceReq}
                    onChange={(e) => setNewResourceReq(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addResourceReq())}
                    placeholder="e.g., Internet access"
                  />
                  <Button type="button" onClick={addResourceReq} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {eligibility.resource_requirements?.map((req, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {req}
                      <button
                        type="button"
                        onClick={() => removeResourceReq(index)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Other Requirements */}
              <div>
                <Label>Other Requirements</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newOtherReq}
                    onChange={(e) => setNewOtherReq(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addOtherReq())}
                    placeholder="Any other prerequisites"
                  />
                  <Button type="button" onClick={addOtherReq} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {eligibility.other_requirements?.map((req, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {req}
                      <button
                        type="button"
                        onClick={() => removeOtherReq(index)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complexity Level */}
      <Card>
        <CardHeader>
          <CardTitle>Behavior Complexity</CardTitle>
          <CardDescription>How complex is this behavior? This helps determine timeline detail level.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {complexityLevels.map(level => (
              <button
                key={level.value}
                type="button"
                onClick={() => onComplexityChange(level.value)}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  complexity === level.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{level.label}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{level.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
