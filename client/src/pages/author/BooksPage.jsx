import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { MessageCircleQuestion, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Pagination } from '@/components/Pagination'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api } from '@/lib/api'
import { firstName, formatDate, inr } from '@/lib/format'
import { cn } from '@/lib/utils'

const PRODUCTION_STAGES = [
  'Manuscript Received',
  'Editing',
  'Cover Design',
  'Typesetting',
  'Proofreading',
  'ISBN Assignment',
  'Printing',
  'Distribution Setup',
  'Published & Live',
]
const MIN_PAYOUT = 1000

function StatCard({ emoji, label, value, tone }) {
  return (
    <div className={cn('flex items-center gap-4 rounded-lg p-5', tone)}>
      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-white/60 text-2xl">{emoji}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold opacity-80">{label}</p>
        <p className="truncate text-2xl font-extrabold tracking-tight">{value}</p>
      </div>
    </div>
  )
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold">{children}</dd>
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{children}</p>
}

function ProductionTracker({ status }) {
  const stage = status.replace(/^In Production - /, '')
  const index = Math.max(PRODUCTION_STAGES.indexOf(stage), 0)
  const percent = Math.round((index / (PRODUCTION_STAGES.length - 1)) * 100)
  return (
    <div>
      <SectionLabel>Production</SectionLabel>
      <div className="space-y-3 rounded-md bg-butter/60 p-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-bold text-butter-foreground">🛠️ {stage}</span>
          <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
            Step {index + 1} of {PRODUCTION_STAGES.length}
          </span>
        </div>
        <Progress value={percent} className="h-2" />
        <p className="text-xs text-muted-foreground">
          Next up: {PRODUCTION_STAGES.slice(index + 1, index + 3).join(' → ')}. Sales and royalties appear once your book
          is live.
        </p>
      </div>
    </div>
  )
}

function royaltyNote(book) {
  if (book.royaltyPending > 0 && book.royaltyPending < MIN_PAYOUT) {
    return `Under the ${inr(MIN_PAYOUT)} payout minimum, so it rolls over to next quarter.`
  }
  if (!book.lastRoyaltyPayoutDate && book.totalRoyaltyEarned > 0) return 'No payout made yet.'
  if (book.royaltyPending === 0 && book.royaltyPaid > 0) return 'All caught up! 🎉'
  return null
}

function RoyaltyPanel({ book }) {
  const note = royaltyNote(book)
  const tiles = [
    { label: 'Earned', value: book.totalRoyaltyEarned, tone: 'bg-lavender text-lavender-foreground' },
    { label: 'Paid', value: book.royaltyPaid, tone: 'bg-mint text-mint-foreground' },
    { label: 'Pending', value: book.royaltyPending, tone: 'bg-peach text-peach-foreground' },
  ]
  return (
    <div>
      <SectionLabel>Royalties</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className={cn('min-w-0 rounded-md px-3 py-2.5', tile.tone)}>
            <p className="text-[11px] font-semibold opacity-80">{tile.label}</p>
            <p className="truncate font-extrabold">{inr(tile.value)}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Last payout: <span className="font-semibold">{formatDate(book.lastRoyaltyPayoutDate)}</span>
        {note && <> · {note}</>}
      </p>
    </div>
  )
}

function Platforms({ book }) {
  return (
    <div>
      <SectionLabel>Available on</SectionLabel>
      {book.availableOn.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {book.availableOn.map((platform) => (
            <span key={platform} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {platform}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Listings go live 7–10 business days after publication.</p>
      )}
    </div>
  )
}

// Every card renders the same sections in the same order, and the footer is
// pushed to the bottom, so cards in a row line up regardless of content.
function BookCard({ book }) {
  return (
    <Card className="h-full gap-0 rounded-lg border-0 py-0 shadow-lg shadow-primary/5 transition-shadow hover:shadow-primary/15">
      <CardHeader className="gap-1 px-5 pt-5 pb-4">
        <span
          className={cn(
            'w-fit rounded-full px-2.5 py-0.5 text-xs font-bold',
            book.isPublished ? 'bg-mint text-mint-foreground' : 'bg-butter text-butter-foreground',
          )}
        >
          {book.isPublished ? '🌱 Live' : '🛠️ In production'}
        </span>
        <CardTitle className="mt-1 line-clamp-1 text-lg font-extrabold" title={book.title}>
          {book.title}
        </CardTitle>
        <p className="truncate text-sm text-muted-foreground">{book.genre}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5 px-5 pb-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md bg-muted/50 p-3 text-sm">
          <Detail label="ISBN">{book.isbn ?? '—'}</Detail>
          <Detail label="Published">{formatDate(book.publicationDate)}</Detail>
          <Detail label="MRP">{inr(book.mrp)}</Detail>
          <Detail label="Copies sold">{book.totalCopiesSold.toLocaleString('en-IN')}</Detail>
        </dl>
        {book.isPublished ? <RoyaltyPanel book={book} /> : <ProductionTracker status={book.status} />}
        <Platforms book={book} />
      </CardContent>
      <CardFooter className="mt-auto border-t px-5 py-4">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={`/tickets/new?bookId=${book.id}`}>
            <MessageCircleQuestion /> Ask about this book
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

const STATUS_TABS = [
  ['all', 'All'],
  ['live', '🌱 Live'],
  ['production', '🛠️ In production'],
]

const SORTS = [
  ['newest', '🆕 Newest first'],
  ['oldest', '🐢 Oldest first'],
  ['title', '🔤 Title A–Z'],
  ['sales', '🛒 Most copies sold'],
  ['pending', '⏳ Highest pending royalty'],
]

const PAGE_SIZE = 6

export function BooksPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const search = useDebouncedValue(searchInput).trim()

  const resetPage = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const params = {
    status: status === 'all' ? undefined : status,
    search: search || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  }
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['books', params],
    queryFn: () => api('/books', { query: params }),
    placeholderData: keepPreviousData,
  })
  const isFiltered = Boolean(search) || status !== 'all'

  return (
    <>
      <PageHeader
        title={`Hi ${firstName(user.name)} 👋`}
        description="Here's how your books are doing."
        action={
          <Button asChild>
            <Link to="/tickets/new">Need help? Raise a ticket</Link>
          </Button>
        }
      />
      {isPending && <LoadingState label="Fetching your books…" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard emoji="📚" label="Books" value={`${data.summary.publishedBooks} live / ${data.summary.totalBooks}`} tone="bg-blush text-blush-foreground" />
            <StatCard emoji="🛒" label="Copies sold" value={data.summary.totalCopiesSold.toLocaleString('en-IN')} tone="bg-sky text-sky-foreground" />
            <StatCard emoji="💖" label="Royalty earned" value={inr(data.summary.totalRoyaltyEarned)} tone="bg-lavender text-lavender-foreground" />
            <StatCard emoji="⏳" label="Royalty pending" value={inr(data.summary.royaltyPending)} tone="bg-peach text-peach-foreground" />
          </div>
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Tabs value={status} onValueChange={resetPage(setStatus)}>
                <TabsList>
                  {STATUS_TABS.map(([value, label]) => (
                    <TabsTrigger key={value} value={value}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="relative md:ml-auto md:w-80">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="bg-card pl-9"
                  placeholder="Search title, genre or ISBN…"
                  aria-label="Search books"
                  value={searchInput}
                  onChange={(e) => resetPage(setSearchInput)(e.target.value)}
                />
              </div>
              <Select value={sort} onValueChange={resetPage(setSort)}>
                <SelectTrigger className="w-full bg-card md:w-60" aria-label="Sort books">
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

            {data.data.length === 0 ? (
              isFiltered ? (
                <EmptyState emoji="🔍" title="No books match" description="Try a different search or filter.">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchInput('')
                      setStatus('all')
                      setPage(1)
                    }}
                  >
                    Clear filters
                  </Button>
                </EmptyState>
              ) : (
                <EmptyState emoji="📖" title="No books yet" description="Once your first book is in production it will show up here." />
              )
            ) : (
              <>
                <div className={cn('grid gap-5 transition-opacity sm:grid-cols-2 xl:grid-cols-3', isFetching && 'opacity-70')}>
                  {data.data.map((book) => (
                    <BookCard key={book.id} book={book} />
                  ))}
                </div>
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={data.pagination.total}
                  onPageChange={setPage}
                  noun="book"
                  className="rounded-lg border-0 bg-card shadow-sm ring-1 ring-border/60"
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
