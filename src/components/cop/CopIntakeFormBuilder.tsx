import { useState, useCallback } from 'react'
import { getCopHeaders } from '../../lib/cop-auth'
import { Plus, Trash2, GripVertical, Eye, Save } from 'lucide-react'
import type { IntakeFormField, IntakeFormFieldType } from '../../types/cop'

interface CopIntakeFormBuilderProps {
  sessionId: string
  formId?: string  // If editing existing
  initialTitle?: string
  initialDescription?: string
  initialFields?: IntakeFormField[]
  onSaved?: (formId: string, shareToken: string) => void
}

const COMMON_COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' }, { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'UA', name: 'Ukraine' }, { code: 'RU', name: 'Russia' },
  { code: 'CN', name: 'China' }, { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' }, { code: 'SY', name: 'Syria' },
  { code: 'IL', name: 'Israel' }, { code: 'PS', name: 'Palestine' },
  { code: 'SA', name: 'Saudi Arabia' }, { code: 'AE', name: 'UAE' },
  { code: 'TR', name: 'Turkey' }, { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' }, { code: 'AF', name: 'Afghanistan' },
  { code: 'KP', name: 'North Korea' }, { code: 'KR', name: 'South Korea' },
  { code: 'JP', name: 'Japan' }, { code: 'TW', name: 'Taiwan' },
  { code: 'BR', name: 'Brazil' }, { code: 'MX', name: 'Mexico' },
  { code: 'NG', name: 'Nigeria' }, { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' }, { code: 'KE', name: 'Kenya' },
  { code: 'PL', name: 'Poland' }, { code: 'RO', name: 'Romania' },
  { code: 'NL', name: 'Netherlands' }, { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' }, { code: 'FI', name: 'Finland' },
]

const FIELD_TYPE_GROUPS: { label: string; types: { value: IntakeFormFieldType; label: string }[] }[] = [
  {
    label: 'Text',
    types: [
      { value: 'text', label: 'Short Text' },
      { value: 'textarea', label: 'Long Text' },
    ],
  },
  {
    label: 'Data',
    types: [
      { value: 'number', label: 'Number' },
      { value: 'datetime', label: 'Date/Time' },
      { value: 'checkbox', label: 'Checkbox' },
    ],
  },
  {
    label: 'Choice',
    types: [
      { value: 'select', label: 'Dropdown' },
      { value: 'multiselect', label: 'Multi-Select' },
      { value: 'rating', label: 'Rating (1-5)' },
      { value: 'likert', label: 'Likert Scale' },
    ],
  },
  {
    label: 'Network / Research',
    types: [
      { value: 'url', label: 'URL' },
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
      { value: 'ip_address', label: 'IP Address' },
      { value: 'onion', label: '.onion Address' },
      { value: 'handle', label: 'Social Handle' },
      { value: 'crypto_address', label: 'Crypto Address' },
    ],
  },
  {
    label: 'Location',
    types: [
      { value: 'geopoint', label: 'Location (lat/lon)' },
      { value: 'country', label: 'Country' },
    ],
  },
  {
    label: 'Media',
    types: [
      { value: 'file', label: 'File Upload' },
    ],
  },
]

const FIELD_PLACEHOLDERS: Partial<Record<IntakeFormFieldType, string>> = {
  url: 'e.g., Source URL',
  email: 'e.g., Contact Email',
  phone: 'e.g., Phone Number',
  ip_address: 'e.g., Server IP',
  onion: 'e.g., Hidden Service',
  handle: 'e.g., Twitter Handle',
  crypto_address: 'e.g., Wallet Address',
  geopoint: 'e.g., Incident Location',
  country: 'e.g., Country of Origin',
  rating: 'e.g., Confidence Level',
  likert: 'e.g., How likely is this?',
  textarea: 'e.g., Description',
  text: 'e.g., Title or Name',
  number: 'e.g., Amount',
  datetime: 'e.g., Date Observed',
  select: 'e.g., Category',
  multiselect: 'e.g., Tags',
  checkbox: 'e.g., Confirmed?',
  file: 'e.g., Screenshot',
}

export default function CopIntakeFormBuilder({
  sessionId, formId, initialTitle, initialDescription, initialFields, onSaved,
}: CopIntakeFormBuilderProps) {
  const [title, setTitle] = useState(initialTitle || '')
  const [description, setDescription] = useState(initialDescription || '')
  const [fields, setFields] = useState<IntakeFormField[]>(
    () => (initialFields || []).map(f => ({ ...f, _id: (f as any)._id || crypto.randomUUID() }))
  )
  const [requireLocation, setRequireLocation] = useState(false)
  const [requireContact, setRequireContact] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [accessLevel, setAccessLevel] = useState<'public' | 'password' | 'internal'>('public')
  const [formPassword, setFormPassword] = useState('')
  const [allowedCountries, setAllowedCountries] = useState<string[]>([])
  const [customSlug, setCustomSlug] = useState('')
  const [rateLimitPerHour, setRateLimitPerHour] = useState(0)
  const [expiresAt, setExpiresAt] = useState('')
  const [themeColor, setThemeColor] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')

  const addField = useCallback(() => {
    setFields(prev => [...prev, {
      name: `field_${prev.length + 1}`,
      type: 'text' as IntakeFormFieldType,
      label: '',
      required: false,
      _id: crypto.randomUUID(),
    }])
  }, [])

  const removeField = useCallback((index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateField = useCallback((index: number, updates: Partial<IntakeFormField>) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f))
  }, [])

  const handleSave = useCallback(async () => {
    if (!title.trim()) return
    setSaving(true)
    setSaveError(null)

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        form_schema: fields,
        require_location: requireLocation,
        require_contact: requireContact,
        status: 'draft',
        access_level: accessLevel,
        password: accessLevel === 'password' ? formPassword : undefined,
        allowed_countries: allowedCountries.length > 0 ? allowedCountries : undefined,
        rate_limit_per_hour: rateLimitPerHour,
        custom_slug: customSlug || undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        theme_color: themeColor || undefined,
        success_message: successMessage || undefined,
      }

      const url = formId
        ? `/api/cop/${sessionId}/intake-forms/${formId}`
        : `/api/cop/${sessionId}/intake-forms`
      const method = formId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: getCopHeaders(),
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      onSaved?.(data.id, data.share_token)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save form')
    } finally {
      setSaving(false)
    }
  }, [title, description, fields, requireLocation, requireContact, accessLevel, formPassword, allowedCountries, customSlug, rateLimitPerHour, expiresAt, themeColor, successMessage, sessionId, formId, onSaved])

  return (
    <div className="space-y-4 p-4">
      {/* Title & Description */}
      <div className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Form title (e.g., 'Submit a Tip')"
          className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Instructions for submitters..."
          rows={2}
          className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background resize-none"
        />
      </div>

      {/* Options */}
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={requireLocation} onChange={e => setRequireLocation(e.target.checked)} />
          Require location
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={requireContact} onChange={e => setRequireContact(e.target.checked)} />
          Require contact info
        </label>
      </div>

      {/* ── Access Control ─────────────────────────── */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-3">
        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Access Control</h3>
        <div className="flex gap-3">
          {(['public', 'password', 'internal'] as const).map(level => (
            <label key={level} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="radio"
                name="access_level"
                value={level}
                checked={accessLevel === level}
                onChange={() => setAccessLevel(level)}
                className="accent-blue-600"
              />
              <span className="capitalize">{level}</span>
            </label>
          ))}
        </div>
        {accessLevel === 'password' && (
          <input
            type="password"
            value={formPassword}
            onChange={e => setFormPassword(e.target.value)}
            placeholder="Set password for this form"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        )}
      </div>

      {/* ── Geographic Restrictions ────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Country Restrictions</h3>
        <p className="text-[10px] text-gray-500">Leave empty to allow all countries. Select countries to restrict access.</p>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
          {COMMON_COUNTRIES.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                setAllowedCountries(prev =>
                  prev.includes(c.code) ? prev.filter(x => x !== c.code) : [...prev, c.code]
                )
              }}
              className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors cursor-pointer ${
                allowedCountries.includes(c.code)
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {c.code} {c.name}
            </button>
          ))}
        </div>
        {allowedCountries.length > 0 && (
          <p className="text-[10px] text-blue-600 dark:text-blue-400">
            Restricted to: {allowedCountries.join(', ')} ({allowedCountries.length} countries)
          </p>
        )}
      </div>

      {/* ── Settings ───────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Settings</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Custom URL slug</label>
            <input
              type="text"
              value={customSlug}
              onChange={e => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g. iran-etf-tips"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            {customSlug && <p className="text-[10px] text-gray-400 mt-0.5">URL: /drop/{customSlug}</p>}
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Rate limit (per hour, 0=unlimited)</label>
            <input
              type="number"
              value={rateLimitPerHour}
              onChange={e => setRateLimitPerHour(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Expiry date</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Theme color</label>
            <input
              type="color"
              value={themeColor || '#3b82f6'}
              onChange={e => setThemeColor(e.target.value)}
              className="w-full h-8 rounded-lg cursor-pointer"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase">Success message (shown after submission)</label>
          <textarea
            value={successMessage}
            onChange={e => setSuccessMessage(e.target.value)}
            placeholder="Thank you for your submission!"
            rows={2}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider">Form Fields</h4>
          <button
            onClick={addField}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3 w-3" /> Add Field
          </button>
        </div>

        {fields.map((field, index) => (
          <div key={(field as any)._id || field.name || index} className="flex items-start gap-2 p-2 rounded border border-slate-200 dark:border-slate-700 bg-muted/20">
            <GripVertical className="h-4 w-4 text-muted-foreground mt-2 cursor-grab shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={e => updateField(index, { label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder={FIELD_PLACEHOLDERS[field.type] || 'Field label'}
                  className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
                <select
                  value={field.type}
                  onChange={e => updateField(index, { type: e.target.value as IntakeFormFieldType })}
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-background"
                >
                  {FIELD_TYPE_GROUPS.map(group => (
                    <optgroup key={group.label} label={group.label}>
                      {group.types.map(ft => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[10px]">
                  <input
                    type="checkbox"
                    checked={field.required || false}
                    onChange={e => updateField(index, { required: e.target.checked })}
                  />
                  Required
                </label>
              </div>

              {/* Options editor for select types */}
              {(field.type === 'select' || field.type === 'multiselect') && (
                <input
                  type="text"
                  value={(field.options || []).join(', ')}
                  onChange={e => updateField(index, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="Options (comma-separated)"
                  className="w-full px-2 py-1 text-[10px] rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
              )}
            </div>
            <button
              onClick={() => removeField(index)}
              className="p-1 text-red-400 hover:text-red-300 transition-colors shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Form'}
        </button>
        {saveError && <p className="text-xs text-red-500" role="alert">{saveError}</p>}
        <button
          onClick={() => setPreview(!preview)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-muted transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          {preview ? 'Hide Preview' : 'Preview'}
        </button>
      </div>
    </div>
  )
}
