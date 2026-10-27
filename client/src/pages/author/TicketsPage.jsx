import { useQuery } from '@tanstack/react-query'
import { ChevronRight, MessageCircle, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/Badges'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/format'

const FILTERS = {
  active: { label: 'Active', status: 'open,in_progress' },
  resolved: { label: 'Resolved', status: 'resolved,closed' },
  all: { label: 'All', status: undefined },
}

export function TicketsPage() {
  const [filter, setFilter] = useState('active')
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['tickets', 'mine', filter],
    queryFn: () => api('/tickets', { query: { status: FILTERS[filter].status, pageSize: 100 } }),
  })

  return (
    <>
      <PageHeader
        title="My Tickets 💌"
        description="Replies from our team show up here instantly."
        action={
          <Button asChild>
            <Link to="/tickets/new">
              <Plus /> New ticket
            </Link>
          </Button>
        }
      />
      <Tabs value={filter} onValueChange={setFilter} className="mb-5">
        <TabsList>
          {Object.entries(FILTERS).map(([key, { label }]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isPending && <LoadingState label="Fetching your tickets…" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data?.data.length === 0 && (
        <EmptyState
          emoji={filter === 'active' ? '🌈' : '🗂️'}
          title={filter === 'active' ? 'Nothing open right now' : 'No tickets here yet'}
          description={filter === 'active' ? "You're all caught up. If something comes up, we're one message away." : undefined}
        >
          <Button asChild variant="outline">
            <Link to="/tickets/new">Raise a ticket</Link>
          </Button>
        </EmptyState>
      )}
      <div className="space-y-3">
        {data?.data.map((ticket) => (
          <Link
            key={ticket.id}
            to={`/tickets/${ticket.id}`}
            className="group flex items-center gap-4 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-border/60 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/10 sm:p-5"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">#{ticket.id}</span>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="truncate font-bold">{ticket.subject}</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{ticket.book ? `📖 ${ticket.book.title}` : '💬 General / Account'}</span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="size-3" /> {ticket.messageCount} {ticket.messageCount === 1 ? 'reply' : 'replies'}
                </span>
                <span>Updated {timeAgo(ticket.lastMessageAt ?? ticket.updatedAt)}</span>
              </p>
            </div>
            <ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </>
  )
}
