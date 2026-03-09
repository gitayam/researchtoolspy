import { cn } from '@/lib/utils'

const CONFIDENCE_LEVELS = [
  { value: 'CONFIRMED', dots: 5, color: 'text-green-500', label: 'Confirmed' },
  { value: 'PROBABLE',  dots: 4, color: 'text-blue-500',  label: 'Probable' },
  { value: 'POSSIBLE',  dots: 3, color: 'text-amber-500', label: 'Possible' },
  { value: 'SUSPECTED', dots: 2, color: 'text-orange-500', label: 'Suspected' },
  { value: 'DOUBTFUL',  dots: 1, color: 'text-red-500',   label: 'Doubtful' },
] as const

export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number]['value']

interface ConfidenceDotsProps {
  level: string
  className?: string
  showLabel?: boolean
}

export default function ConfidenceDots({ level, className, showLabel = true }: ConfidenceDotsProps) {
  const config = CONFIDENCE_LEVELS.find(c => c.value === level) ?? CONFIDENCE_LEVELS[2] // default POSSIBLE

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'inline-block w-1.5 h-1.5 rounded-full',
              i < config.dots ? config.color.replace('text-', 'bg-') : 'bg-gray-300 dark:bg-gray-600',
            )}
          />
        ))}
      </div>
      {showLabel && (
        <span className={cn('text-[10px] font-medium uppercase tracking-wider', config.color)}>
          {config.label}
        </span>
      )}
    </div>
  )
}

export { CONFIDENCE_LEVELS }
