import { Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDateTime, initials } from '@/lib/format'
import { cn } from '@/lib/utils'

function Bubble({ name, role, body, createdAt, aiAssisted, isOriginal, alignRight }) {
  const isStaff = role === 'admin'
  return (
    <div className={cn('flex gap-3', alignRight && 'flex-row-reverse')}>
      <Avatar className="mt-1 size-9 shrink-0">
        <AvatarFallback
          className={cn('text-xs font-bold', isStaff ? 'bg-primary/15 text-primary' : 'bg-secondary text-secondary-foreground')}
        >
          {isStaff ? '🍃' : initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className={cn('max-w-[85%] space-y-1', alignRight && 'items-end text-right')}>
        <div className={cn('flex flex-wrap items-center gap-2 text-xs text-muted-foreground', alignRight && 'justify-end')}>
          <span className="font-semibold text-foreground">{isStaff ? `${name} · BookLeaf` : name}</span>
          <span>{formatDateTime(createdAt)}</span>
          {isOriginal && <span className="rounded-full bg-muted px-2 py-0.5">Original query</span>}
          {aiAssisted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              <Sparkles className="size-3" /> AI-assisted
            </span>
          )}
        </div>
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-left text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
            isStaff ? 'bg-card ring-1 ring-primary/15' : 'bg-secondary/70',
            alignRight ? 'rounded-tr-md' : 'rounded-tl-md',
          )}
        >
          {body}
        </div>
      </div>
    </div>
  )
}

/**
 * Conversation for a ticket, starting with the original query. `viewerRole`
 * puts the viewer's own side on the right, like a chat app.
 */
export function MessageThread({ ticket, authorName, viewerRole }) {
  const rightRole = viewerRole === 'admin' ? 'admin' : 'author'
  return (
    <div className="space-y-5">
      <Bubble
        name={authorName}
        role="author"
        body={ticket.description}
        createdAt={ticket.createdAt}
        isOriginal
        alignRight={rightRole === 'author'}
      />
      {ticket.messages.map((message) => (
        <Bubble
          key={message.id}
          name={message.sender.name}
          role={message.sender.role}
          body={message.body}
          createdAt={message.createdAt}
          aiAssisted={viewerRole === 'admin' && message.aiAssisted}
          alignRight={message.sender.role === rightRole}
        />
      ))}
    </div>
  )
}
