import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingState } from '@/components/States'
import { useAuth } from '@/context/AuthContext'
import { homeFor } from '@/lib/routes'

/** Gate for authenticated routes; `role` restricts to authors or admins. */
export function RequireAuth({ role }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingState label="Opening your dashboard…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}
