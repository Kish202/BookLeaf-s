import { useEffect } from 'react'
import { toast } from 'sonner'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Spinner /> {label}
    </div>
  )
}

/**
 * Reports a failed load as a toast (top-right) instead of a block in the page.
 * `fallback` is a short line for pages that have nothing else to show.
 */
export function ErrorState({ error, onRetry, fallback }) {
  const message = error?.message ?? 'Please try again.'

  useEffect(() => {
    if (!error) return
    // A stable id stops refetches and re-renders from stacking duplicate toasts.
    toast.error('Something went wrong', {
      id: `load-error:${message}`,
      description: message,
      action: onRetry ? { label: 'Try again', onClick: () => onRetry() } : undefined,
    })
  }, [error, message, onRetry])

  if (!fallback) return null
  return <p className="py-16 text-center text-sm text-muted-foreground">{fallback}</p>
}

export function EmptyState({ emoji, title, description, children }) {
  return (
    <Empty className="rounded-lg border border-dashed bg-card/60">
      <EmptyHeader>
        <EmptyMedia className="text-4xl">{emoji}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  )
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
