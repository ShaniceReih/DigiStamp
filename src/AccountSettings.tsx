import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'
import { errorText } from './lib/loyalty'
import { normalizeUsername, usernameError } from './lib/usernames'
import UsernameField from './UsernameField'

type Account = { full_name: string; username: string; customer_code: string; roles: string[] }
type Props = { email: string; onBack: () => void; onAdmin: () => void; onSaved: (name: string) => void; onDeleted: () => void }
export default function AccountSettings({ email, onBack, onAdmin, onSaved, onDeleted }: Props) {
  const [account, setAccount] = useState<Account | null>(null)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [newEmail, setNewEmail] = useState(email)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data, error } = await supabase.rpc('get_my_account')
        if (error) throw error
        if (!data) throw new Error('Account details are unavailable.')
        if (active) { setAccount(data as Account); setName(data.full_name ?? ''); setUsername(data.username) }
      } catch (error) { if (active) { setFailed(true); setMessage(errorText(error)) } }
    }
    void load()
    return () => { active = false }
  }, [attempt])
  async function run(task: () => Promise<string>) {
    if (busy) return
    setBusy(true); setMessage('')
    try { setMessage(await task()); setFailed(false) }
    catch (error) { setMessage(errorText(error)); setFailed(true) }
    finally { setBusy(false) }
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      if (normalizeUsername(username) !== account?.username && usernameError(username)) throw new Error(usernameError(username))
      const { error } = await supabase.rpc('update_my_profile', { p_full_name: name.trim(), p_username: normalizeUsername(username) })
      if (error) throw error
      setAccount(previous => previous && { ...previous, full_name: name.trim(), username: normalizeUsername(username) })
      onSaved(name.trim())
      return 'Profile updated.'
    })
  }
  async function saveEmail(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      const { data, error } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (error) throw error
      return data.user?.email === newEmail.trim() ? 'Email updated.' : 'Email change requested. Check your current and new inboxes for confirmation instructions. Your sign-in email stays unchanged until confirmation.'
    })
  }
  async function deleteAccount(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      const { data, error } = await supabase.functions.invoke('account-management', { body: { action: 'delete_self', confirmation } })
      if (error) throw new Error(await error.context?.json?.().then((body: { error?: string }) => body.error).catch(() => null) || errorText(error))
      if (!data?.success) throw new Error(data?.error || 'Account was not deleted.')
      await supabase.auth.signOut({ scope: 'local' })
      onDeleted()
      return 'Account deleted.'
    })
  }
  return <section className="account-settings">
    <button type="button" className="text-button welcome-back" onClick={onBack}>← Back</button><h2>Account settings</h2><p className="subtitle">Your profile, sign-in details, and account access.</p>
    {!account && !message && <p role="status">Loading account…</p>}
    {account && <>
      <div className="account-status"><span>Account status</span><div>{account.roles.map(role => <span key={role} className="role-badge">{role}</span>)}</div><small>{account.customer_code}</small></div>
      {account.roles.includes('Admin') && <button type="button" className="wallet-refresh" onClick={onAdmin}>Open admin panel</button>}
      <form onSubmit={saveProfile}><fieldset disabled={busy}><legend>Profile</legend><label>Full name<input value={name} onChange={event => setName(event.target.value)} required maxLength={120} autoComplete="name" /></label><UsernameField value={username} current={account.username} onChange={setUsername} /><button type="submit" className="primary-button">Save profile</button></fieldset></form>
      <form onSubmit={saveEmail}><fieldset disabled={busy}><legend>Email address</legend><p className="wallet-note">Current sign-in email: {email}</p><label>New email address<input type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} required autoComplete="email" /></label><button type="submit" className="wallet-refresh" disabled={newEmail.trim() === email}>Update email</button></fieldset></form>
      <form className="danger-zone" onSubmit={deleteAccount}><fieldset disabled={busy}><legend>Delete account</legend><p>This permanently removes your login, profile, café memberships, and stamp balances. Anonymized transaction records remain for café accounting. Sole café owners and the last developer admin must transfer responsibility first.</p><label>Type DELETE to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" placeholder="DELETE" /></label><button type="submit" className="danger-button" disabled={confirmation !== 'DELETE'}>Permanently delete my account</button></fieldset></form>
    </>}
    {message && <p role="status" className={failed ? 'error' : 'success'}>{message}</p>}
    {!account && failed && <button type="button" className="wallet-refresh" onClick={() => { setMessage(''); setAttempt(value => value + 1) }}>Try again</button>}
  </section>
}
