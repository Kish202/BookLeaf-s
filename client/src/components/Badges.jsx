import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORIES, PRIORITIES, SOURCE_LABELS, STATUSES } from '@/lib/constants'

const pill = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

export function StatusBadge({ status, className }) {
  const meta = STATUSES[status] ?? STATUSES.open
  return <span className={cn(pill, meta.className, className)}>{meta.label}</span>
}

export function PriorityBadge({ priority, className }) {
  if (!priority) return null
  const meta = PRIORITIES[priority]
  return (
    <span className={cn(pill, meta.className, className)}>
      <span className={cn('size-1.5 rounded-full', meta.dot, priority === 'critical' && 'animate-pulse')} />
      {meta.label}
    </span>
  )
}

export function CategoryBadge({ category, className }) {
  if (!category) return null
  const meta = CATEGORIES[category]
  return (
    <span className={cn(pill, 'bg-secondary text-secondary-foreground', className)}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  )
}

/** Small tag showing whether a value came from the AI, keyword triage or an admin. */
export function SourceTag({ source }) {
  if (!source) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      {source === 'ai' && <Sparkles className="size-3 text-primary" />}
      {SOURCE_LABELS[source]}
    </span>
  )
}
