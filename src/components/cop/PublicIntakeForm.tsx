import { useState, useEffect, useCallback, useRef } from 'react'
import { Send, CheckCircle2, AlertCircle, MapPin, Upload, Camera, X, ClipboardPaste } from 'lucide-react'
import type { IntakeFormField } from '../../types/cop'

// Auto-detect platform from URL domain
function detectPlatformFromUrl(url: string): string | null {
  let normalized = url.trim()
  if (normalized && !normalized.match(/^https?:\/\//i)) {
    normalized = 'https://' + normalized
  }
  try {
    const hostname = new URL(normalized).hostname.toLowerCase()
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'Twitter/X'
    if (hostname.includes('t.me') || hostname.includes('telegram')) return 'Telegram'
    if (hostname.includes('instagram.com')) return 'Instagram'
    if (hostname.includes('tiktok.com')) return 'TikTok'
    if (hostname.includes('reddit.com')) return 'Reddit'
    if (hostname.includes('facebook.com') || hostname.includes('fb.com')) return 'Facebook'
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'YouTube'
    if (hostname.includes('vk.com')) return 'VKontakte'
    if (hostname.includes('discord.com') || hostname.includes('discord.gg')) return 'Discord'
    if (hostname.includes('irna.ir') || hostname.includes('presstv.ir') || hostname.includes('farsnews.ir')) return 'Iranian state media'
    if (hostname.includes('military.com') || hostname.includes('defense.gov') || hostname.includes('janes.com')) return 'Defense media'
    if (hostname.includes('reuters.com') || hostname.includes('apnews.com') || hostname.includes('bbc.') || hostname.includes('cnn.com') || hostname.includes('nbcnews.com') || hostname.includes('cbsnews.com')) return 'News website'
    if (hostname.includes('aljazeera.') || hostname.includes('middleeasteye.net')) return 'News website'
  } catch { /* not a valid URL yet */ }
  return null
}

// Extract handle from URL
function extractHandleFromUrl(url: string): string | null {
  let normalized = url.trim()
  if (normalized && !normalized.match(/^https?:\/\//i)) {
    normalized = 'https://' + normalized
  }
  try {
    const u = new URL(normalized)
    const hostname = u.hostname.toLowerCase()
    const path = u.pathname.replace(/\/$/, '')
    // Twitter/X: https://x.com/username or /username/status/123
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
      const parts = path.split('/').filter(Boolean)
      if (parts[0] && parts[0] !== 'i' && parts[0] !== 'search') return `@${parts[0]}`
    }
    // Telegram: https://t.me/channel
    if (hostname.includes('t.me')) {
      const parts = path.split('/').filter(Boolean)
      if (parts[0] && parts[0] !== 's') return `telegram:${parts[0]}`
    }
    // Instagram: https://instagram.com/username
    if (hostname.includes('instagram.com')) {
      const parts = path.split('/').filter(Boolean)
      if (parts[0] && parts[0] !== 'p' && parts[0] !== 'reel') return `@${parts[0]}`
    }
    // Reddit: https://reddit.com/r/subreddit or /u/user
    if (hostname.includes('reddit.com')) {
      const parts = path.split('/').filter(Boolean)
      if (parts[0] === 'r' && parts[1]) return `r/${parts[1]}`
      if (parts[0] === 'u' && parts[1]) return `u/${parts[1]}`
    }
  } catch { /* */ }
  return null
}

function isGeopointComplete(val: string | undefined): boolean {
  if (!val || !val.trim() || val === ',') return false
  const parts = val.split(',')
  return parts.length === 2 && parts[0].trim() !== '' && parts[1].trim() !== ''
}

interface PublicIntakeFormProps {
  token: string
}

export default function PublicIntakeForm({ token }: PublicIntakeFormProps) {
  const [formMeta, setFormMeta] = useState<{
    title: string; description: string | null
    form_schema: IntakeFormField[]
    require_location: boolean; require_contact: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitterName, setSubmitterName] = useState('')
  const [submitterContact, setSubmitterContact] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [verifyingPassword, setVerifyingPassword] = useState(false)
  const [countryBlocked, setCountryBlocked] = useState(false)
  const [expired, setExpired] = useState(false)
  const [themeColor, setThemeColor] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [formPassword, setFormPassword] = useState<string | null>(null) // stored for submission

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/surveys/public/${token}`, { signal: controller.signal })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) {
          if (data.country_blocked) { setCountryBlocked(true); setLoading(false); return }
          if (res.status === 403 && data.error?.includes('expired')) { setExpired(true); setLoading(false); return }
          throw new Error(data.error || 'Form not found')
        }
        if (data.requires_password) {
          setRequiresPassword(true)
          setThemeColor(data.theme_color || null)
          setLogoUrl(data.logo_url || null)
          setLoading(false)
          return
        }
        setFormMeta({
          title: data.title,
          description: data.description,
          form_schema: data.form_schema || [],
          require_location: data.require_location,
          require_contact: data.require_contact,
        })
        setThemeColor(data.theme_color || null)
        setLogoUrl(data.logo_url || null)
        setSuccessMessage(data.success_message || null)
        setLoading(false)
      })
      .catch(err => {
        if (err?.name !== 'AbortError') { setError(err.message); setLoading(false) }
      })
    return () => controller.abort()
  }, [token])

  const requestLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLon(pos.coords.longitude) },
      () => { /* User denied or unavailable */ }
    )
  }, [])

  const handleVerifyPassword = useCallback(async () => {
    if (!passwordInput.trim()) return
    setVerifyingPassword(true)
    setPasswordError(null)
    try {
      const res = await fetch(`/api/surveys/public/${token}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error || 'Incorrect password')
        setVerifyingPassword(false)
        return
      }
      setFormMeta({
        title: data.title,
        description: data.description,
        form_schema: data.form_schema || [],
        require_location: data.require_location,
        require_contact: data.require_contact,
      })
      setSuccessMessage(data.success_message || null)
      setFormPassword(passwordInput)
      setRequiresPassword(false)
      setVerifyingPassword(false)
    } catch {
      setPasswordError('Verification failed')
      setVerifyingPassword(false)
    }
  }, [token, passwordInput])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formMeta) return

    if (formMeta.require_location && (lat == null || lon == null)) {
      setError('Please share your location before submitting.')
      return
    }

    // Validate all required fields
    for (const field of formMeta.form_schema) {
      if (field.required) {
        const val = formData[field.name]
        // Geopoint: check both parts are present
        if (field.type === 'geopoint') {
          if (!isGeopointComplete(val as string)) {
            setError(`"${field.label}" requires both latitude and longitude`)
            return
          }
          continue // skip the generic empty check below
        }
        if (!val || !String(val).trim()) {
          setError(`"${field.label}" is required`)
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/surveys/public/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_data: formData,
          submitter_name: submitterName || null,
          submitter_contact: submitterContact || null,
          lat, lon,
          password: formPassword,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Submission failed')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }, [formMeta, formData, submitterName, submitterContact, lat, lon, token, formPassword])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><span className="text-sm text-muted-foreground">Loading...</span></div>
  if (error && !formMeta) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-2">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    </div>
  )
  // Country blocked screen
  if (countryBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Region Restricted</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">This form is not available in your region.</p>
        </div>
      </div>
    )
  }

  // Expired screen
  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-slate-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Form Expired</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">This form is no longer accepting submissions.</p>
        </div>
      </div>
    )
  }

  // Password gate
  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-md w-full space-y-6">
          {logoUrl && <img src={logoUrl} alt="" className="h-12 mx-auto" />}
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Password Required</h1>
            <p className="text-sm text-slate-500 mt-1">This form is password-protected.</p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerifyPassword()}
              placeholder="Enter password"
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}
            <button
              onClick={handleVerifyPassword}
              disabled={verifyingPassword || !passwordInput.trim()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              style={themeColor ? { backgroundColor: themeColor } : undefined}
            >
              {verifyingPassword ? 'Verifying...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) return (
    <SubmittedScreen
      token={token}
      successMessage={successMessage}
      onSubmitAnother={() => {
        setSubmitted(false)
        setFormData({})
        setSubmitterName('')
        setSubmitterContact('')
        setLat(null)
        setLon(null)
        setError(null)
      }}
    />
  )
  if (!formMeta) return null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-4 sm:py-8 px-4" style={{ touchAction: 'manipulation' }}>
      <div className="max-w-lg mx-auto space-y-4">
        {logoUrl && <img src={logoUrl} alt="" className="h-10 mx-auto mb-2" />}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-xl font-bold tracking-tight">{formMeta.title}</h1>
          {formMeta.description && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
              <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed whitespace-pre-line">{formMeta.description}</p>
            </div>
          )}
          <p className="text-xs text-slate-400">
            {formMeta.form_schema.filter(f => f.required).length} required field{formMeta.form_schema.filter(f => f.required).length !== 1 ? 's' : ''}
            {' \u00b7 '}All submissions reviewed by research team
          </p>
        </div>

        {/* Progress */}
        {(() => {
          const requiredFields = formMeta.form_schema.filter(f => f.required)
          const filledRequired = requiredFields.filter(f => {
            const val = formData[f.name]
            if (f.type === 'geopoint') return isGeopointComplete(val as string)
            return val && String(val).trim() !== '' && val !== ','
          })
          const pct = requiredFields.length > 0 ? Math.round((filledRequired.length / requiredFields.length) * 100) : 0
          return (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{filledRequired.length} of {requiredFields.length} required</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })()}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dynamic form fields */}
          {formMeta.form_schema.map(field => (
            <div key={field.name} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-2">
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                {field.label}
                {field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>

              {field.type === 'text' && (
                <input
                  type="text"
                  required={field.required}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  required={field.required}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background resize-none min-h-[44px]"
                />
              )}

              {field.type === 'number' && (
                <input
                  type="number"
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                />
              )}

              {field.type === 'datetime' && (
                <input
                  type="datetime-local"
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                />
              )}

              {field.type === 'select' && (
                <select
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                >
                  <option value="">Select...</option>
                  {(field.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.type === 'checkbox' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData[field.name] === 'true'}
                    onChange={e => setFormData(prev => ({ ...prev, [field.name]: String(e.target.checked) }))}
                  />
                  <span className="text-sm">{field.placeholder || field.label}</span>
                </label>
              )}

              {field.type === 'multiselect' && (
                <select
                  multiple
                  required={field.required}
                  value={formData[field.name] ? String(formData[field.name]).split(',') : []}
                  onChange={e => {
                    const selected = Array.from(e.target.selectedOptions, o => o.value)
                    setFormData(prev => ({ ...prev, [field.name]: selected.join(',') }))
                  }}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                  size={Math.min(5, (field.options || []).length)}
                >
                  {(field.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.type === 'url' && (
                <input
                  type="url"
                  required={field.required}
                  placeholder={field.placeholder || 'https://example.com'}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  onBlur={e => {
                    const url = e.target.value.trim()
                    if (!url) return
                    // Auto-fill platform field if one exists in this form
                    const platform = detectPlatformFromUrl(url)
                    if (platform && formMeta) {
                      const platformField = formMeta.form_schema.find(f => f.type === 'select' && f.name.includes('platform'))
                      if (platformField && !formData[platformField.name]) {
                        setFormData(prev => ({ ...prev, [platformField.name]: platform }))
                      }
                    }
                    // Auto-fill handle field if one exists
                    const handle = extractHandleFromUrl(url)
                    if (handle && formMeta) {
                      const handleField = formMeta.form_schema.find(f => f.type === 'handle')
                      if (handleField && !formData[handleField.name]) {
                        setFormData(prev => ({ ...prev, [handleField.name]: handle }))
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background font-mono min-h-[44px]"
                />
              )}

              {field.type === 'email' && (
                <input
                  type="email"
                  required={field.required}
                  placeholder={field.placeholder || 'name@example.com'}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                />
              )}

              {field.type === 'phone' && (
                <input
                  type="tel"
                  required={field.required}
                  placeholder={field.placeholder || '+1 (555) 000-0000'}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                />
              )}

              {field.type === 'ip_address' && (
                <input
                  type="text"
                  required={field.required}
                  placeholder={field.placeholder || '192.168.1.1 or 192.168.1.1:8080'}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  pattern="[\d.:a-fA-F]+"
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background font-mono min-h-[44px]"
                />
              )}

              {field.type === 'onion' && (
                <input
                  type="text"
                  required={field.required}
                  placeholder={field.placeholder || 'abcdef1234567890.onion'}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background font-mono min-h-[44px]"
                />
              )}

              {field.type === 'handle' && (
                <input
                  type="text"
                  required={field.required}
                  placeholder={field.placeholder || '@username or platform:username'}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background font-mono min-h-[44px]"
                />
              )}

              {field.type === 'crypto_address' && (
                <input
                  type="text"
                  required={field.required}
                  placeholder={field.placeholder || 'BTC, ETH, or other wallet address'}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background font-mono text-xs min-h-[44px]"
                />
              )}

              {field.type === 'geopoint' && (
                <div className="space-y-2">
                  {/* Smart location input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Paste map link, coordinates, or MGRS..."
                      value={formData[`${field.name}_raw`] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [`${field.name}_raw`]: e.target.value }))}
                      onBlur={async (e: React.FocusEvent<HTMLInputElement>) => {
                        const raw = (e.target as HTMLInputElement).value.trim()
                        if (!raw) return
                        setFormData(prev => ({ ...prev, [`${field.name}_resolving`]: 'true' }))
                        try {
                          const res = await fetch('/api/surveys/resolve-location', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ input: raw }),
                          })
                          const data = await res.json()
                          if (data.lat != null && data.lon != null) {
                            setFormData(prev => ({
                              ...prev,
                              [`${field.name}_lat`]: String(data.lat),
                              [`${field.name}_lon`]: String(data.lon),
                              [field.name]: `${data.lat},${data.lon}`,
                              [`${field.name}_format`]: data.format,
                              [`${field.name}_precision`]: data.precision || '',
                              [`${field.name}_mgrs`]: data.mgrs || '',
                              [`${field.name}_resolving`]: '',
                              [`${field.name}_error`]: '',
                            }))
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              [`${field.name}_resolving`]: '',
                              [`${field.name}_error`]: data.label || 'Could not resolve location',
                            }))
                          }
                        } catch {
                          setFormData(prev => ({
                            ...prev,
                            [`${field.name}_resolving`]: '',
                            [`${field.name}_error`]: 'Failed to resolve location',
                          }))
                        }
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}
                      className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background font-mono min-h-[44px]"
                    />
                  </div>

                  {/* Resolving indicator */}
                  {formData[`${field.name}_resolving`] === 'true' && (
                    <p className="text-xs text-blue-500 animate-pulse">Resolving location...</p>
                  )}

                  {/* Error */}
                  {formData[`${field.name}_error`] && (
                    <p className="text-xs text-red-500">{formData[`${field.name}_error`]}</p>
                  )}

                  {/* Resolved result */}
                  {formData[`${field.name}_lat`] && formData[`${field.name}_lon`] && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-500">&#10003;</span>
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {formData[`${field.name}_lat`]}, {formData[`${field.name}_lon`]}
                      </span>
                      {formData[`${field.name}_format`] && (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px]">
                          {formData[`${field.name}_format`]}
                        </span>
                      )}
                      {formData[`${field.name}_precision`] && (
                        <span className="text-slate-400 text-[10px]">
                          {formData[`${field.name}_precision`]}
                        </span>
                      )}
                      {formData[`${field.name}_mgrs`] && (
                        <span className="font-mono text-[10px] text-slate-400">
                          MGRS: {formData[`${field.name}_mgrs`]}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Use my location button */}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.geolocation.getCurrentPosition(
                        pos => {
                          setFormData(prev => ({
                            ...prev,
                            [`${field.name}_lat`]: String(pos.coords.latitude),
                            [`${field.name}_lon`]: String(pos.coords.longitude),
                            [field.name]: `${pos.coords.latitude},${pos.coords.longitude}`,
                            [`${field.name}_raw`]: `${pos.coords.latitude}, ${pos.coords.longitude}`,
                            [`${field.name}_format`]: 'gps',
                            [`${field.name}_precision`]: `\u00B1${Math.round(pos.coords.accuracy)}m`,
                            [`${field.name}_error`]: '',
                          }))
                        },
                        () => {
                          setFormData(prev => ({ ...prev, [`${field.name}_error`]: 'Location access denied' }))
                        }
                      )
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <MapPin className="h-4 w-4" />
                    Use my current location
                  </button>

                  {/* Manual lat/lon fallback */}
                  <details className="text-xs">
                    <summary className="py-2 text-slate-500 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">Enter lat/lon manually</summary>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        step="any"
                        placeholder="Latitude"
                        required={field.required}
                        min={-90}
                        max={90}
                        value={formData[`${field.name}_lat`] || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          [`${field.name}_lat`]: e.target.value,
                          [field.name]: `${e.target.value},${prev[`${field.name}_lon`] || ''}`,
                        }))}
                        className="flex-1 px-3 py-1.5 text-base rounded border border-slate-300 dark:border-slate-700 bg-background font-mono min-h-[44px]"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Longitude"
                        required={field.required}
                        min={-180}
                        max={180}
                        value={formData[`${field.name}_lon`] || ''}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          [`${field.name}_lon`]: e.target.value,
                          [field.name]: `${prev[`${field.name}_lat`] || ''},${e.target.value}`,
                        }))}
                        className="flex-1 px-3 py-1.5 text-base rounded border border-slate-300 dark:border-slate-700 bg-background font-mono min-h-[44px]"
                      />
                    </div>
                  </details>
                </div>
              )}

              {field.type === 'country' && (
                <select
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                >
                  <option value="">Select country...</option>
                  {([
                    ['US','United States'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],
                    ['DE','Germany'],['FR','France'],['UA','Ukraine'],['RU','Russia'],
                    ['CN','China'],['IR','Iran'],['IQ','Iraq'],['SY','Syria'],
                    ['IL','Israel'],['PS','Palestine'],['SA','Saudi Arabia'],['AE','UAE'],
                    ['TR','Turkey'],['IN','India'],['PK','Pakistan'],['AF','Afghanistan'],
                    ['KP','North Korea'],['KR','South Korea'],['JP','Japan'],['TW','Taiwan'],
                    ['BR','Brazil'],['MX','Mexico'],['NG','Nigeria'],['ZA','South Africa'],
                    ['EG','Egypt'],['KE','Kenya'],['PL','Poland'],['RO','Romania'],
                    ['NL','Netherlands'],['SE','Sweden'],['NO','Norway'],['FI','Finland'],
                  ] as [string,string][]).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              )}

              {field.type === 'rating' && (
                <div className="flex items-center gap-2 sm:gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, [field.name]: String(n) }))}
                      className={`w-11 h-11 sm:w-9 sm:h-9 rounded-full text-sm font-bold transition-colors ${
                        Number(formData[field.name]) >= n
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {field.type === 'likert' && (
                <div className="flex flex-col gap-1">
                  {(field.options || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={field.name}
                        value={opt}
                        checked={formData[field.name] === opt}
                        onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                        className="accent-blue-600"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'file' && (
                <FileDropZone
                  fieldName={field.name}
                  accept={field.accept}
                  currentName={formData[`${field.name}_name`] as string | undefined}
                  hasFile={!!formData[field.name]}
                  previewUrl={formData[field.name] as string | undefined}
                  onFile={(dataUrl, name, type) => {
                    setFormData(prev => ({
                      ...prev,
                      [field.name]: dataUrl,
                      [`${field.name}_name`]: name,
                      [`${field.name}_type`]: type,
                    }))
                  }}
                  onError={setError}
                  onClear={() => {
                    setFormData(prev => {
                      const next = { ...prev }
                      delete next[field.name]
                      delete next[`${field.name}_name`]
                      delete next[`${field.name}_type`]
                      return next
                    })
                  }}
                />
              )}

              {field.help_text && (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{field.help_text}</p>
              )}
            </div>
          ))}

          {/* About you section */}
          <div className="space-y-3 pt-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">About you</p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-3">
              {/* Name (always optional) */}
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Your name (optional)</label>
                <input
                  type="text"
                  value={submitterName}
                  onChange={e => setSubmitterName(e.target.value)}
                  className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                />
              </div>

              {/* Contact */}
              {formMeta.require_contact && (
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Contact (email or phone) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={submitterContact}
                    onChange={e => setSubmitterContact(e.target.value)}
                    className="w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-background min-h-[44px]"
                  />
                </div>
              )}

              {/* Location */}
              {formMeta.require_location && (
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Location <span className="text-red-400">*</span>
                  </label>
                  {lat != null ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {lat.toFixed(4)}, {lon?.toFixed(4)}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-muted transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" /> Share my location
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sticky submit footer */}
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 mt-6">
            {error && (
              <p className="text-sm text-red-500 text-center mb-2" role="alert">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-base font-semibold transition-colors"
              style={themeColor ? { backgroundColor: themeColor } : undefined}
            >
              {submitting ? (
                <>Submitting...</>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Submit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Submitted Screen with Results ───────────────────────────────

function SubmittedScreen({ token, successMessage, onSubmitAnother }: {
  token: string
  successMessage: string | null
  onSubmitAnother: () => void
}) {
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [loadingResults, setLoadingResults] = useState(false)
  const [resultsError, setResultsError] = useState<string | null>(null)

  const fetchResults = useCallback(async () => {
    setLoadingResults(true)
    setResultsError(null)
    try {
      const res = await fetch(`/api/surveys/public/${token}/results`)
      if (!res.ok) throw new Error('Could not load results')
      const data = await res.json()
      setResults(data)
      setShowResults(true)
    } catch (err) {
      setResultsError(err instanceof Error ? err.message : 'Failed to load results')
    } finally {
      setLoadingResults(false)
    }
  }, [token])

  if (!showResults) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold">Thank you</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {successMessage || 'Your submission has been received and will be reviewed by the research team.'}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={fetchResults}
              disabled={loadingResults}
              className="w-full min-h-[44px] rounded-xl border border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              {loadingResults ? 'Loading...' : 'View all responses'}
            </button>
            <button
              type="button"
              onClick={onSubmitAnother}
              className="min-h-[44px] flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 hover:underline"
            >
              Submit another response
            </button>
          </div>
          {resultsError && <p className="text-xs text-red-500" role="alert">{resultsError}</p>}
        </div>
      </div>
    )
  }

  // Results view
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-4 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{results.title}</h1>
            <p className="text-xs text-slate-500">{results.total} response{results.total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSubmitAnother}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Submit another
            </button>
          </div>
        </div>

        {/* Stats: distributions */}
        {results.stats?.distributions && Object.keys(results.stats.distributions).length > 0 && (
          <div className="space-y-3">
            {Object.entries(results.stats.distributions).map(([fieldName, dist]) => {
              const field = results.fields?.find((f: any) => f.name === fieldName)
              const entries = Object.entries(dist as Record<string, number>).sort((a, b) => b[1] - a[1])
              const maxCount = entries[0]?.[1] || 1
              return (
                <div key={fieldName} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {field?.label || fieldName}
                  </h3>
                  <div className="space-y-1.5">
                    {entries.map(([value, count]) => (
                      <div key={value} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-slate-700 dark:text-slate-300">{value}</span>
                            <span className="text-slate-400">{count as number}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${((count as number) / maxCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Country breakdown */}
        {results.stats?.by_country && Object.keys(results.stats.by_country).length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              By country
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(results.stats.by_country)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([code, count]) => (
                  <span key={code} className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {code} <span className="font-semibold">{count as number}</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Individual responses */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Responses ({results.showing})
          </h3>
          {results.results?.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-2">
              {results.fields?.map((field: any) => {
                const val = r.data[field.name]
                if (val == null || val === '') return null
                const display = Array.isArray(val) ? val.join(', ') : String(val)
                return (
                  <div key={field.name}>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{field.label}</span>
                    <p className="text-sm text-slate-800 dark:text-slate-200 break-words whitespace-pre-line">{display}</p>
                  </div>
                )
              })}
              <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                {r.country && <span>{r.country}</span>}
                <span>{new Date(r.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── File Drop Zone — file picker, camera, clipboard paste ───────

const MAX_FILE_SIZE = 5 * 1024 * 1024

function FileDropZone({ fieldName, accept, currentName, hasFile, previewUrl, onFile, onError, onClear }: {
  fieldName: string
  accept?: string
  currentName?: string
  hasFile: boolean
  previewUrl?: string
  onFile: (dataUrl: string, name: string, type: string) => void
  onError: (msg: string) => void
  onClear: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const processFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      onError('File must be under 5 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      onFile(reader.result as string, file.name, file.type)
    }
    reader.readAsDataURL(file)
  }, [onFile, onError])

  // Clipboard paste handler
  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) processFile(file)
          return
        }
      }
    }
    el.addEventListener('paste', handler)
    return () => el.removeEventListener('paste', handler)
  }, [processFile])

  // If already has a file, show preview
  if (hasFile) {
    const isImage = previewUrl?.startsWith('data:image/')
    return (
      <div className="space-y-2">
        <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900">
          {isImage && previewUrl && (
            <img src={previewUrl} alt="Upload preview" className="w-full max-h-48 object-contain" />
          )}
          <div className="flex items-center justify-between px-3 py-2 bg-white/80 dark:bg-slate-900/80">
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate flex-1">{currentName || 'Uploaded file'}</span>
            <button
              type="button"
              onClick={onClear}
              className="ml-2 p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={dropRef}
      tabIndex={0}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
      }}
      className={`rounded-xl border-2 border-dashed transition-colors ${
        dragOver
          ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
          : 'border-slate-300 dark:border-slate-700'
      }`}
    >
      {/* Main tap area */}
      <div className="p-4 text-center space-y-3">
        <Upload className="h-6 w-6 mx-auto text-slate-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Drop image here, or tap below
        </p>

        {/* Action buttons */}
        <div className="flex gap-2 justify-center">
          {/* File picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            File
          </button>

          {/* Camera capture */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Camera className="h-4 w-4" />
            Camera
          </button>

          {/* Paste from clipboard */}
          <button
            type="button"
            onClick={async () => {
              try {
                const items = await navigator.clipboard.read()
                for (const item of items) {
                  const imageType = item.types.find(t => t.startsWith('image/'))
                  if (imageType) {
                    const blob = await item.getType(imageType)
                    const file = new File([blob], `paste-${Date.now()}.${imageType.split('/')[1]}`, { type: imageType })
                    processFile(file)
                    return
                  }
                }
                onError('No image found in clipboard')
              } catch {
                onError('Clipboard access denied — try Ctrl+V / Cmd+V instead')
              }
            }}
            className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ClipboardPaste className="h-4 w-4" />
            Paste
          </button>
        </div>

        <p className="text-[10px] text-slate-400">Max 5 MB · You can also paste with Ctrl+V</p>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept || 'image/*,video/*'}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) processFile(file)
          e.target.value = '' // allow re-selecting same file
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) processFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
