import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'
import { errorText } from './lib/loyalty'
import { normalizeUsername, usernameError } from './lib/usernames'
import UsernameField from './UsernameField'
import ProfileAvatar from './ProfileAvatar'
import { avatarBucket, prepareProfilePhoto, validateProfilePhoto } from './lib/profilePhoto'

type Account = { full_name: string; username: string; customer_code: string; roles: string[]; avatar_path?: string | null }
type Props = { userId: string; photoUrl: string | null; onPhotoSaved: (path: string | null) => void; email: string; onBack: () => void; onAdmin: () => void; onSaved: (name: string) => void; onDeleted: () => void }
export default function AccountSettings({ userId, photoUrl, onPhotoSaved, email, onBack, onAdmin, onSaved, onDeleted }: Props) {
  const [account, setAccount] = useState<Account | null>(null)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [newEmail, setNewEmail] = useState(email)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [photoMessage, setPhotoMessage] = useState('')
  const [photoFailed, setPhotoFailed] = useState(false)
  const [photoCleanupPending, setPhotoCleanupPending] = useState(false)
  useEffect(()=>{
    return ()=>{if(preview)URL.revokeObjectURL(preview)}
  },[preview])
  async function savePhoto(remove = false) {
    if (busy || (!remove && !photo)) return
    setBusy(true);setPhotoMessage('');setPhotoFailed(false)
    try {
      const path = `${userId}/profile.jpg`
      if (!remove && photo) {
        const image = await prepareProfilePhoto(photo)
        const {error} = await supabase.storage.from(avatarBucket).upload(path,image,{contentType:'image/jpeg',upsert:true,cacheControl:'0'})
        if(error)throw error
      }
      const {error} = await supabase.rpc('update_my_avatar',{p_path:remove?null:path})
      if(error)throw error
      setAccount(current=>current && {...current,avatar_path:remove?null:path})
      onPhotoSaved(remove?null:path)
      setPhoto(null)
      setPreview(null)
      if (remove) {
        setPhotoCleanupPending(true)
        const {error:cleanupError} = await supabase.storage.from(avatarBucket).remove([path])
        if(cleanupError)throw new Error('Photo removed from your profile, but file cleanup failed. Please try removing it again.')
        setPhotoCleanupPending(false)
      }
      setPhotoMessage(remove?'Profile photo removed.':'Profile photo updated.')
    } catch(error) {setPhotoFailed(true);setPhotoMessage(errorText(error))}
    finally {setBusy(false)}
  }
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
    <button type="button" className="text-button welcome-back" disabled={busy} onClick={onBack}>← Back</button><h1>Account settings</h1><p className="subtitle">Your profile, sign-in details, and account access.</p>
    {!account && !message && <p role="status">Loading account…</p>}
    {account && <>
      <section className="profile-card" aria-label="Your profile"><div className="profile-card-identity"><ProfileAvatar large name={account.full_name || account.username} src={(photo && preview) || photoUrl} /><div><h2>{account.full_name || account.username}</h2><p>@{account.username}</p><small>{account.customer_code}</small></div></div>
        <div className="profile-roles">{account.roles.map(role => <span key={role} className="role-badge">{role}</span>)}</div>
        <div className="profile-photo-tools"><label className={`photo-picker${busy?' is-disabled':''}`}>Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-label="Choose profile photo" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{validateProfilePhoto(file);setPhoto(file);setPreview(URL.createObjectURL(file));setPhotoMessage('Preview ready. Save photo to apply it.');setPhotoFailed(false)}catch(error){setPhotoMessage(errorText(error));setPhotoFailed(true)}}} /></label>
          {photo && <><button type="button" className="wallet-refresh" disabled={busy} onClick={()=>void savePhoto()}>{busy?'Saving…':'Save photo'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>{setPhoto(null);setPreview(null);setPhotoMessage('')}}>Cancel photo</button></>}
          {(account.avatar_path || photoCleanupPending) && !photo && <button type="button" className="text-button" disabled={busy} onClick={()=>void savePhoto(true)}>Remove photo</button>}
        </div><p className="wallet-note">JPG, PNG, or WebP, up to 5 MB. Your photo is cropped to a square.</p>
        {photoMessage && <p className={photoFailed?'error':'success'} role="status">{photoMessage}</p>}
      </section>
      {account.roles.includes('Admin') && <button type="button" className="wallet-refresh" onClick={onAdmin}>Open admin panel</button>}
      <form onSubmit={saveProfile}><fieldset disabled={busy}><legend>Profile</legend><label>Full name<input value={name} onChange={event => setName(event.target.value)} required maxLength={120} autoComplete="name" /></label><UsernameField value={username} current={account.username} onChange={setUsername} /><button type="submit" className="primary-button">Save profile</button></fieldset></form>
      <form onSubmit={saveEmail}><fieldset disabled={busy}><legend>Email address</legend><p className="wallet-note">Current sign-in email: {email}</p><label>New email address<input type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} required autoComplete="email" /></label><button type="submit" className="wallet-refresh" disabled={newEmail.trim() === email}>Update email</button></fieldset></form>
      <form className="danger-zone" onSubmit={deleteAccount}><fieldset disabled={busy}><legend>Delete account</legend><p>This permanently removes your login, profile, café memberships, and stamp balances. Anonymized transaction records remain for café accounting. Sole café owners and the last developer admin must transfer responsibility first.</p><label>Type DELETE to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" placeholder="DELETE" /></label><button type="submit" className="danger-button" disabled={confirmation !== 'DELETE'}>Permanently delete my account</button></fieldset></form>
    </>}
    {message && <p role="status" className={failed ? 'error' : 'success'}>{message}</p>}
    {!account && failed && <button type="button" className="wallet-refresh" onClick={() => { setMessage(''); setAttempt(value => value + 1) }}>Try again</button>}
  </section>
}
