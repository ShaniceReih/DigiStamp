
import { lazy, Suspense, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'
import DigiStampHome from './DigiStampHome'
import ShopVisit from './ShopVisit'
import WelcomeScreen from './WelcomeScreen'
import StampIcon from './StampIcon'
import UsernameField from './UsernameField'
import { normalizeUsername, usernameError } from './lib/usernames'



type Mode = 'login' | 'signup'
const AdminPanel = lazy(() => import('./AdminPanel'))
const AccountSettings = lazy(() => import('./AccountSettings'))

function App() {
  const [mode, setMode] = useState<Mode>('signup')
  const [showWelcome, setShowWelcome] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [username, setUsername] = useState('')
  const [screen, setScreen] = useState<'app' | 'settings' | 'admin'>('app')
  const [profileName, setProfileName] = useState('')
  useEffect(() => { window.scrollTo({ top:0, behavior:'instant' }) }, [screen])

  
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
          if (!session) { setScreen('app'); setProfileName('') }
          setChecking(false)
        }
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    if (user?.id) void Promise.resolve(supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()).then(({ data }) => { if (active) setProfileName(data?.full_name ?? '') }).catch(() => {})
    return () => { active = false }
  }, [user?.id])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    setMessage('')
    setIsError(false)

    if (mode === 'signup') {
      if (usernameError(username)) { setMessage(usernameError(username)); setIsError(true); return }
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
        const availability = await supabase.rpc('username_available', { p_username: normalizeUsername(username) })
        if (availability.error) throw availability.error
        if (availability.data !== true) throw new Error('This username is already taken or reserved. Please choose another.')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim(), username: normalizeUsername(username) },
            emailRedirectTo: window.location.href,
          },
        })

        if (error) {
          const check = await supabase.rpc('username_available', { p_username: normalizeUsername(username) })
          if (!check.error && check.data === false) throw new Error('This username is already taken. Please choose another.')
          throw error
        }

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
    return <div className="page"><p className="loading-state" role="status">Loading DigiStamp...</p></div>
  }

  if (user) {
    return (
      <main className="page">
        <section className="auth-card dashboard">
          <header className="dashboard-header">
            <div className="app-brand"><span className="app-emblem"><StampIcon /></span><div><h1 className="wordmark">DigiStamp</h1><p className="tagline">Scan. Play. Earn. Return.</p></div></div>
            <button type="button" className="user-avatar" aria-label="Open account settings" onClick={() => setScreen('settings')}>{String(profileName || user.user_metadata?.full_name || user.email || 'D').slice(0, 1).toUpperCase()}</button>
          </header>
          <div className="welcome-box">
            {screen === 'settings' ? <Suspense fallback={<p role="status">Loading account settings…</p>}><AccountSettings key={user.id} email={user.email ?? ''} onBack={() => setScreen('app')} onAdmin={() => setScreen('admin')} onSaved={setProfileName} onDeleted={() => { setUser(null); setScreen('app'); setProfileName(''); setShowWelcome(true) }} /></Suspense> : screen === 'admin' ? <Suspense fallback={<p role="status">Loading admin panel…</p>}><AdminPanel currentUserId={user.id} onBack={() => setScreen('settings')} /></Suspense> : shopSlug ? (
              <ShopVisit userId={user.id} shopSlug={shopSlug} />
            ) : (
              <DigiStampHome key={user.id} userId={user.id} userName={profileName || String(user.user_metadata?.full_name || '')} email={user.email ?? ''} onSignOut={handleLogout} signingOut={loading} onSettings={() => setScreen('settings')} />
            )}
            <div className="account-details app-account-footer">
              <p>Signed in as</p>
              <strong>
                {profileName || user.user_metadata?.full_name || user.email}
              </strong>
              <small>{user.email}</small>
            </div>
          </div>
          {message && (
            <p role="status" className={isError ? 'error' : 'success'}>
              {message}
            </p>
          )}
          <button
            className="text-button sign-out app-account-footer"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? 'Signing out...' : 'Sign Out'}
          </button>
        </section>
      </main>
    )
  }

  if (showWelcome) {
    return (
      <WelcomeScreen
        onSignIn={() => { switchMode('login'); setShowWelcome(false) }}
        onSignUp={() => { switchMode('signup'); setShowWelcome(false) }}
      />
    )
  }

  return (
    <main className="page">
      <section className="auth-card">
        <button type="button" className="text-button welcome-back" onClick={() => setShowWelcome(true)}>
          &larr; Back to welcome
        </button>
        <header className="auth-header">
          <div className="brand-icon"><StampIcon /></div>
          <h1 className="wordmark">DigiStamp</h1>
          <p className="tagline">Scan. Play. Earn. Return.</p>
        </header>

        <h2>{mode === 'signup' ? 'Create your account' : 'Welcome back!'}</h2>
        <p className="subtitle">
          {mode === 'signup'
            ? 'Join DigiStamp and start collecting rewards.'
            : 'Sign in to continue your loyalty journey.'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && <UsernameField value={username} onChange={setUsername} />}
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
