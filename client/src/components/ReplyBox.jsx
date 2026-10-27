import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

export function ReplyBox({ value, onChange, onSubmit, pending, placeholder, submitLabel = 'Send', children, rows = 4 }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim()) onSubmit()
      }}
      className="space-y-3"
    >
      <Textarea
        rows={rows}
        value={value}
        maxLength={5000}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && value.trim()) onSubmit()
        }}
        className="rounded-2xl bg-card"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <Button type="submit" disabled={pending || !value.trim()}>
          {pending ? <Spinner /> : <Send />} {submitLabel}
        </Button>
      </div>
    </form>
  )
}
