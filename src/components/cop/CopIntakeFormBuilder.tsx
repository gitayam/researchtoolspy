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

const FIELD_TYPES: { value: IntakeFormFieldType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'datetime', label: 'Date/Time' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'file', label: 'File Upload' },
  { value: 'checkbox', label: 'Checkbox' },
]

export default function CopIntakeFormBuilder({
  sessionId, formId, initialTitle, initialDescription, initialFields, onSaved,
}: CopIntakeFormBuilderProps) {
  const [title, setTitle] = useState(initialTitle || '')
  const [description, setDescription] = useState(initialDescription || '')
  const [fields, setFields] = useState<IntakeFormField[]>(initialFields || [])
  const [requireLocation, setRequireLocation] = useState(false)
  const [requireContact, setRequireContact] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)

  const addField = useCallback(() => {
    setFields(prev => [...prev, {
      name: `field_${prev.length + 1}`,
      type: 'text',
      label: '',
      required: false,
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

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        form_schema: fields,
        require_location: requireLocation,
        require_contact: requireContact,
        status: 'draft',
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
    } catch {
      // Silent fail
    } finally {
      setSaving(false)
    }
  }, [title, description, fields, requireLocation, requireContact, sessionId, formId, onSaved])

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
          <div key={index} className="flex items-start gap-2 p-2 rounded border border-slate-200 dark:border-slate-700 bg-muted/20">
            <GripVertical className="h-4 w-4 text-muted-foreground mt-2 cursor-grab shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={e => updateField(index, { label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="Field label"
                  className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
                <select
                  value={field.type}
                  onChange={e => updateField(index, { type: e.target.value as IntakeFormFieldType })}
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-background"
                >
                  {FIELD_TYPES.map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
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
