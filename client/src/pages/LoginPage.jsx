import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Logo } from '@/components/Logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/AuthContext'
import { homeFor } from '@/lib/routes'

const DEMO_ACCOUNTS = [
  { label: '✍️ Author · Priya', email: 'priya.sharma@email.com', password: 'Author@123' },
  { label: '✍️ Author · Sneha', email: 'sneha.kulkarni@email.com', password: 'Author@123' },
  { label: '🍃 Admin', email: 'admin@bookleaf.com', password: 'Admin@123' },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedIn = await login(form.email.trim(), form.password)
      const from = location.state?.from
      const allowed = from && (loggedIn.role === 'admin') === from.startsWith('/admin')
      navigate(allowed ? from : homeFor(loggedIn), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Logo className="text-2xl" />
          <p className="mt-3 text-muted-foreground">Your author support corner 📚✨</p>
        </div>

        <Card className="rounded-lg border-0 shadow-xl shadow-primary/10">
          <CardHeader>
            <CardTitle className="text-xl font-extrabold">Welcome back!</CardTitle>
            <CardDescription>Log in to see your books and talk to our team.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate>
              <FieldGroup>
                {error && (
                  <Alert variant="destructive" className="rounded-md">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </Field>
                <Button type="submit" size="lg" disabled={submitting || !form.email || !form.password}>
                  {submitting && <Spinner />} Log in
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-dashed bg-card/60 p-4">
          <p className="mb-3 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Demo accounts — tap to fill
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setForm({ email: account.email, password: account.password })}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
