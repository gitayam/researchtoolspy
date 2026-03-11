interface CopResourceGaugeProps {
  used: number
  total: number
  label: string
  unit?: string
}

export default function CopResourceGauge({ used, total, label, unit = '' }: CopResourceGaugeProps) {
  const pct = total > 0 ? (used / total) * 100 : 0
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{used}{unit} / {total}{unit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}
