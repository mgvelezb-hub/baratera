import { cn } from '@/lib/utils'
import type { StockSemaforo } from '@/lib/types'

const styles: Record<StockSemaforo, string> = {
  verde:    'bg-green-100 text-green-700 border-green-200',
  amarillo: 'bg-amber-100 text-amber-700 border-amber-200',
  rojo:     'bg-red-100 text-red-700 border-red-200',
}

const dotStyles: Record<StockSemaforo, string> = {
  verde:    'bg-green-500',
  amarillo: 'bg-amber-400',
  rojo:     'bg-red-500',
}

const labels: Record<StockSemaforo, string> = {
  verde:    'OK',
  amarillo: 'Bajo',
  rojo:     'Crítico',
}

interface Props {
  semaforo: StockSemaforo
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export default function SemaforoBadge({ semaforo, showLabel = true, size = 'sm' }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
      styles[semaforo]
    )}>
      <span className={cn('rounded-full shrink-0', size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2', dotStyles[semaforo])} />
      {showLabel && labels[semaforo]}
    </span>
  )
}
