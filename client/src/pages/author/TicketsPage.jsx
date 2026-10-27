import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronRight, MessageCircle, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/Badges'
import { Pagination } from '@/components/Pagination'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

// Header and rows share one column template so every column lines up.
const ROW_GRID =
  'grid md:grid-cols-[4.5rem_minmax(0,2fr)_minmax(0,1.2fr)_8.5rem_5rem_7.5rem_1.25rem] md:gap-x-4'

const FILTERS = {
  active: { label: 'Active', status: 'open,in_progress' },
  resolved: { label: 'Resolved', status: 'resolved,closed' },
  all: { label: 'All', status: undefined },
}

const SORTS = [
  ['updated', '🔄 Recently updated'],
  ['newest', '🆕 Newest first'],
  ['oldest', '🐢 Oldest first'],
]

const PAGE_SIZE = 10

export function TicketsPage() {
  const [filter, setFilter] = useState('active')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState('updated')
  const [page, setPage] = useState(1)
  const search = useDebouncedValue(searchInput).trim()

  // Any change to what is being listed starts again from the first page.
  const resetPage = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const params = { status: FILTERS[filter].status, search: search || undefined, sort, page, pageSize: PAGE_SIZE }
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['tickets', 'mine', params],
    queryFn: () => api('/tickets', { query: params }),
    placeholderData: keepPreviousData,
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
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs value={filter} onValueChange={resetPage(setFilter)}>
          <TabsList>
            {Object.entries(FILTERS).map(([key, { label }]) => (
              <TabsTrigger key={key} value={key}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative md:ml-auto md:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-card pl-9"
            placeholder="Search subject, description or book…"
            aria-label="Search tickets"
            value={searchInput}
            onChange={(e) => resetPage(setSearchInput)(e.target.value)}
          />
        </div>
        <Select value={sort} onValueChange={resetPage(setSort)}>
          <SelectTrigger className="w-full bg-card md:w-52" aria-label="Sort tickets">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending && <LoadingState label="Fetching your tickets…" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data?.data.length === 0 &&
        (search ? (
          <EmptyState emoji="🔍" title="No tickets match your search" description={`Nothing found for “${search}”.`}>
            <Button variant="outline" onClick={() => resetPage(setSearchInput)('')}>
              Clear search
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            emoji={filter === 'active' ? '🌈' : '🗂️'}
            title={filter === 'active' ? 'Nothing open right now' : 'No tickets here yet'}
            description={filter === 'active' ? "You're all caught up. If something comes up, we're one message away." : undefined}
          >
            <Button asChild variant="outline">
              <Link to="/tickets/new">Raise a ticket</Link>
            </Button>
          </EmptyState>
        ))}
      {data?.data.length > 0 && (
        <div className={cn('overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-border/60 transition-opacity', isFetching && 'opacity-70')}>
          <div className={cn(ROW_GRID, 'hidden border-b bg-muted/40 px-5 py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase md:grid')}>
            <span>Ticket</span>
            <span>Subject</span>
            <span>Book</span>
            <span>Status</span>
            <span className="text-right">Replies</span>
            <span className="text-right">Updated</span>
            <span />
          </div>
          <ul className="divide-y">
            {data.data.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  to={`/tickets/${ticket.id}`}
                  className={cn(
                    ROW_GRID,
                    'group grid-cols-[minmax(0,1fr)_auto] gap-y-1.5 px-5 py-4 transition-colors hover:bg-muted/40 md:items-center',
                  )}
                >
                  <span className="text-xs font-semibold text-muted-foreground max-md:col-span-2 max-md:flex max-md:items-center max-md:gap-2">
                    #{ticket.id}
                    <StatusBadge status={ticket.status} className="md:hidden" />
                  </span>
                  <span className="truncate font-bold max-md:col-span-2">{ticket.subject}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {ticket.book ? `📖 ${ticket.book.title}` : '💬 General / Account'}
                  </span>
                  <span className="hidden md:block">
                    <StatusBadge status={ticket.status} />
                  </span>
                  <span className="hidden items-center justify-end gap-1 text-sm text-muted-foreground md:flex">
                    <MessageCircle className="size-3.5" /> {ticket.messageCount}
                  </span>
                  <span className="text-right text-xs whitespace-nowrap text-muted-foreground md:text-sm">
                    {timeAgo(ticket.lastMessageAt ?? ticket.updatedAt)}
                  </span>
                  <ChevronRight className="hidden size-5 justify-self-end text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary md:block" />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.pagination.total} onPageChange={setPage} />
        </div>
      )}
    </>
  )
}
