import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inferTimelineDatePrecision } from '@/lib/timeline-analysis'

interface TimelineRecordedDateProps {
  value: string
  time: string
  onChange: (value: string) => void
  optional: boolean
  endpoint?: 'end'
  approximate?: boolean
  onApproximateChange?: (next: boolean) => void
}

type Precision = 'day' | 'month' | 'year'
const shapes: Record<Precision, RegExp> = {
  day: /^\d{4}-\d{2}-\d{2}$/,
  month: /^\d{4}-\d{2}$/,
  year: /^\d{4}$/,
}

function matchingValue(value: string, precision: Precision): string {
  return shapes[precision].test(value) && inferTimelineDatePrecision(value) === precision ? value : ''
}

export function TimelineRecordedDate({ value, time, onChange, optional, endpoint, approximate, onApproximateChange }: TimelineRecordedDateProps) {
  const id = useId()
  const recordedPrecision = inferTimelineDatePrecision(value)
  const [precision, setPrecision] = useState<Precision>(() => recordedPrecision || 'day')
  const [candidate, setCandidate] = useState(() => matchingValue(value, recordedPrecision || 'day'))
  useEffect(() => { setCandidate(matchingValue(value, precision)) }, [value, precision])

  const guidance = !value.trim() ? 'No recorded date' : recordedPrecision === 'year' ? 'Year only'
    : recordedPrecision === 'month' ? 'Month only' : recordedPrecision === 'day' ? 'Day recorded' : 'Invalid recorded date'
  const end = endpoint === 'end'
  const inputId = end ? 'timeline-event-end-date' : 'timeline-event-date'
  const pickerLabel = precision === 'day' ? (end ? 'Pick a recorded end day' : 'Pick a recorded day') : precision === 'month' ? (end ? 'Pick a recorded end month' : 'Pick a recorded month') : (end ? 'Enter a recorded end year' : 'Enter a recorded year')
  const candidateValid = matchingValue(candidate, precision) !== ''
  const retained = value !== '' && (recordedPrecision !== precision || !candidateValid || candidate !== value)

  function choose(next: string) {
    setCandidate(next)
    if (matchingValue(next, precision)) onChange(next)
  }

  return <div className="min-w-0 space-y-2">
    <Label htmlFor={inputId}>{end ? 'End date' : 'Date'}{optional ? ' (optional)' : ''}</Label>
    <Input id={inputId} value={value} onChange={event => onChange(event.target.value)} placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" aria-describedby={`${id}-guidance`} />
    <p id={`${id}-guidance`} className="text-xs leading-relaxed text-muted-foreground">
      {guidance}.{time && recordedPrecision !== 'day' ? ' Clock retained; day unknown. Choose a complete recorded day only if known.' : ''}
    </p>
    {onApproximateChange && !end && (
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={approximate === true && value.trim() !== ''}
            disabled={value.trim() === ''}
            onChange={changed => onApproximateChange(changed.target.checked)}
            aria-describedby={`${id}-approximate-guidance`}
          />
          <span>Recorded date is approximate (circa)</span>
        </label>
        <p id={`${id}-approximate-guidance`} className="text-xs leading-relaxed text-muted-foreground">
          {value.trim() === ''
            ? 'Record a date before marking it approximate.'
            : 'Marks the recorded value as approximate. It does not change the date, its precision, or how the event is ordered.'}
        </p>
      </div>
    )}
    <details className="rounded-md border p-2 text-sm">
      <summary className="cursor-pointer font-medium">{end ? 'End date picker' : 'Date picker'}</summary>
      <div className="mt-3 min-w-0 space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-precision`}>{end ? 'Select end date precision' : 'Select date precision'}</Label>
          <select id={`${id}-precision`} value={precision} onChange={event => setPrecision(event.target.value as Precision)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
            <option value="day">Day</option><option value="month">Month</option><option value="year">Year</option>
          </select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`${id}-picker`}>{pickerLabel}</Label>
          <Input key={precision} id={`${id}-picker`} type={precision === 'day' ? 'date' : precision === 'month' ? 'month' : 'text'} inputMode={precision === 'year' ? 'numeric' : undefined}
            min={precision === 'day' ? '1000-01-01' : precision === 'month' ? '1000-01' : undefined}
            max={precision === 'day' ? '9999-12-31' : precision === 'month' ? '9999-12' : undefined}
            maxLength={precision === 'year' ? 4 : undefined} value={candidate} onChange={event => choose(event.target.value)} aria-describedby={`${id}-picker-guidance`} className="min-w-0 max-w-full" />
        </div>
        <p id={`${id}-picker-guidance`} className="break-words text-xs leading-relaxed text-muted-foreground">
          {retained ? `Recorded value “${value}” is retained until a complete valid replacement is entered. ` : ''}
          Changing precision does not change the recorded date. Incomplete picker input does not clear it. Supported years: 1000–9999.
        </p>
        <Button type="button" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal" onClick={() => { setCandidate(''); onChange('') }}>{end ? 'Clear recorded end date' : 'Clear recorded date'}</Button>
      </div>
    </details>
  </div>
}
