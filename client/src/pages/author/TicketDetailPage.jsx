import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/Badges'
import { MessageThread } from '@/components/MessageThread'
import { ReplyBox } from '@/components/ReplyBox'
import { ErrorState, LoadingState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'

const STATUS_COPY = {
  open: "We've got your ticket and will reply soon. You'll see our response here the moment it's sent.",
  in_progress: 'Our team is working on this. Replies appear here automatically.',
  resolved: 'We marked this as resolved. Reply below if you still need help and we will reopen it.',
  closed: 'This ticket is closed. Please raise a new ticket if you need more help.',
}

export function TicketDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')

  const { data: ticket, isPending, error, refetch } = useQuery({
    queryKey: ['ticket', Number(id)],
    queryFn: () => api(`/tickets/${id}`).then((res) => res.data),
  })

  const sendReply = useMutation({
    mutationFn: (body) => api(`/tickets/${id}/messages`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setReply('')
      queryClient.invalidateQueries({ queryKey: ['ticket', Number(id)] })
    },
    onError: (err) => toast.error(err.message),
  })

  if (isPending) return <LoadingState label="Opening ticket…" />
  if (error) return <ErrorState error={error} onRetry={error.status === 404 ? undefined : refetch} />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/tickets">
          <ArrowLeft /> All tickets
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold">#{ticket.id}</span>
          <StatusBadge status={ticket.status} />
          <span>· Opened {formatDate(ticket.createdAt)}</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{ticket.subject}</h1>
        <p className="text-sm text-muted-foreground">
          {ticket.book ? `📖 ${ticket.book.title}` : '💬 General / Account Level'}
          {ticket.attachmentName && (
            <span className="ml-3 inline-flex items-center gap-1">
              <Paperclip className="size-3" /> {ticket.attachmentName}
            </span>
          )}
        </p>
      </div>

      <div className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-secondary-foreground">{STATUS_COPY[ticket.status]}</div>

      <Card className="rounded-3xl border-0 shadow-lg shadow-primary/5">
        <CardContent className="space-y-6">
          <MessageThread ticket={ticket} authorName={user.name} viewerRole="author" />
          {ticket.status !== 'closed' && (
            <ReplyBox
              value={reply}
              onChange={setReply}
              onSubmit={() => sendReply.mutate(reply.trim())}
              pending={sendReply.isPending}
              placeholder="Add more details or reply to our team…"
              rows={3}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
