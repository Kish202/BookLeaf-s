import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { RequireAuth } from '@/components/RequireAuth'
import { EmptyState, LoadingState } from '@/components/States'
import { useAuth } from '@/context/AuthContext'
import { homeFor } from '@/lib/routes'
import { LoginPage } from '@/pages/LoginPage'

// Authors never download the admin pages and vice versa.
const page = (load, name) => lazy(() => load().then((module) => ({ default: module[name] })))
const BooksPage = page(() => import('@/pages/author/BooksPage'), 'BooksPage')
const NewTicketPage = page(() => import('@/pages/author/NewTicketPage'), 'NewTicketPage')
const TicketsPage = page(() => import('@/pages/author/TicketsPage'), 'TicketsPage')
const TicketDetailPage = page(() => import('@/pages/author/TicketDetailPage'), 'TicketDetailPage')
const QueuePage = page(() => import('@/pages/admin/QueuePage'), 'QueuePage')
const AdminTicketPage = page(() => import('@/pages/admin/AdminTicketPage'), 'AdminTicketPage')

function Home() {
  const { user } = useAuth()
  return <Navigate to={user ? homeFor(user) : '/login'} replace />
}

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route element={<RequireAuth role="author" />}>
              <Route path="books" element={<BooksPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="tickets/new" element={<NewTicketPage />} />
              <Route path="tickets/:id" element={<TicketDetailPage />} />
            </Route>
            <Route element={<RequireAuth role="admin" />}>
              <Route path="admin/tickets" element={<QueuePage />} />
              <Route path="admin/tickets/:id" element={<AdminTicketPage />} />
            </Route>
            <Route path="*" element={<EmptyState emoji="🙈" title="Page not found" description="This page wandered off." />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
