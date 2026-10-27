import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCheck, Lock, Paperclip, RefreshCw, Sparkles, UserCheck, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { SourceTag, StatusBadge } from '@/components/Badges'
import { MessageThread } from '@/components/MessageThread'
import { ReplyBox } from '@/components/ReplyBox'
import { ErrorState, LoadingState } from '@/components/States'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { CATEGORIES, PRIORITIES, STATUSES, UNRESOLVED } from '@/lib/constants'
import { formatDate, formatDateTime, inr, timeAgo } from '@/lib/format'

const UNASSIGNED = 'unassigned'

function SidebarSelect({ label, value, onChange, options, footer, disabled }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase">{label}</span>
        {footer}
      </div>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  )
}

function DraftPanel({ ticket, generate, onUse }) {
  const unavailable = generate.error?.code === 'AI_UNAVAILABLE'

  if (generate.isPending) {
    return (
      <div className="space-y-2 rounded-3xl bg-primary/5 p-4 ring-1 ring-primary/15">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <Sparkles className="size-4 animate-pulse" /> Drafting a reply with BookLeaf policies…
        </p>
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-10/12" />
        <Skeleton className="h-3 w-8/12" />
      </div>
    )
  }

  if (generate.error) {
    return (
      <Alert className="rounded-3xl border-peach-foreground/30 bg-peach/50">
        <Wand2 />
        <AlertTitle>{unavailable ? 'AI draft unavailable' : 'Could not generate a draft'}</AlertTitle>
        <AlertDescription>
          <p>{generate.error.message}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => generate.mutate()}>
            <RefreshCw /> Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!ticket.aiDraft) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">
        <span>No AI draft for the latest message.</span>
        <Button size="sm" variant="secondary" onClick={() => generate.mutate()}>
          <Sparkles /> Generate draft
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-3xl bg-primary/5 p-4 ring-1 ring-primary/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <Sparkles className="size-4" /> AI-suggested reply
        </p>
        <span className="text-xs text-muted-foreground">Generated {timeAgo(ticket.aiDraftGeneratedAt)}</span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.aiDraft}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onUse(ticket.aiDraft)}>
          <Wand2 /> Use draft
        </Button>
        <Button size="sm" variant="ghost" onClick={() => generate.mutate()}>
          <RefreshCw /> Regenerate
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Review and edit before sending — the author only sees what you send.</p>
    </div>
  )
}

export function AdminTicketPage() {
  const { id } = useParams()
  const ticketId = Number(id)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')
  const [usedDraft, setUsedDraft] = useState(false)
  const [note, setNote] = useState('')
  const autoDrafted = useRef(new Set())

  const ticketQuery = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api(`/tickets/${ticketId}`).then((res) => res.data),
  })
  const admins = useQuery({
    queryKey: ['admins'],
    queryFn: () => api('/users/admins').then((res) => res.data),
    staleTime: Infinity,
  })
  const ticket = ticketQuery.data

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
  }

  const update = useMutation({
    mutationFn: (changes) => api(`/tickets/${ticketId}`, { method: 'PATCH', body: changes }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(['ticket', ticketId], data)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const generate = useMutation({
    mutationFn: () => api(`/tickets/${ticketId}/draft`, { method: 'POST' }).then((res) => res.data),
    onSuccess: (draft) => {
      queryClient.setQueryData(['ticket', ticketId], (prev) =>
        prev ? { ...prev, aiDraft: draft.draft, aiDraftGeneratedAt: draft.generatedAt } : prev,
      )
    },
  })

  const reclassify = useMutation({
    mutationFn: () => api(`/tickets/${ticketId}/classify`, { method: 'POST' }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(['ticket', ticketId], data)
      toast.success('Re-classified with AI ✨')
    },
    onError: (err) => toast.error(err.message),
  })

  const sendReply = useMutation({
    mutationFn: async ({ resolve }) => {
      await api(`/tickets/${ticketId}/messages`, { method: 'POST', body: { body: reply.trim(), aiAssisted: usedDraft } })
      if (resolve) await api(`/tickets/${ticketId}`, { method: 'PATCH', body: { status: 'resolved' } })
    },
    onSuccess: (_data, { resolve }) => {
      setReply('')
      setUsedDraft(false)
      toast.success(resolve ? 'Reply sent and ticket resolved 🎉' : 'Reply sent 💌')
      refresh()
    },
    onError: (err) => toast.error(err.message),
  })

  const addNote = useMutation({
    mutationFn: () => api(`/tickets/${ticketId}/notes`, { method: 'POST', body: { body: note.trim() } }),
    onSuccess: () => {
      setNote('')
      refresh()
    },
    onError: (err) => toast.error(err.message),
  })

  // Draft automatically when the author is waiting on us, once per message.
  const lastMessage = ticket?.messages.at(-1)
  const needsReply = ticket && UNRESOLVED.includes(ticket.status) && lastMessage?.sender.role !== 'admin'
  const draftKey = ticket ? `${ticket.id}:${lastMessage?.id ?? 'initial'}` : null
  const { mutate: requestDraft, isPending: drafting } = generate
  useEffect(() => {
    if (!ticket || ticket.aiDraft || !needsReply || autoDrafted.current.has(draftKey) || drafting) return
    autoDrafted.current.add(draftKey)
    requestDraft()
  }, [ticket, needsReply, draftKey, drafting, requestDraft])

  if (ticketQuery.isPending) return <LoadingState label="Opening ticket…" />
  if (ticketQuery.error) return <ErrorState error={ticketQuery.error} onRetry={ticketQuery.refetch} />

  const book = ticket.book
  const isMine = ticket.assignedTo?.id === user.id

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/tickets">
          <ArrowLeft /> Back to queue
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold">#{ticket.id}</span>
          <StatusBadge status={ticket.status} />
          <span>
            · Opened {formatDateTime(ticket.createdAt)} ({timeAgo(ticket.createdAt)})
          </span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{ticket.subject}</h1>
        <p className="text-sm text-muted-foreground">
          {ticket.author.name} · {ticket.author.email}
          {ticket.attachmentName && (
            <span className="ml-3 inline-flex items-center gap-1">
              <Paperclip className="size-3" /> {ticket.attachmentName}
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="rounded-3xl border-0 shadow-lg shadow-primary/5">
            <CardContent>
              <MessageThread ticket={ticket} authorName={ticket.author.name} viewerRole="admin" />
            </CardContent>
          </Card>

          {ticket.status !== 'closed' && (
            <Card className="rounded-3xl border-0 shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="font-extrabold">Reply to {ticket.author.name.split(' ')[0]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DraftPanel
                  ticket={ticket}
                  generate={generate}
                  onUse={(text) => {
                    setReply(text)
                    setUsedDraft(true)
                  }}
                />
                <ReplyBox
                  value={reply}
                  onChange={(value) => {
                    setReply(value)
                    if (!value) setUsedDraft(false)
                  }}
                  onSubmit={() => sendReply.mutate({ resolve: false })}
                  pending={sendReply.isPending}
                  placeholder="Write your reply, or start from the AI draft above…"
                  rows={8}
                >
                  {usedDraft && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      <Sparkles className="size-3" /> Started from AI draft
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sendReply.isPending || !reply.trim()}
                    onClick={() => sendReply.mutate({ resolve: true })}
                  >
                    <CheckCheck /> Send & resolve
                  </Button>
                </ReplyBox>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="gap-4 rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-extrabold">Triage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SidebarSelect
                label="Status"
                value={ticket.status}
                onChange={(status) => update.mutate({ status })}
                options={Object.entries(STATUSES).map(([k, v]) => [k, v.label])}
                disabled={update.isPending}
              />
              <SidebarSelect
                label="Priority"
                value={ticket.priority ?? 'medium'}
                onChange={(priority) => update.mutate({ priority })}
                options={Object.entries(PRIORITIES).map(([k, v]) => [k, v.label])}
                footer={<SourceTag source={ticket.prioritySource} />}
                disabled={update.isPending}
              />
              <SidebarSelect
                label="Category"
                value={ticket.category ?? 'general_inquiry'}
                onChange={(category) => update.mutate({ category })}
                options={Object.entries(CATEGORIES).map(([k, v]) => [k, `${v.emoji} ${v.label}`])}
                footer={<SourceTag source={ticket.categorySource} />}
                disabled={update.isPending}
              />
              {ticket.aiReasoning && (
                <p className="rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Why: </span>
                  {ticket.aiReasoning}
                </p>
              )}
              {(ticket.categorySource === 'fallback' || ticket.prioritySource === 'fallback') && (
                <Button size="sm" variant="secondary" className="w-full" disabled={reclassify.isPending} onClick={() => reclassify.mutate()}>
                  {reclassify.isPending ? <Spinner /> : <Sparkles />} Re-run AI classification
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="gap-4 rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-extrabold">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SidebarSelect
                label="Assignee"
                value={ticket.assignedTo ? String(ticket.assignedTo.id) : UNASSIGNED}
                onChange={(value) => update.mutate({ assignedTo: value === UNASSIGNED ? null : Number(value) })}
                options={[[UNASSIGNED, 'Unassigned'], ...(admins.data ?? []).map((a) => [String(a.id), a.name])]}
                disabled={update.isPending || admins.isPending}
              />
              {!isMine && (
                <Button size="sm" variant="outline" className="w-full" disabled={update.isPending} onClick={() => update.mutate({ assignedTo: user.id })}>
                  <UserCheck /> Assign to me
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="gap-4 rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-extrabold">{book ? '📖 Book' : '💬 General query'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {book ? (
                <>
                  <p className="font-bold">{book.title}</p>
                  <Fact label="Status">{book.status}</Fact>
                  <Fact label="ISBN">{book.isbn ?? '—'}</Fact>
                  {book.isPublished && (
                    <>
                      <Fact label="Published">{formatDate(book.publicationDate)}</Fact>
                      <Fact label="MRP">{inr(book.mrp)}</Fact>
                      <Fact label="Copies sold">{book.totalCopiesSold}</Fact>
                      <Separator className="my-2" />
                      <Fact label="Royalty earned">{inr(book.totalRoyaltyEarned)}</Fact>
                      <Fact label="Paid">{inr(book.royaltyPaid)}</Fact>
                      <Fact label="Pending">{inr(book.royaltyPending)}</Fact>
                      <Fact label="Last payout">{formatDate(book.lastRoyaltyPayoutDate)}</Fact>
                      <Fact label="Printer">{book.printPartner ?? '—'}</Fact>
                      <Fact label="Platforms">{book.availableOn.length}</Fact>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">This ticket is about the author&apos;s account rather than a specific book.</p>
              )}
            </CardContent>
          </Card>

          <Card className="gap-4 rounded-3xl border-0 bg-butter/40 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-extrabold">
                <Lock className="size-4" /> Internal notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Only visible to the BookLeaf team.</p>
              {ticket.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
              {ticket.notes.map((n) => (
                <div key={n.id} className="rounded-2xl bg-card p-3 text-sm shadow-xs">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.admin.name} · {timeAgo(n.createdAt)}
                  </p>
                </div>
              ))}
              <Textarea
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Checked with finance, payout batch delayed…"
                className="rounded-2xl bg-card"
              />
              <Button size="sm" variant="secondary" className="w-full" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()}>
                {addNote.isPending && <Spinner />} Add note
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
