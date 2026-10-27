import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(tokenStore.get() ? 'loading' : 'anonymous')

  const logout = useCallback(() => {
    tokenStore.clear()
    queryClient.clear()
    setUser(null)
    setStatus('anonymous')
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!tokenStore.get()) return
    api('/auth/me')
      .then(({ user }) => {
        setUser(user)
        setStatus('authenticated')
      })
      .catch(logout)
  }, [logout])

  const login = useCallback(async (email, password) => {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } })
    tokenStore.set(token)
    setUser(user)
    setStatus('authenticated')
    return user
  }, [])

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
