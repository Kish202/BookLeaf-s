import { cn } from '@/lib/utils'

export function Logo({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-extrabold tracking-tight', className)}>
      <span className="grid size-9 place-items-center rounded-md bg-primary text-lg text-primary-foreground shadow-sm shadow-primary/30">
        🍃
      </span>
      <span>
        Book<span className="text-primary">Leaf</span>
      </span>
    </span>
  )
}
