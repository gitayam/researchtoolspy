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

export function TimelineRecordedDate({ value, time, onChange, optional }: TimelineRecordedDateProps) {
  const id = useId()
  const recordedPrecision = inferTimelineDatePrecision(value)
  const [precision, setPrecision] = useState<Precision>(() => recordedPrecision || 'day')
  const [candidate, setCandidate] = useState(() => matchingValue(value, recordedPrecision || 'day'))
  useEffect(() => { setCandidate(matchingValue(value, precision)) }, [value, precision])

  const guidance = !value.trim() ? 'No recorded date' : recordedPrecision === 'year' ? 'Year only'
    : recordedPrecision === 'month' ? 'Month only' : recordedPrecision === 'day' ? 'Day recorded' : 'Invalid recorded date'
  const pickerLabel = precision === 'day' ? 'Pick a recorded day' : precision === 'month' ? 'Pick a recorded month' : 'Enter a recorded year'
  const candidateValid = matchingValue(candidate, precision) !== ''
  const retained = value !== '' && (recordedPrecision !== precision || !candidateValid || candidate !== value)

  function choose(next: string) {
    setCandidate(next)
    if (matchingValue(next, precision)) onChange(next)
  }

  return <div className="min-w-0 space-y-2">
    <Label htmlFor="timeline-event-date">Date{optional ? ' (optional)' : ''}</Label>
    <Input id="timeline-event-date" value={value} onChange={event => onChange(event.target.value)} placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" aria-describedby={`${id}-guidance`} />
    <p id={`${id}-guidance`} className="text-xs leading-relaxed text-muted-foreground">
      {guidance}.{time && recordedPrecision !== 'day' ? ' Clock retained; day unknown. Choose a complete recorded day only if known.' : ''}
    </p>
    <details className="rounded-md border p-2 text-sm">
      <summary className="cursor-pointer font-medium">Date picker</summary>
      <div className="mt-3 min-w-0 space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-precision`}>Select date precision</Label>
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
        <Button type="button" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal" onClick={() => { setCandidate(''); onChange('') }}>Clear recorded date</Button>
      </div>
    </details>
  </div>
}
