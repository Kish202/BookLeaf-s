import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Send, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'

const GENERAL = 'general'
const MAX_DESCRIPTION = 5000

export function NewTicketPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const fileInput = useRef(null)
  const [form, setForm] = useState({
    bookId: searchParams.get('bookId') ?? GENERAL,
    subject: '',
    description: '',
    attachmentName: null,
  })
  const [errors, setErrors] = useState({})

  const books = useQuery({ queryKey: ['books'], queryFn: () => api('/books') })

  const createTicket = useMutation({
    mutationFn: (body) => api('/tickets', { method: 'POST', body }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success("Ticket sent! We'll get back to you soon 💌")
      navigate(`/tickets/${data.id}`)
    },
    onError: (err) => {
      const fieldErrors = err.fieldErrors?.() ?? {}
      setErrors(fieldErrors)
      if (Object.keys(fieldErrors).length === 0) toast.error(err.message)
    },
  })

  function validate() {
    const next = {}
    if (form.subject.trim().length < 5) next.subject = 'Subject must be at least 5 characters'
    if (form.description.trim().length < 20) next.description = 'Please describe the issue in at least 20 characters'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) return
    createTicket.mutate({
      bookId: form.bookId === GENERAL ? null : form.bookId,
      subject: form.subject.trim(),
      description: form.description.trim(),
      attachmentName: form.attachmentName,
    })
  }

  const set = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="How can we help? 🌸" description="Tell us what's going on and our team will reply here." />
      <Card className="rounded-lg border-0 shadow-lg shadow-primary/5">
        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel>Which book is this about?</FieldLabel>
                <Select value={form.bookId} onValueChange={set('bookId')} disabled={books.isPending}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a book" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GENERAL}>💬 General / Account Level</SelectItem>
                    {books.data?.data.map((book) => (
                      <SelectItem key={book.id} value={book.id}>
                        📖 {book.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.bookId && <FieldError>{errors.bookId}</FieldError>}
              </Field>

              <Field data-invalid={Boolean(errors.subject)}>
                <FieldLabel htmlFor="subject">Subject</FieldLabel>
                <Input
                  id="subject"
                  maxLength={150}
                  placeholder="e.g. Royalty for last quarter not received"
                  value={form.subject}
                  onChange={(e) => set('subject')(e.target.value)}
                  aria-invalid={Boolean(errors.subject)}
                />
                {errors.subject && <FieldError>{errors.subject}</FieldError>}
              </Field>

              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="description">Details</FieldLabel>
                <Textarea
                  id="description"
                  rows={7}
                  maxLength={MAX_DESCRIPTION}
                  placeholder="Share as much as you can: what happened, when, and anything you've already tried."
                  value={form.description}
                  onChange={(e) => set('description')(e.target.value)}
                  aria-invalid={Boolean(errors.description)}
                />
                <FieldDescription className="flex justify-between">
                  <span>Specific details (dates, platforms, amounts) help us answer faster.</span>
                  <span>
                    {form.description.length}/{MAX_DESCRIPTION}
                  </span>
                </FieldDescription>
                {errors.description && <FieldError>{errors.description}</FieldError>}
              </Field>

              <Field>
                <FieldLabel>Attachment (optional)</FieldLabel>
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => set('attachmentName')(e.target.files?.[0]?.name ?? null)}
                />
                {form.attachmentName ? (
                  <div className="flex items-center justify-between rounded-md bg-muted px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-2 truncate font-medium">
                      <Paperclip className="size-4" /> {form.attachmentName}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove attachment"
                      onClick={() => {
                        set('attachmentName')(null)
                        if (fileInput.current) fileInput.current.value = ''
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-fit" onClick={() => fileInput.current?.click()}>
                    <Paperclip /> Add a screenshot or photo
                  </Button>
                )}
                <FieldDescription>Photos of misprints or screenshots of listings are super helpful.</FieldDescription>
              </Field>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTicket.isPending}>
                  {createTicket.isPending ? <Spinner /> : <Send />} Send ticket
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
