/**
 * AI Preferences Component
 *
 * UI for managing AI model and behavior settings
 */

import { useCallback } from 'react'
import { Sparkles, DollarSign, Zap, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import type { AISettings, AIModel } from '@/types/settings'
import { DEFAULT_MODELS, MODEL_PRICING } from '../../../functions/api/_shared/ai-models'

interface AIPreferencesProps {
  settings: AISettings
  onUpdate: (updates: Partial<AISettings>) => Promise<void>
  updating?: boolean
}

/**
 * What the chooser offers, described by the job rather than the model name.
 *
 * The list it replaced named three gpt-5.4 models and quoted their prices as
 * literals. Two of the three are now beaten on both price axes by a single
 * newer model, and the quoted prices had no connection to the ones the cost
 * tracker actually used — so the reader was picking between options that no
 * longer existed, at prices that were no longer real.
 *
 * Options and prices both come from the tier table now, so this cannot drift
 * from what the product actually spends.
 */
const TIER_INFO = [
  {
    tier: 'cheap' as const,
    name: 'Fast',
    description: 'Extraction, classification and summaries — what most work here is',
  },
  {
    tier: 'standard' as const,
    name: 'Considered',
    description: 'Synthesis and comparison, where the reasoning is the output',
  },
  {
    tier: 'premium' as const,
    name: 'Deep',
    description: 'The hardest analysis. Rarely worth the cost over Considered',
  },
]

function priceLabel(model: string): string {
  const price = MODEL_PRICING[model]
  if (!price) return 'pricing not published'
  return `$${price.input.toFixed(2)}/$${price.output.toFixed(2)} per 1M tokens`
}

/** The offered options, plus whatever this account already had stored if it is
 *  no longer one of them — a preference saved before a model generation changed
 *  should still be readable, and labelled as the retired thing it is. */
function modelOptions(stored: string) {
  const options = TIER_INFO.map(info => ({
    model: DEFAULT_MODELS[info.tier],
    name: info.name,
    description: info.description,
    cost: priceLabel(DEFAULT_MODELS[info.tier]),
    retired: false,
  }))
  if (options.some(o => o.model === stored)) return options
  return [
    ...options,
    {
      model: stored,
      name: stored,
      description: 'No longer offered. Requests using it are served by Fast.',
      cost: priceLabel(stored),
      retired: true,
    },
  ]
}

export function AIPreferences({ settings, onUpdate, updating = false }: AIPreferencesProps) {
  const options = modelOptions(settings.default_model)

  const handleModelChange = useCallback(
    async (model: AIModel) => {
      await onUpdate({ default_model: model })
    },
    [onUpdate]
  )

  const handleTemperatureChange = useCallback(
    async (value: number[]) => {
      await onUpdate({ temperature: value[0] })
    },
    [onUpdate]
  )

  const handleMaxTokensChange = useCallback(
    async (value: number[]) => {
      await onUpdate({ max_tokens: value[0] })
    },
    [onUpdate]
  )

  const handleContextWindowChange = useCallback(
    async (value: number[]) => {
      await onUpdate({ context_window: value[0] })
    },
    [onUpdate]
  )

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Model
          </CardTitle>
          <CardDescription>
            Choose the default AI model for analysis tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={settings.default_model}
            onValueChange={(value) => handleModelChange(value as AIModel)}
            disabled={updating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.model} value={option.model}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.name}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Model Info Card */}
          {(() => {
            const info = options.find(o => o.model === settings.default_model) ?? options[0]
            return (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{info.name}</span>
                  <Badge variant="secondary" className="text-xs">{info.cost}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{info.description}</p>
                <p className="text-xs text-muted-foreground">{info.model}</p>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Model Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Model Parameters
          </CardTitle>
          <CardDescription>
            Fine-tune AI behavior and output characteristics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature">
                Temperature
              </Label>
              <span className="text-sm text-muted-foreground">
                {settings.temperature.toFixed(2)}
              </span>
            </div>
            <Slider
              id="temperature"
              min={0}
              max={1}
              step={0.05}
              value={[settings.temperature]}
              onValueChange={handleTemperatureChange}
              disabled={updating}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Lower values (0.0-0.3) are more focused and deterministic. Higher values (0.7-1.0) are more creative and varied.
            </p>
          </div>

          {/* Max Tokens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="max-tokens">
                Max Tokens
              </Label>
              <span className="text-sm text-muted-foreground">
                {settings.max_tokens.toLocaleString()}
              </span>
            </div>
            <Slider
              id="max-tokens"
              min={512}
              max={8192}
              step={256}
              value={[settings.max_tokens]}
              onValueChange={handleMaxTokensChange}
              disabled={updating}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Maximum length of AI responses. Higher values allow longer outputs but cost more.
            </p>
          </div>

          {/* Context Window */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="context-window">
                Context Window
              </Label>
              <span className="text-sm text-muted-foreground">
                {settings.context_window.toLocaleString()}
              </span>
            </div>
            <Slider
              id="context-window"
              min={2048}
              max={16384}
              step={1024}
              value={[settings.context_window]}
              onValueChange={handleContextWindowChange}
              disabled={updating}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Amount of context the AI considers. Larger windows provide better understanding but use more tokens.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Features */}
      <Card>
        <CardHeader>
          <CardTitle>AI Features</CardTitle>
          <CardDescription>
            Enable or disable specific AI capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="cost-tracking">Cost Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Display estimated costs for AI operations
              </p>
            </div>
            <Switch
              id="cost-tracking"
              checked={settings.show_cost_tracking}
              onCheckedChange={(checked) => onUpdate({ show_cost_tracking: checked })}
              disabled={updating}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="token-usage">Token Usage</Label>
              <p className="text-sm text-muted-foreground">
                Show token consumption statistics
              </p>
            </div>
            <Switch
              id="token-usage"
              checked={settings.show_token_usage}
              onCheckedChange={(checked) => onUpdate({ show_token_usage: checked })}
              disabled={updating}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-suggestions">Auto Suggestions</Label>
              <p className="text-sm text-muted-foreground">
                Get AI-powered suggestions while typing
              </p>
            </div>
            <Switch
              id="auto-suggestions"
              checked={settings.auto_suggestions}
              onCheckedChange={(checked) => onUpdate({ auto_suggestions: checked })}
              disabled={updating}
            />
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Statistics
          </CardTitle>
          <CardDescription>
            Track your AI usage and costs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm">Today's Token Usage</span>
              <span className="font-medium">0 / {settings.max_tokens.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Estimated Cost Today
              </span>
              <span className="font-medium">$0.00</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Usage statistics are calculated in real-time. Costs are estimates based on current pricing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
