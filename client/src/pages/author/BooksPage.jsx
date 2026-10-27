import { useQuery } from '@tanstack/react-query'
import { MessageCircleQuestion } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/context/AuthContext'
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
    <div className={cn('rounded-3xl p-5', tone)}>
      <div className="text-2xl">{emoji}</div>
      <p className="mt-2 text-sm font-semibold opacity-80">{label}</p>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  )
}

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  )
}

function ProductionTracker({ status }) {
  const stage = status.replace(/^In Production - /, '')
  const index = Math.max(PRODUCTION_STAGES.indexOf(stage), 0)
  const percent = Math.round((index / (PRODUCTION_STAGES.length - 1)) * 100)
  return (
    <div className="space-y-3 rounded-2xl bg-butter/60 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-butter-foreground">🛠️ Currently in {stage}</span>
        <span className="text-xs font-semibold text-muted-foreground">
          Step {index + 1} of {PRODUCTION_STAGES.length}
        </span>
      </div>
      <Progress value={percent} className="h-2" />
      <p className="text-xs text-muted-foreground">
        Next up: {PRODUCTION_STAGES.slice(index + 1, index + 3).join(' → ')}. Sales and royalties will appear here once
        your book is live.
      </p>
    </div>
  )
}

function RoyaltyPanel({ book }) {
  const notes = []
  if (!book.lastRoyaltyPayoutDate && book.totalRoyaltyEarned > 0) notes.push('No payout made yet.')
  if (book.royaltyPending > 0 && book.royaltyPending < MIN_PAYOUT) {
    notes.push(`Pending is under the ${inr(MIN_PAYOUT)} payout minimum, so it rolls over to the next quarter.`)
  }
  if (book.royaltyPending === 0 && book.royaltyPaid > 0) notes.push('All caught up! 🎉')

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-lavender p-3 text-lavender-foreground">
          <p className="text-[11px] font-semibold">Earned</p>
          <p className="font-extrabold">{inr(book.totalRoyaltyEarned)}</p>
        </div>
        <div className="rounded-2xl bg-mint p-3 text-mint-foreground">
          <p className="text-[11px] font-semibold">Paid</p>
          <p className="font-extrabold">{inr(book.royaltyPaid)}</p>
        </div>
        <div className="rounded-2xl bg-peach p-3 text-peach-foreground">
          <p className="text-[11px] font-semibold">Pending</p>
          <p className="font-extrabold">{inr(book.royaltyPending)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Last payout: {formatDate(book.lastRoyaltyPayoutDate)}
        {notes.length > 0 && <> · {notes.join(' ')}</>}
      </p>
    </div>
  )
}

function BookCard({ book }) {
  return (
    <Card className="rounded-3xl border-0 shadow-lg shadow-primary/5 transition-shadow hover:shadow-primary/15">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-extrabold">{book.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{book.genre}</p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold',
              book.isPublished ? 'bg-mint text-mint-foreground' : 'bg-butter text-butter-foreground',
            )}
          >
            {book.isPublished ? '🌱 Live' : '🛠️ In production'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <Detail label="ISBN">{book.isbn ?? '—'}</Detail>
          <Detail label="Published">{formatDate(book.publicationDate)}</Detail>
          <Detail label="MRP">{inr(book.mrp)}</Detail>
          <Detail label="Copies sold">{book.totalCopiesSold.toLocaleString('en-IN')}</Detail>
        </dl>
        {book.isPublished ? <RoyaltyPanel book={book} /> : <ProductionTracker status={book.status} />}
        {book.isPublished && book.availableOn.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {book.availableOn.map((platform) => (
              <span key={platform} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {platform}
              </span>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" size="sm">
          <Link to={`/tickets/new?bookId=${book.id}`}>
            <MessageCircleQuestion /> Ask about this book
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export function BooksPage() {
  const { user } = useAuth()
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['books'], queryFn: () => api('/books') })

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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard emoji="📚" label="Books" value={`${data.summary.publishedBooks} live / ${data.summary.totalBooks}`} tone="bg-blush text-blush-foreground" />
            <StatCard emoji="🛒" label="Copies sold" value={data.summary.totalCopiesSold.toLocaleString('en-IN')} tone="bg-sky text-sky-foreground" />
            <StatCard emoji="💖" label="Royalty earned" value={inr(data.summary.totalRoyaltyEarned)} tone="bg-lavender text-lavender-foreground" />
            <StatCard emoji="⏳" label="Royalty pending" value={inr(data.summary.royaltyPending)} tone="bg-peach text-peach-foreground" />
          </div>
          {data.data.length === 0 ? (
            <EmptyState emoji="📖" title="No books yet" description="Once your first book is in production it will show up here." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {data.data.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
