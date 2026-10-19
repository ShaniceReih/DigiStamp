
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'
import DigiStampHome from './DigiStampHome'
import ShopVisit from './ShopVisit'



type Mode = 'login' | 'signup'

function App() {
  const [mode, setMode] = useState<Mode>('signup')
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  
const shopSlug = new URLSearchParams(
  window.location.search
).get('shop')

  useEffect(() => {
    let active = true

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      if (!error) setUser(data.user)
      setChecking(false)
    }).catch(() => {
      if (active) setChecking(false)
    })

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        if (active) {
          setUser(session?.user ?? null)
          setChecking(false)
        }
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    setMessage('')
    setIsError(false)

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setMessage('Please enter your full name.')
        setIsError(true)
        return
      }

      if (password.length < 8) {
        setMessage('Password must contain at least 8 characters.')
        setIsError(true)
        return
      }

      if (password !== confirmPassword) {
        setMessage('Your passwords do not match.')
        setIsError(true)
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.href,
          },
        })

        if (error) throw error

        if (data.session) {
          setMessage('Your account has been created!')
        } else {
          setMessage(
            'Registration submitted. Check your email for a confirmation link before logging in.'
          )
          setMode('login')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error
        setMessage('')
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Something went wrong.'
      )
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    setLoading(false)

    if (error) {
      setIsError(true)
      setMessage(error.message)
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setMessage('')
    setIsError(false)
    setPassword('')
    setConfirmPassword('')
  }

  if (checking) {
    return <div className="page"><p>Loading DigiStamp...</p></div>
  }

  if (user) {
    return (
      <main className="page">
        <section className="auth-card dashboard">
          <div className="brand-icon">D</div>
          <h1>Welcome to DigiStamp!</h1>
          <p className="subtitle">Scan. Play. Earn. Return.</p>
          <div className="welcome-box">
            {shopSlug ? (
  <ShopVisit
    userId={user.id}
    shopSlug={shopSlug}
  />
) : (
  <DigiStampHome userId={user.id} />
)}
            <p>You're successfully logged in.</p>
            <strong>
              {user.user_metadata?.full_name || user.email}
            </strong>
            <small>{user.email}</small>
          </div>
          {message && (
            <p role="status" className={isError ? 'error' : 'success'}>
              {message}
            </p>
          )}
          <button
            className="primary-button"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? 'Signing out...' : 'Sign Out'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="auth-card">
        <header className="auth-header">
          <div className="brand-icon">D</div>
          <h1>DigiStamp</h1>
          <p className="tagline">Scan. Play. Earn. Return.</p>
        </header>

        <h2>{mode === 'signup' ? 'Create your account' : 'Welcome back!'}</h2>
        <p className="subtitle">
          {mode === 'signup'
            ? 'Join DigiStamp and start collecting rewards.'
            : 'Sign in to continue your loyalty journey.'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label>
              Full Name
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                placeholder="Enter your full name"
                required
              />
            </label>
          )}

          <label>
            Email Address
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          {mode === 'signup' && (
            <label>
              Confirm Password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                placeholder="Confirm your password"
                required
              />
            </label>
          )}

          {message && (
            <p role="status" className={isError ? 'error' : 'success'}>
              {message}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="switch-text">
          {mode === 'signup'
            ? 'Already have an account? '
            : "Don't have an account? "}
          <button
            type="button"
            className="text-button"
            onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
          >
            {mode === 'signup' ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </section>
    </main>
  )
}

export default App
