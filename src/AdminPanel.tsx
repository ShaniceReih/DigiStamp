import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'
import { errorText } from './lib/loyalty'

type Row = Record<string, unknown>
async function findStaffAccount(account: string, isActive = () => true): Promise<Row | undefined> {
  let page = 0
  while (isActive()) {
    const { data, error } = await supabase.rpc('admin_list', { p_entity:'profiles', p_search:account, p_page:page })
    if (error) throw error
    const user = (data?.rows ?? []).find((row: Row) =>
      String(row.username ?? '').toLowerCase() === account || String(row.customer_code ?? '').toLowerCase() === account)
    if (user || !data?.has_more) return user
    page += 1
  }
}
const sections: Record<string, string> = { profiles: 'Users', shops: 'Cafés', shop_staff: 'Staff assignments', rewards: 'Rewards', loyalty_accounts: 'Stamp balances', purchase_transactions: 'Purchases', reward_redemptions: 'Redemptions', shop_feature_access: 'Feature access', platform_admins: 'Developer admins', audit_events: 'Audit trail' }
const sectionGroups = [
  {label:'People', entities:['profiles','shop_staff','platform_admins']},
  {label:'Cafés & rewards', entities:['shops','rewards','shop_feature_access']},
  {label:'Activity', entities:['loyalty_accounts','purchase_transactions','reward_redemptions','audit_events']},
]
const fields: Record<string, string[]> = {
  profiles: ['full_name','username'], shops: ['name','description','address','qr_code','brand_color','card_color','logo_url','stamp_icon'], shop_staff: ['shop_id','user_id','role'],
  rewards: ['shop_id','title','description','required_stamps','is_active'], loyalty_accounts: ['stamps','points'], shop_feature_access: ['status','trial_ends_at','features'],
}
const labels: Record<string, string> = { full_name:'Full name', username:'Username', shop_id:'Café ID', user_id:'User ID', required_stamps:'Required stamps', is_active:'Active reward', qr_code:'Café QR identifier', brand_color:'Brand color', card_color:'Card background', logo_url:'Logo URL', stamp_icon:'Stamp style', trial_ends_at:'Trial ends at (ISO date)', features:'Features (comma-separated)' }
const options: Record<string, string[]> = { role:['customer','owner','cashier'], stamp_icon:['check','star','cafe'], status:['trial','active','disabled'] }
const empty: Record<string, Row> = { shops:{ name:'', description:'',address:'',qr_code:'',brand_color:'#995F2F',card_color:'#FBF6E8',logo_url:null,stamp_icon:'check' }, shop_staff:{shop_id:'',user_id:'',role:'cashier'}, rewards:{shop_id:'',title:'',description:'',required_stamps:10,is_active:true} }

export default function AdminPanel({ onBack, currentUserId }: { onBack: () => void; currentUserId: string }) {
  const [entity, setEntity] = useState('profiles')
  const [rows, setRows] = useState<Row[]>([])
  const [cafes, setCafes] = useState<Row[]>([])
  const [shop, setShop] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<Row | null>(null)
  const [editing, setEditing] = useState(false)
  const [people, setPeople] = useState<Record<string, Row>>({})
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [draft, setDraft] = useState<Row>({})
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [email, setEmail] = useState('')
  const [deleteText, setDeleteText] = useState('')
  const [invite, setInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')
  const [staffAccount, setStaffAccount] = useState('')
  const staffFeedbackId = useId()
  const normalizedStaffAccount = staffAccount.trim().replace(/^@/, '').toLowerCase()
  const [staffLookup, setStaffLookup] = useState<{account:string; user?:Row; error?:string} | null>(null)
  const staffLookupCurrent = staffLookup?.account === normalizedStaffAccount
  const inRecord = !!selected || invite
  useEffect(() => {
    headingRef.current?.focus()
    headingRef.current?.scrollIntoView({block:'start'})
  }, [entity, inRecord, editing])
  useEffect(() => {
    if (entity !== 'shop_staff' || !selected || !normalizedStaffAccount) return
    let active = true
    const timer = setTimeout(async () => {
      try {
        const user = await findStaffAccount(normalizedStaffAccount, () => active)
        if (active) setStaffLookup({account:normalizedStaffAccount, user})
      } catch {
        if (active) setStaffLookup({account:normalizedStaffAccount, error:'Could not check this account. Try again or save to retry.'})
      }
    }, 400)
    return () => { active = false; clearTimeout(timer) }
  }, [entity, selected, normalizedStaffAccount])
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [result, shops] = await Promise.all([
          supabase.rpc('admin_list', { p_entity: entity, p_shop_id: shop || null, p_search: search.trim(), p_page: page }),
          supabase.rpc('admin_list', { p_entity:'shops', p_page:0 }),
        ])
        if (result.error) throw result.error
        if (shops.error) throw shops.error
        const records: Row[] = (result.data?.rows ?? []).slice(0,50)
        if (active) { setRows(records); setMore(!!result.data?.has_more); setCafes((shops.data?.rows ?? []).slice(0,50)); setLoading(false) }
        const ids = [...new Set(records.flatMap(row => [row.user_id, row.customer_id]).filter((id): id is string => typeof id === 'string'))]
        const identities = await Promise.all(ids.map(async id => {
          try {
            const {data,error} = await supabase.rpc('admin_list', {p_entity:'profiles',p_search:id,p_page:0})
            return error ? undefined : (data?.rows ?? []).find((row: Row) => row.id === id)
          } catch { return undefined }
        }))
        if (active) setPeople(current => ({...current,...Object.fromEntries(identities.filter((row): row is Row => !!row).map(row => [String(row.id),row]))}))
      } catch (error) { if (active) { setRows([]); setMore(false); setFailed(true); setMessage(errorText(error)) } }
      finally { if (active) setLoading(false) }
    }
    const timer = setTimeout(() => void load(), 250)
    return () => { active = false; clearTimeout(timer) }
  }, [entity, shop, search, page, refresh])
  function select(row: Row, edit = false) {
    setEditing(edit)
    setStaffAccount('')
    setSelected(row); setDraft(Object.fromEntries((fields[entity] ?? []).map(field => [field,row[field] ?? '']))); setEmail(String(row.email ?? '')); setReason(''); setDeleteText(''); setMessage(''); setInvite(false)
  }
  function openSection(next: string) {
    setEntity(next); setSelected(null); setInvite(false); setEditing(false); setSearch(''); setPage(0); setLoading(true); setMessage('')
    setRefresh(value=>value+1)
  }
  function backToList() {
    setSelected(null); setInvite(false); setEditing(false); setMessage('')
  }
  async function run(action: () => Promise<string>) {
    if (busy) return
    if (reason.trim().length < 5) { setMessage('Enter an audit reason with at least 5 characters.'); setFailed(true); return }
    setBusy(true); setMessage('')
    try { setMessage(await action()); setFailed(false); setRefresh(value => value + 1) }
    catch (error) { setFailed(true); setMessage(errorText(error)) }
    finally { setBusy(false) }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      const data = { ...draft }
      let assignmentId = selected?.id ?? selected?.shop_id ?? null
      let addedStaff = false
      if (entity === 'shop_staff') {
        if (!data.shop_id) throw new Error('Choose a café first.')
        if (staffAccount.trim()) {
          const account = staffAccount.trim().replace(/^@/, '').toLowerCase()
          const user = await findStaffAccount(account)
          if (!user) throw new Error('Account not found. Enter the exact username or customer code. They need a DigiStamp account first.')
          data.user_id = user.id
        } else if (!selected?.id) throw new Error('Enter a username or customer code.')
        // A different person or café is a separate membership, never a replacement
        // for the staff record currently being viewed (especially its owner).
        if (selected?.id && (data.user_id !== selected.user_id || data.shop_id !== selected.shop_id)) {
          assignmentId = null
          addedStaff = true
        }
      }
      const { error } = await supabase.rpc('admin_save', { p_entity:entity, p_id:assignmentId, p_data:data, p_reason:reason.trim() })
      if (error) throw error
      setSelected(null)
      return addedStaff ? 'Staff assignment added. The original staff assignment was kept.' : 'Changes saved and recorded in the audit trail.'
    })
  }
  async function accountAction(action: string) {
    await run(async () => {
      const { data, error } = await supabase.functions.invoke('account-management', { body: { action, user_id:selected?.id, email, full_name:inviteName, username:inviteUsername, confirmation:deleteText, reason:reason.trim() } })
      if (error) { let detail = ''; try { detail = (await error.context.json()).error } catch { /* fall back to request error */ } throw new Error(detail || errorText(error)) }
      if (!data?.success) throw new Error(data?.error || 'Request failed')
      if (action === 'delete_user' && selected?.id === currentUserId) await supabase.auth.signOut({ scope:'local' })
      setSelected(null); setInvite(false)
      return data.message || 'Account action completed.'
    })
  }
  const personName = (id: unknown) => {
    const person = people[String(id)]
    return person ? String(person.full_name || person.username || person.customer_code) : String(id ?? 'Unknown account')
  }
  const primary = (row: Row) => String(row.full_name || row.username || row.name || row.title || row.receipt_reference || (row.user_id ? personName(row.user_id) : row.customer_id ? personName(row.customer_id) : row.operation || cafes.find(cafe=>cafe.id===row.shop_id)?.name || row.id || row.shop_id))
  const displayValue = (key: string, value: unknown): string => {
    if (value == null || value === '') return 'Not set'
    if (key === 'user_id' || key === 'customer_id') return personName(value)
    if (key === 'shop_id') return String(cafes.find(cafe=>cafe.id===value)?.name ?? value)
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (key === 'memberships' && Array.isArray(value)) return value.map((membership: Row)=>`${cafes.find(cafe=>cafe.id===membership.shop_id)?.name ?? 'Café'} · ${membership.role}`).join('\n') || 'No staff assignments'
    if (Array.isArray(value) && value.every(item=>typeof item==='string')) return value.join(', ') || 'None'
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
  }
  return <section className="admin-panel">
    <button type="button" className="text-button welcome-back" disabled={busy} onClick={onBack}>← Back to account</button><h1>Developer admin</h1>
    <label className="admin-mobile-navigation">Admin section<select aria-label="Admin section" value={entity} disabled={busy} onChange={event=>openSection(event.target.value)}>{sectionGroups.map(group=><optgroup key={group.label} label={group.label}>{group.entities.map(key=><option key={key} value={key}>{sections[key]}</option>)}</optgroup>)}</select></label>
    <div className="admin-workspace"><nav className="admin-navigation" aria-label="Admin sections">{sectionGroups.map(group=><div key={group.label}><p>{group.label}</p>{group.entities.map(key=><button type="button" key={key} disabled={busy} aria-current={entity===key?'page':undefined} onClick={()=>openSection(key)}>{sections[key]}</button>)}</div>)}</nav>
    <div className="admin-content">
    {inRecord && <button type="button" className="text-button" disabled={busy} onClick={backToList}>← Back to {sections[entity].toLowerCase()}</button>}
    <h2 ref={headingRef} tabIndex={-1} className="admin-screen-title">{invite ? 'Invite a new user' : selected ? selected.id || selected.shop_id ? `${editing ? 'Edit' : 'View'} ${primary(selected)}` : `Add ${entity==='shops'?'café':entity==='rewards'?'reward':'staff assignment'}` : sections[entity]}</h2>
    {!inRecord && <>
    <div className="admin-filters">
      <label>Café filter<select aria-label="Café filter" value={shop} onChange={event => { setShop(event.target.value); setPage(0); setLoading(true) }}><option value="">All cafés</option>{cafes.map(cafe => <option key={String(cafe.id)} value={String(cafe.id)}>{String(cafe.name)}</option>)}</select></label>
      <label>Search<input value={search} onChange={event => { setSearch(event.target.value); setPage(0); setLoading(true) }} placeholder="Username, customer ID, café, or receipt" /></label></div>
    <div className="admin-actions"><button type="button" className="wallet-refresh" onClick={() => { setLoading(true); setMessage(''); setRefresh(value => value + 1) }}>Refresh</button>
      {empty[entity] && <button type="button" className="wallet-refresh" onClick={() => { setSelected({}); setEditing(true); setDraft({...empty[entity], ...(entity === 'shop_staff' ? {shop_id:shop} : {})}); setStaffAccount(''); setReason(''); setMessage('') }}>Add {entity === 'shops' ? 'café' : entity === 'rewards' ? 'reward' : 'staff assignment'}</button>}
      {entity === 'profiles' && <button type="button" className="wallet-refresh" onClick={() => { setInvite(true); setSelected(null); setEmail(''); setReason(''); setMessage('') }}>Invite user</button>}</div>
    {loading ? <p role="status">Loading records…</p> : <div className="admin-records">{!rows.length && <p>No {sections[entity].toLowerCase()} match this filter.</p>}{rows.map((row,index) => <article key={String(row.id ?? row.user_id ?? row.shop_id ?? index)}><div><strong>{primary(row)}</strong>{row.username ? <small>@{String(row.username)}{row.customer_code ? ` · ${row.customer_code}` : ''}</small> : null}{row.email ? <small>{String(row.email)}</small> : null}{row.role ? <small>Role: {String(row.role)}</small> : null}<small>{String(row.created_at ?? row.registered_at ?? '')}</small>{row.shop_id ? <small>Café: {String(cafes.find(cafe => cafe.id === row.shop_id)?.name ?? row.shop_id)}</small> : null}</div><div className="admin-row-actions"><button type="button" className="text-button" aria-label={`View ${primary(row)}`} onClick={() => select(row)}>View</button>{fields[entity] && <button type="button" className="text-button" aria-label={`Edit ${primary(row)}`} onClick={() => select(row,true)}>Edit</button>}</div></article>)}</div>}
    <div className="admin-pagination"><button type="button" className="wallet-refresh" disabled={page===0||loading} onClick={() => { setPage(value=>value-1);setLoading(true) }}>Previous</button><span>Page {page+1}</span><button type="button" className="wallet-refresh" disabled={!more||loading} onClick={() => { setPage(value=>value+1);setLoading(true) }}>Next</button></div>
    </>}
    {selected && <section className="admin-editor" aria-label={editing?'Edit record':'Record details'}>
      {!editing && <><dl className="admin-details">{Object.entries(selected).filter(([key])=>key!=='id').map(([key,value])=><div key={key}><dt>{key==='user_id'?'Account':key==='customer_id'?'Customer':key==='shop_id'?'Café':labels[key] ?? key.replaceAll('_',' ')}</dt><dd>{displayValue(key,value)}</dd></div>)}</dl>{fields[entity] && <button type="button" className="primary-button" onClick={()=>setEditing(true)}>Edit details</button>}<details><summary>Technical record data</summary><pre>{JSON.stringify(selected,null,2)}</pre></details></>}
      {editing && entity === 'shop_staff' && !!selected.id && <p className="wallet-note">Current role: {String(selected.role)}. Entering a different account or choosing another café adds a separate staff assignment and keeps this one.</p>}
      {editing && fields[entity] && <form onSubmit={save}><fieldset disabled={busy}>{fields[entity].map(field => <label key={field}>{entity === 'shop_staff' && field === 'user_id' ? 'Username or customer code' : entity === 'shop_staff' && field === 'shop_id' ? 'Café' : labels[field] ?? field.replaceAll('_',' ')}
        {entity === 'shop_staff' && field === 'shop_id' ? <select required value={String(draft.shop_id ?? '')} onChange={event=>setDraft({...draft,shop_id:event.target.value})}><option value="">Choose a café</option>{!!draft.shop_id && !cafes.some(cafe=>cafe.id===draft.shop_id) && <option value={String(draft.shop_id)}>Current café</option>}{cafes.map(cafe=><option key={String(cafe.id)} value={String(cafe.id)}>{String(cafe.name)}</option>)}</select>
          : entity === 'shop_staff' && field === 'user_id' ? <><input aria-label="Username or customer code" placeholder={selected.id ? 'Leave blank to keep this account' : '@username or DS-000001'} value={staffAccount} required={!selected.id} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={staffFeedbackId} aria-invalid={!!normalizedStaffAccount && staffLookupCurrent && !staffLookup?.user && !staffLookup?.error} onChange={event=>{setStaffAccount(event.target.value);setStaffLookup(null)}} />
            <span id={staffFeedbackId} role="status" className={`field-feedback${normalizedStaffAccount && staffLookupCurrent && !staffLookup?.user ? ' field-invalid' : ''}`}>
              {!normalizedStaffAccount ? selected.id ? 'Leave blank to keep the current account.' : 'Enter an existing DigiStamp username or customer code.'
                : !staffLookupCurrent ? 'Checking account…'
                : staffLookup?.error || (staffLookup?.user ? `Account found: ${staffLookup.user.full_name || staffLookup.user.username} (@${staffLookup.user.username}) · ${staffLookup.user.customer_code}` : 'Account not found. Check the username or ask them to create an account.')}
            </span></>
          : typeof draft[field] === 'boolean' ? <select value={String(draft[field])} onChange={event => setDraft({...draft,[field]:event.target.value==='true'})}><option value="true">Yes</option><option value="false">No</option></select>
          : options[field] ? <select value={String(draft[field] ?? '')} onChange={event => setDraft({...draft,[field]:event.target.value})}>{options[field].filter(value=>field!=='role'||value!=='customer').map(value=><option key={value}>{value}</option>)}</select>
          : <input value={Array.isArray(draft[field]) ? (draft[field] as string[]).join(', ') : String(draft[field] ?? '')} type={['stamps','points','required_stamps'].includes(field)?'number':'text'} min="0" onChange={event => setDraft({...draft,[field]:field==='features'?event.target.value.split(',').map(value=>value.trim()).filter(Boolean):['stamps','points','required_stamps'].includes(field)?Number(event.target.value):event.target.value || (field==='logo_url'?null:'')})} />}
      </label>)}<label>Reason for this change<textarea required minLength={5} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} /></label><button type="submit" className="primary-button">Save audited changes</button></fieldset></form>}
      {!fields[entity] && <p className="wallet-note">Historical records are read-only. Correct stamp balances through Stamp balances; every correction is audited.</p>}
      {editing && entity==='profiles' && <div className="admin-account-actions"><h3>Account administration</h3><label>Sign-in email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} /></label><label>Audit reason<textarea value={reason} onChange={event=>setReason(event.target.value)} /></label><button type="button" className="wallet-refresh" disabled={busy} onClick={()=>void accountAction('update_email')}>Update email and send confirmation</button>
        <button type="button" className="wallet-refresh" disabled={busy} onClick={()=>void run(async()=>{const {error}=await supabase.rpc('admin_set_access',{p_user_id:selected.id,p_enabled:!selected.is_admin,p_reason:reason});if(error)throw error;setSelected(null);return 'Admin access updated.'})}>{selected.is_admin?'Remove':'Grant'} developer admin access</button>
        <label>Type DELETE to remove this user<input value={deleteText} onChange={event=>setDeleteText(event.target.value)} /></label><button type="button" className="danger-button" disabled={busy||deleteText!=='DELETE'} onClick={()=>void accountAction('delete_user')}>Delete selected user</button></div>}
      {editing && entity==='shop_staff' && !!selected.id && <button type="button" className="danger-button" disabled={busy} onClick={()=>void run(async()=>{const {error}=await supabase.rpc('admin_remove_staff',{p_id:selected.id,p_reason:reason});if(error)throw error;setSelected(null);return 'Staff assignment removed.'})}>Remove staff assignment</button>}
      <button type="button" className="text-button" disabled={busy} onClick={backToList}>{editing?'Cancel and return to list':'Back to list'}</button>
    </section>}
    {invite && <form className="admin-editor" onSubmit={event=>{event.preventDefault();void accountAction('invite_user')}}><fieldset disabled={busy}><label>Full name<input value={inviteName} onChange={event=>setInviteName(event.target.value)} required /></label><label>Username<input value={inviteUsername} onChange={event=>setInviteUsername(event.target.value)} required /></label><label>Email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} required /></label><label>Audit reason<textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={5} required /></label><button type="submit" className="primary-button">Send invitation</button><button type="button" className="text-button" onClick={backToList}>Cancel invitation</button></fieldset></form>}
    {message && <p className={failed?'error':'success'} role="status">{message}</p>}
    </div></div>
  </section>
}
