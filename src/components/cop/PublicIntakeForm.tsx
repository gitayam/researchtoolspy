import { useState, useEffect, useCallback } from 'react'
import { Send, CheckCircle2, AlertCircle, MapPin } from 'lucide-react'
import type { IntakeFormField } from '../../types/cop'

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

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/cop/public/intake/${token}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Form closed' : 'Form not found')
        return res.json()
      })
      .then(data => { setFormMeta(data); setLoading(false) })
      .catch(err => { if (err?.name !== 'AbortError') { setError(err.message); setLoading(false) } })
    return () => controller.abort()
  }, [token])

  const requestLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLon(pos.coords.longitude) },
      () => { /* User denied or unavailable */ }
    )
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formMeta) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/public/intake/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_data: formData,
          submitter_name: submitterName || null,
          submitter_contact: submitterContact || null,
          lat, lon,
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
  }, [formMeta, formData, submitterName, submitterContact, lat, lon, token])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><span className="text-sm text-muted-foreground">Loading...</span></div>
  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-2">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    </div>
  )
  if (submitted) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-2">
        <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto" />
        <p className="text-sm font-medium">Submission received. Thank you.</p>
      </div>
    </div>
  )
  if (!formMeta) return null

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold">{formMeta.title}</h1>
          {formMeta.description && <p className="text-sm text-muted-foreground mt-1">{formMeta.description}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dynamic form fields */}
          {formMeta.form_schema.map(field => (
            <div key={field.name} className="space-y-1">
              <label className="text-sm font-medium">
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
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  required={field.required}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background resize-none"
                />
              )}

              {field.type === 'number' && (
                <input
                  type="number"
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
              )}

              {field.type === 'datetime' && (
                <input
                  type="datetime-local"
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
              )}

              {field.type === 'select' && (
                <select
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
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
            </div>
          ))}

          {/* Name (always optional) */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Your name (optional)</label>
            <input
              type="text"
              value={submitterName}
              onChange={e => setSubmitterName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
            />
          </div>

          {/* Contact */}
          {formMeta.require_contact && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Contact (email or phone) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={submitterContact}
                onChange={e => setSubmitterContact(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
              />
            </div>
          )}

          {/* Location */}
          {formMeta.require_location && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  )
}
