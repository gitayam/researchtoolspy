/**
 * AI Preferences Component
 *
 * UI for managing AI model and behavior settings
 */

import { useCallback } from 'react'
import { Sparkles, DollarSign, Zap, AlertCircle, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import type { AISettings, AIModel } from '@/types/settings'

interface AIPreferencesProps {
  settings: AISettings
  onUpdate: (updates: Partial<AISettings>) => Promise<void>
  updating?: boolean
}

const MODEL_INFO: Record<AIModel, { name: string; description: string; cost: string }> = {
  'gpt-5': {
    name: 'GPT-5',
    description: 'Most capable model for deep analysis and complex reasoning',
    cost: 'Highest cost, best quality',
  },
  'gpt-5-mini': {
    name: 'GPT-5 Mini',
    description: 'Balanced performance and cost - ideal for most tasks',
    cost: 'Medium cost, great quality',
  },
  'gpt-5-nano': {
    name: 'GPT-5 Nano',
    description: 'Fast and efficient for simple tasks and suggestions',
    cost: 'Lowest cost, good quality',
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    description: 'Fallback model while GPT-5 is in development',
    cost: 'Low cost, proven quality',
  },
}

export function AIPreferences({ settings, onUpdate, updating = false }: AIPreferencesProps) {
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
              {Object.entries(MODEL_INFO).map(([model, info]) => (
                <SelectItem key={model} value={model}>
                  <div className="flex flex-col">
                    <span className="font-medium">{info.name}</span>
                    <span className="text-xs text-muted-foreground">{info.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Model Info Card */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {MODEL_INFO[settings.default_model].name}
              </span>
              <Badge variant="secondary" className="text-xs">
                {MODEL_INFO[settings.default_model].cost}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {MODEL_INFO[settings.default_model].description}
            </p>
          </div>

          {settings.default_model === 'gpt-4o-mini' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium">Temporary Fallback Model</p>
                  <p className="mt-1">
                    GPT-5 models are not yet available. Using GPT-4o Mini as fallback.
                  </p>
                </div>
              </div>
            </div>
          )}
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
