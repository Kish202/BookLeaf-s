import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Pagination({ page, pageSize, total, onPageChange, noun = 'ticket', className }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className={cn('flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground', className)}>
      <span>
        {first}–{last} of {total} {noun}
        {total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <span>
          Page {page} of {totalPages}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
