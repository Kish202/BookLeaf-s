import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { differenceInHours, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CategoryBadge, PriorityBadge, SourceTag, StatusBadge } from '@/components/Badges'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api } from '@/lib/api'
import { CATEGORIES, PRIORITIES, UNRESOLVED } from '@/lib/constants'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

const ANY = 'any'
const PAGE_SIZE = 20
const DEFAULT_FILTERS = {
  status: 'open,in_progress',
  category: ANY,
  priority: ANY,
  assignedTo: ANY,
  from: '',
  to: '',
  search: '',
  sort: 'urgency',
}

const STATUS_OPTIONS = [
  ['open,in_progress', 'Unresolved'],
  ['open', 'Open'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
  ['closed', 'Closed'],
  [ANY, 'All statuses'],
]

function FilterSelect({ value, onChange, options, className }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('w-full bg-card', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Counter({ emoji, label, value, tone, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-3xl p-4 text-left transition hover:-translate-y-0.5',
        tone,
        active && 'ring-2 ring-current ring-offset-2 ring-offset-background',
      )}
    >
      <p className="text-sm font-semibold opacity-80">
        {emoji} {label}
      </p>
      <p className="text-3xl font-extrabold">{value ?? '–'}</p>
    </button>
  )
}

/** Unresolved tickets older than a day are highlighted; older than three days, more strongly. */
function WaitingTime({ ticket, now }) {
  const hours = differenceInHours(now, parseISO(ticket.createdAt))
  const unresolved = UNRESOLVED.includes(ticket.status)
  return (
    <span
      className={cn(
        'text-xs font-semibold whitespace-nowrap',
        unresolved && hours >= 72 ? 'text-destructive' : unresolved && hours >= 24 ? 'text-peach-foreground' : 'text-muted-foreground',
      )}
    >
      {timeAgo(ticket.createdAt)}
    </span>
  )
}

export function QueuePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [now] = useState(() => new Date())
  const search = useDebouncedValue(filters.search)

  const setFilter = (key) => (value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const params = {
    status: filters.status === ANY ? undefined : filters.status,
    category: filters.category === ANY ? undefined : filters.category,
    priority: filters.priority === ANY ? undefined : filters.priority,
    assignedTo: filters.assignedTo === ANY ? undefined : filters.assignedTo,
    from: filters.from,
    to: filters.to,
    search: search.trim(),
    sort: filters.sort,
    page,
    pageSize: PAGE_SIZE,
  }

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['tickets', 'queue', params],
    queryFn: () => api('/tickets', { query: params }),
    placeholderData: keepPreviousData,
  })

  // Headline counts are always across all unresolved tickets, independent of filters.
  const counts = useQuery({
    queryKey: ['tickets', 'counts'],
    queryFn: async () => {
      const count = (query) =>
        api('/tickets', { query: { status: 'open,in_progress', pageSize: 1, ...query } }).then((r) => r.pagination.total)
      const [unresolved, critical, unassigned, mine] = await Promise.all([
        count({}),
        count({ priority: 'critical,high' }),
        count({ assignedTo: 'unassigned' }),
        count({ assignedTo: 'me' }),
      ])
      return { unresolved, critical, unassigned, mine }
    },
  })

  const quickFilter = (patch) => {
    setFilters({ ...DEFAULT_FILTERS, ...patch })
    setPage(1)
  }

  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS)
  const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / PAGE_SIZE)) : 1

  return (
    <>
      <PageHeader title="Ticket Queue 📬" description={`Good to see you, ${user.name}. Most urgent and longest-waiting first.`} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Counter emoji="📥" label="Unresolved" value={counts.data?.unresolved} tone="bg-sky text-sky-foreground" onClick={() => quickFilter({})} active={isDefault} />
        <Counter emoji="🔥" label="Critical & high" value={counts.data?.critical} tone="bg-peach text-peach-foreground" onClick={() => quickFilter({ priority: 'critical,high' })} active={filters.priority === 'critical,high'} />
        <Counter emoji="🙋" label="Unassigned" value={counts.data?.unassigned} tone="bg-lavender text-lavender-foreground" onClick={() => quickFilter({ assignedTo: 'unassigned' })} active={filters.assignedTo === 'unassigned'} />
        <Counter emoji="⭐" label="Assigned to me" value={counts.data?.mine} tone="bg-mint text-mint-foreground" onClick={() => quickFilter({ assignedTo: 'me' })} active={filters.assignedTo === 'me'} />
      </div>

      <Card className="mb-4 gap-3 rounded-3xl border-0 p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="bg-card pl-9"
              placeholder="Search subject, description or author…"
              value={filters.search}
              onChange={(e) => setFilter('search')(e.target.value)}
            />
          </div>
          <FilterSelect value={filters.status} onChange={setFilter('status')} options={STATUS_OPTIONS} />
          <FilterSelect
            value={filters.sort}
            onChange={setFilter('sort')}
            options={[
              ['urgency', '⚡ Most urgent first'],
              ['oldest', '🐢 Oldest first'],
              ['newest', '🆕 Newest first'],
              ['updated', '🔄 Recently updated'],
            ]}
          />
          <FilterSelect
            value={filters.category}
            onChange={setFilter('category')}
            options={[[ANY, 'All categories'], ...Object.entries(CATEGORIES).map(([k, v]) => [k, `${v.emoji} ${v.label}`])]}
          />
          <FilterSelect
            value={filters.priority}
            onChange={setFilter('priority')}
            options={[[ANY, 'All priorities'], ['critical,high', 'Critical & high'], ...Object.entries(PRIORITIES).map(([k, v]) => [k, v.label])]}
          />
          <FilterSelect
            value={filters.assignedTo}
            onChange={setFilter('assignedTo')}
            options={[[ANY, 'Anyone'], ['me', 'Assigned to me'], ['unassigned', 'Unassigned']]}
          />
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="From date" className="bg-card" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from')(e.target.value)} />
            <span className="text-muted-foreground">–</span>
            <Input type="date" aria-label="To date" className="bg-card" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to')(e.target.value)} />
          </div>
        </div>
        {!isDefault && (
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => quickFilter({})}>
            <RotateCcw /> Reset filters
          </Button>
        )}
      </Card>

      {isPending && <LoadingState label="Loading the queue…" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data?.data.length === 0 && (
        <EmptyState emoji="🌷" title="No tickets match" description={isDefault ? 'Inbox zero! Every ticket has been handled.' : 'Try loosening the filters.'} />
      )}
      {data?.data.length > 0 && (
        <Card className={cn('overflow-hidden rounded-3xl border-0 p-0 shadow-sm transition-opacity', isFetching && 'opacity-70')}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Priority</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="pr-5">Waiting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  tabIndex={0}
                  onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/tickets/${ticket.id}`)}
                  className={cn('cursor-pointer', ticket.priority === 'critical' && UNRESOLVED.includes(ticket.status) && 'bg-destructive/5')}
                >
                  <TableCell className="pl-5 align-top">
                    <div className="space-y-1">
                      <PriorityBadge priority={ticket.priority} />
                      <SourceTag source={ticket.prioritySource} />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-sm align-top whitespace-normal">
                    <p className="font-bold">
                      <span className="mr-1.5 text-xs font-semibold text-muted-foreground">#{ticket.id}</span>
                      {ticket.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.author.name} · {ticket.book ? ticket.book.title : 'General / Account'}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <CategoryBadge category={ticket.category} />
                      <SourceTag source={ticket.categorySource} />
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {ticket.assignedTo ? ticket.assignedTo.name : <span className="text-muted-foreground">Unassigned</span>}
                  </TableCell>
                  <TableCell className="pr-5 align-top">
                    <WaitingTime ticket={ticket} now={now} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground">
            <span>
              {data.pagination.total} ticket{data.pagination.total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button size="icon-sm" variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft />
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button size="icon-sm" variant="ghost" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
