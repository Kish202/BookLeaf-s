import { LogOut, Menu } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
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

// Shared by the header and main content so their edges line up.
const CONTAINER = 'w-full px-4 sm:px-6 lg:px-10'

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

function MobileNav({ items, connected }) {
  const { pathname } = useLocation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="rounded-full md:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.to}
            asChild
            className={cn('font-semibold', pathname === item.to && 'bg-primary/15 text-primary focus:bg-primary/15 focus:text-primary')}
          >
            <NavLink to={item.to} end>
              {item.label}
            </NavLink>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className={cn('size-2 rounded-full', connected ? 'animate-pulse bg-mint-foreground' : 'bg-muted-foreground/40')} />
          {connected ? 'Live updates on' : 'Reconnecting…'}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
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
        <div className={cn(CONTAINER, 'flex h-16 items-center gap-4 sm:gap-8')}>
          <NavLink to="/" className="shrink-0">
            <Logo />
          </NavLink>
          <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
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
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <LiveIndicator connected={connected} />
            <MobileNav items={NAV[user.role]} connected={connected} />
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
        </div>
      </header>
      <main className={cn(CONTAINER, 'py-8')}>
        <Outlet />
      </main>
    </div>
  )
}
