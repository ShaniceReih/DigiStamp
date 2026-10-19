import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'
import { errorText } from './lib/loyalty'

type Row = Record<string, unknown>
const sections: Record<string, string> = { profiles: 'Users', shops: 'Cafés', shop_staff: 'Staff assignments', rewards: 'Rewards', loyalty_accounts: 'Stamp balances', purchase_transactions: 'Purchases', reward_redemptions: 'Redemptions', shop_feature_access: 'Feature access', platform_admins: 'Developer admins', audit_events: 'Audit trail' }
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
        if (active) { setRows((result.data?.rows ?? []).slice(0,50)); setMore(!!result.data?.has_more); setCafes((shops.data?.rows ?? []).slice(0,50)) }
      } catch (error) { if (active) { setRows([]); setMore(false); setFailed(true); setMessage(errorText(error)) } }
      finally { if (active) setLoading(false) }
    }
    const timer = setTimeout(() => void load(), 250)
    return () => { active = false; clearTimeout(timer) }
  }, [entity, shop, search, page, refresh])
  function select(row: Row) {
    setSelected(row); setDraft(Object.fromEntries((fields[entity] ?? []).map(field => [field,row[field] ?? '']))); setEmail(String(row.email ?? '')); setReason(''); setDeleteText(''); setMessage(''); setInvite(false)
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
      const { error } = await supabase.rpc('admin_save', { p_entity:entity, p_id:selected?.id ?? selected?.shop_id ?? null, p_data:draft, p_reason:reason.trim() })
      if (error) throw error
      setSelected(null)
      return 'Changes saved and recorded in the audit trail.'
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
  const primary = (row: Row) => String(row.username ?? row.name ?? row.title ?? row.receipt_reference ?? row.operation ?? row.customer_id ?? row.user_id ?? row.shop_id ?? row.id)
  return <section className="admin-panel">
    <button type="button" className="text-button welcome-back" onClick={onBack}>← Back to account</button><h2>Developer admin</h2><p className="subtitle">Manage DigiStamp across cafés. Edits require a reason and are recorded in the audit trail.</p>
    <div className="admin-filters"><label>Section<select aria-label="Section" value={entity} onChange={event => { setEntity(event.target.value); setSelected(null); setInvite(false); setPage(0); setLoading(true); setMessage('') }}>{Object.entries(sections).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Café filter<select aria-label="Café filter" value={shop} onChange={event => { setShop(event.target.value); setPage(0); setLoading(true) }}><option value="">All cafés</option>{cafes.map(cafe => <option key={String(cafe.id)} value={String(cafe.id)}>{String(cafe.name)}</option>)}</select></label>
      <label>Search<input value={search} onChange={event => { setSearch(event.target.value); setPage(0); setLoading(true) }} placeholder="Username, customer ID, café, or receipt" /></label></div>
    <div className="admin-actions"><button type="button" className="wallet-refresh" onClick={() => { setLoading(true); setMessage(''); setRefresh(value => value + 1) }}>Refresh</button>
      {empty[entity] && <button type="button" className="wallet-refresh" onClick={() => { setSelected({}); setDraft(empty[entity]); setReason(''); setMessage('') }}>Add {entity === 'shops' ? 'café' : entity === 'rewards' ? 'reward' : 'staff assignment'}</button>}
      {entity === 'profiles' && <button type="button" className="wallet-refresh" onClick={() => { setInvite(true); setSelected(null); setEmail(''); setReason(''); setMessage('') }}>Invite user</button>}</div>
    {loading ? <p role="status">Loading records…</p> : <div className="admin-records">{!rows.length && <p>No records match this filter.</p>}{rows.map((row,index) => <article key={String(row.id ?? row.user_id ?? row.shop_id ?? index)}><div><strong>{primary(row)}</strong><small>{String(row.created_at ?? row.registered_at ?? '')}</small>{row.shop_id ? <small>Café: {String(cafes.find(cafe => cafe.id === row.shop_id)?.name ?? row.shop_id)}</small> : null}</div><button type="button" className="text-button" onClick={() => select(row)}>View{fields[entity] ? ' / edit' : ''}</button></article>)}</div>}
    <div className="admin-pagination"><button type="button" className="wallet-refresh" disabled={page===0||loading} onClick={() => { setPage(value=>value-1);setLoading(true) }}>Previous</button><span>Page {page+1}</span><button type="button" className="wallet-refresh" disabled={!more||loading} onClick={() => { setPage(value=>value+1);setLoading(true) }}>Next</button></div>
    {selected && <section className="admin-editor"><h3>{sections[entity]} details</h3><details><summary>Record data</summary><pre>{JSON.stringify(selected,null,2)}</pre></details>
      {fields[entity] && <form onSubmit={save}><fieldset disabled={busy}>{fields[entity].map(field => <label key={field}>{labels[field] ?? field.replaceAll('_',' ')}
        {typeof draft[field] === 'boolean' ? <select value={String(draft[field])} onChange={event => setDraft({...draft,[field]:event.target.value==='true'})}><option value="true">Yes</option><option value="false">No</option></select>
          : options[field] ? <select value={String(draft[field] ?? '')} onChange={event => setDraft({...draft,[field]:event.target.value})}>{options[field].filter(value=>field!=='role'||value!=='customer').map(value=><option key={value}>{value}</option>)}</select>
          : <input value={Array.isArray(draft[field]) ? (draft[field] as string[]).join(', ') : String(draft[field] ?? '')} type={['stamps','points','required_stamps'].includes(field)?'number':'text'} min="0" onChange={event => setDraft({...draft,[field]:field==='features'?event.target.value.split(',').map(value=>value.trim()).filter(Boolean):['stamps','points','required_stamps'].includes(field)?Number(event.target.value):event.target.value || (field==='logo_url'?null:'')})} />}
      </label>)}<label>Reason for this change<textarea required minLength={5} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} /></label><button type="submit" className="primary-button">Save audited changes</button></fieldset></form>}
      {!fields[entity] && <p className="wallet-note">Historical records are read-only. Correct stamp balances through Stamp balances; every correction is audited.</p>}
      {entity==='profiles' && <div className="admin-account-actions"><h3>Account administration</h3><label>Sign-in email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} /></label><label>Audit reason<textarea value={reason} onChange={event=>setReason(event.target.value)} /></label><button type="button" className="wallet-refresh" disabled={busy} onClick={()=>void accountAction('update_email')}>Update email and send confirmation</button>
        <button type="button" className="wallet-refresh" disabled={busy} onClick={()=>void run(async()=>{const {error}=await supabase.rpc('admin_set_access',{p_user_id:selected.id,p_enabled:!selected.is_admin,p_reason:reason});if(error)throw error;setSelected(null);return 'Admin access updated.'})}>{selected.is_admin?'Remove':'Grant'} developer admin access</button>
        <label>Type DELETE to remove this user<input value={deleteText} onChange={event=>setDeleteText(event.target.value)} /></label><button type="button" className="danger-button" disabled={busy||deleteText!=='DELETE'} onClick={()=>void accountAction('delete_user')}>Delete selected user</button></div>}
      {entity==='shop_staff' && <button type="button" className="danger-button" disabled={busy} onClick={()=>void run(async()=>{const {error}=await supabase.rpc('admin_remove_staff',{p_id:selected.id,p_reason:reason});if(error)throw error;setSelected(null);return 'Staff assignment removed.'})}>Remove staff assignment</button>}
      <button type="button" className="text-button" onClick={()=>setSelected(null)}>Close details</button>
    </section>}
    {invite && <form className="admin-editor" onSubmit={event=>{event.preventDefault();void accountAction('invite_user')}}><h3>Invite a new user</h3><label>Full name<input value={inviteName} onChange={event=>setInviteName(event.target.value)} required /></label><label>Username<input value={inviteUsername} onChange={event=>setInviteUsername(event.target.value)} required /></label><label>Email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} required /></label><label>Audit reason<textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={5} required /></label><button type="submit" className="primary-button" disabled={busy}>Send invitation</button></form>}
    {message && <p className={failed?'error':'success'} role="status">{message}</p>}
  </section>
}
