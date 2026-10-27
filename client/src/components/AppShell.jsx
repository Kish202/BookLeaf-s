import { LogOut } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Logo } from '@/components/Logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useLiveEvents } from '@/hooks/useLiveEvents'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

const NAV = {
  author: [
    { to: '/books', label: 'My Books' },
    { to: '/tickets', label: 'My Tickets' },
    { to: '/tickets/new', label: 'Get Help' },
  ],
  admin: [{ to: '/admin/tickets', label: 'Ticket Queue' }],
}

function LiveIndicator({ connected }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="hidden items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
          <span className={cn('size-2 rounded-full', connected ? 'animate-pulse bg-mint-foreground' : 'bg-muted-foreground/40')} />
          {connected ? 'Live' : 'Offline'}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {connected ? 'Updates appear automatically' : 'Reconnecting… refresh if this persists'}
      </TooltipContent>
    </Tooltip>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const { connected } = useLiveEvents({
    enabled: Boolean(user),
    onEvent: (type, data) => {
      if (user.role === 'author' && type === 'message.created' && data.senderRole === 'admin') {
        toast('💌 New reply from BookLeaf', {
          description: `Ticket #${data.ticketId} has a new response.`,
          action: { label: 'View', onClick: () => navigate(`/tickets/${data.ticketId}`) },
        })
      }
      if (user.role === 'admin' && type === 'ticket.created') {
        toast('📬 New ticket', { description: `Ticket #${data.ticketId} just arrived.` })
      }
    },
  })

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <NavLink to="/">
            <Logo />
          </NavLink>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV[user.role].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
                    isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <LiveIndicator connected={connected} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-2 rounded-full pr-3 pl-1">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-semibold md:inline">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-semibold">{user.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout}>
                <LogOut /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
