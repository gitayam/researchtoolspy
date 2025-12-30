/**
 * AI Settings Page
 *
 * Configuration interface for AI features and model settings
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, DollarSign, Zap, AlertCircle, CheckCircle, Settings, BarChart3 } from 'lucide-react'
import type { AIConfiguration, AIModel } from '@/lib/ai/config'
import { MODEL_PRICING } from '@/lib/ai/config'
import { useTranslation } from 'react-i18next'

// API response type extends AIConfiguration with additional runtime fields
interface AIConfigResponse extends AIConfiguration {
  enabled?: boolean
  hasApiKey?: boolean
}

export function AISettingsPage() {
  const { t } = useTranslation(['aiSettings', 'common'])
  const [config, setConfig] = useState<AIConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Load configuration
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/ai/config')
      if (!response.ok) throw new Error(t('aiSettings:loadFailed'))

      const data = await response.json()
      setConfig(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiSettings:loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    if (!config) return

    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || t('aiSettings:saveFailed'))
      }

      setSuccessMessage(t('aiSettings:saveSuccess'))
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiSettings:saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const resetConfig = async () => {
    if (!confirm(t('aiSettings:resetConfirm'))) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch('/api/ai/config', {
        method: 'POST'
      })

      if (!response.ok) throw new Error(t('aiSettings:resetFailed'))

      const data = await response.json()
      setConfig(data.config)
      setSuccessMessage(t('aiSettings:resetSuccess'))
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiSettings:resetFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-gray-400">{t('aiSettings:loading')}</div>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5" />
              <span>{error || t('aiSettings:loadFailed')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('aiSettings:title')}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {t('aiSettings:description')}
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="h-5 w-5" />
              <span>{successMessage}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('aiSettings:status.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('aiSettings:status.features')}</Label>
                  <p className="text-sm text-muted-foreground">{t('aiSettings:status.featuresDesc')}</p>
                </div>
                <Badge variant={config.enabled ? 'default' : 'secondary'}>
                  {config.enabled ? t('aiSettings:status.enabled') : t('aiSettings:status.disabled')}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('aiSettings:status.apiKey')}</Label>
                  <p className="text-sm text-muted-foreground">{t('aiSettings:status.apiKeyDesc')}</p>
                </div>
                <Badge variant={config.hasApiKey ? 'default' : 'destructive'}>
                  {config.hasApiKey ? t('aiSettings:status.configured') : t('aiSettings:status.notSet')}
                </Badge>
              </div>

              {!config.hasApiKey && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>{t('common:note')}:</strong> {t('aiSettings:status.note')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                {t('aiSettings:modelConfig.title')}
              </CardTitle>
              <CardDescription>
                {t('aiSettings:modelConfig.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default Model */}
              <div className="space-y-2">
                <Label htmlFor="defaultModel">{t('aiSettings:modelConfig.defaultModel')}</Label>
                <Select
                  value={config.defaultModel || 'gpt-5-mini'}
                  onValueChange={(value: AIModel) =>
                    setConfig({ ...config, defaultModel: value })
                  }
                >
                  <SelectTrigger id="defaultModel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5">
                      <div className="flex items-center justify-between gap-4">
                        <span>{t('aiSettings:modelConfig.models.gpt5')}</span>
                        <span className="text-xs text-muted-foreground">{t('aiSettings:modelConfig.models.deepAnalysis')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt-5-mini">
                      <div className="flex items-center justify-between gap-4">
                        <span>{t('aiSettings:modelConfig.models.gpt5mini')}</span>
                        <span className="text-xs text-muted-foreground">{t('aiSettings:modelConfig.models.balanced')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt-5-nano">
                      <div className="flex items-center justify-between gap-4">
                        <span>{t('aiSettings:modelConfig.models.gpt5nano')}</span>
                        <span className="text-xs text-muted-foreground">{t('aiSettings:modelConfig.models.fastCheap')}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {t('aiSettings:modelConfig.defaultModelDesc')}
                </p>
              </div>

              {/* Use Case Mappings */}
              <div className="space-y-3">
                <Label>{t('aiSettings:modelConfig.useCaseAssignments')}</Label>

                {Object.entries(config.useCases).map(([useCase, model]) => (
                  <div key={useCase} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm capitalize">{useCase.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <Select
                      value={model}
                      onValueChange={(value: AIModel) =>
                        setConfig({
                          ...config,
                          useCases: { ...config.useCases, [useCase]: value }
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-5">{t('aiSettings:modelConfig.models.gpt5')}</SelectItem>
                        <SelectItem value="gpt-5-mini">{t('aiSettings:modelConfig.models.gpt5mini')}</SelectItem>
                        <SelectItem value="gpt-5-nano">{t('aiSettings:modelConfig.models.gpt5nano')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>{t('aiSettings:features.title')}</CardTitle>
              <CardDescription>{t('aiSettings:features.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(config.features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center justify-between">
                  <div>
                    <Label htmlFor={feature} className="capitalize">
                      {t(`aiSettings:features.${feature.replace('enable', '').toLowerCase()}` as any, feature.replace(/([A-Z])/g, ' $1').replace('enable', '').trim())}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t(`aiSettings:features.${feature.replace('enable', '').toLowerCase()}Desc` as any)}
                    </p>
                  </div>
                  <Switch
                    id={feature}
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      setConfig({
                        ...config,
                        features: { ...config.features, [feature]: checked }
                      })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card>
            <CardHeader>
              <CardTitle>{t('aiSettings:rateLimits.title')}</CardTitle>
              <CardDescription>{t('aiSettings:rateLimits.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('aiSettings:rateLimits.requestsPerMinute')}</Label>
                <p className="text-2xl font-bold">{config.rateLimits.requestsPerMinute}</p>
                <p className="text-sm text-muted-foreground">{t('aiSettings:rateLimits.requestsPerMinuteDesc')}</p>
              </div>

              <div>
                <Label>{t('aiSettings:rateLimits.tokensPerDay')}</Label>
                <p className="text-2xl font-bold">{config.rateLimits.tokensPerDay.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{t('aiSettings:rateLimits.tokensPerDayDesc')}</p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>{t('aiSettings:rateLimits.estimatedCost')}</strong> $
                  {config.defaultModel && MODEL_PRICING[config.defaultModel]
                    ? ((config.rateLimits.tokensPerDay / 1_000_000) * MODEL_PRICING[config.defaultModel].output).toFixed(2)
                    : '0.00'}
                  {config.defaultModel && t('aiSettings:rateLimits.costNote', { model: config.defaultModel })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t('aiSettings:usage.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('aiSettings:usage.tokensUsed')}</Label>
                <p className="text-2xl font-bold">{config.costs?.totalTokensUsed?.toLocaleString() || 0}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(((config.costs?.totalTokensUsed || 0) / config.rateLimits.tokensPerDay) * 100, 100)}%`
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {((((config.costs?.totalTokensUsed || 0) / config.rateLimits.tokensPerDay) * 100)).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {t('aiSettings:usage.estimatedCost')}
                </Label>
                <p className="text-2xl font-bold">
                  ${(config.costs?.estimatedCost || 0).toFixed(4)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('aiSettings:usage.resets')} {config.costs?.lastReset ? new Date(config.costs.lastReset).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Model Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>{t('aiSettings:pricing.title')}</CardTitle>
              <CardDescription>{t('aiSettings:pricing.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(MODEL_PRICING).map(([model, pricing]) => (
                <div key={model} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{model}</Label>
                    {config.defaultModel && config.defaultModel === model && (
                      <Badge variant="secondary" className="text-xs">{t('aiSettings:pricing.default')}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between">
                      <span>{t('aiSettings:pricing.input')}</span>
                      <span>${pricing.input}/1M</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('aiSettings:pricing.output')}</span>
                      <span>${pricing.output}/1M</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={saveConfig}
              disabled={saving || !config.hasApiKey}
              className="w-full"
            >
              {saving ? t('aiSettings:actions.saving') : t('aiSettings:actions.save')}
            </Button>

            <Button
              onClick={resetConfig}
              variant="outline"
              disabled={saving}
              className="w-full"
            >
              {t('aiSettings:actions.reset')}
            </Button>

            <Button
              onClick={loadConfig}
              variant="ghost"
              disabled={loading}
              className="w-full"
            >
              {t('aiSettings:actions.refresh')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
