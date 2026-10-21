import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from './lib/supabase'
import { cafeColumns, errorText } from './lib/loyalty'
import type { Cafe, FeatureAccess, Reward } from './lib/loyalty'
import CafeSettings from './CafeSettings'
import CashierPanel from './CashierPanel'
import StampIcon from './StampIcon'
import BillingPanel from './BillingPanel'
import { describeAccess } from './lib/billing'

type Membership = { shop_id: string; role: 'owner' | 'cashier' }
export default function MerchantHome({ memberships }: { memberships: Membership[] }) {
  const [shopId, setShopId] = useState(memberships[0]?.shop_id ?? '')
  const [shops, setShops] = useState<Cafe[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [access, setAccess] = useState<FeatureAccess | null>(null)
  const [tab, setTab] = useState('checkout')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const [copyError, setCopyError] = useState('')
  const owner = memberships.find(item => item.shop_id === shopId)?.role === 'owner'
  const cafe = shops.find(shop => shop.id === shopId)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const results = await Promise.all([
          supabase.from('shops').select(cafeColumns).in('id', memberships.map(item => item.shop_id)),
          supabase.from('rewards').select('id, shop_id, title, required_stamps, is_active').eq('shop_id', shopId).order('required_stamps'),
          supabase.from('shop_feature_access').select('status, trial_ends_at, features').eq('shop_id', shopId).maybeSingle(),
        ])
        for (const result of results) if (result.error) throw result.error
        if (active) { setShops(results[0].data as Cafe[]); setRewards(results[1].data as Reward[]); setAccess(results[2].data as FeatureAccess | null) }
      } catch (error) { if (active) setError(errorText(error)) }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [memberships, shopId, refresh])

  const link = cafe?.qr_code ? new URL(`/?shop=${encodeURIComponent(cafe.qr_code)}`, window.location.origin).toString() : ''
  return <section className="merchant-home">
    <header className="merchant-heading"><div><h1>Your café workspace</h1><p className="subtitle">A good visit starts here.</p></div>
    {shops.length > 0 && <label>Café<select aria-label="Café" value={shopId} onChange={event => { setLoading(true); setError(''); setCopyError(''); setShopId(event.target.value); setTab('checkout'); setCopied(false) }}>{shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>}
    </header>
    {error && <><p role="alert" className="error">{error}</p><button type="button" className="wallet-refresh" onClick={() => { setLoading(true); setError(''); setRefresh(value => value + 1) }}>Try again</button></>}
    {loading && <p className="loading-state" role="status">Loading café workspace…</p>}
    {!loading && !error && !cafe && <p className="status-message">Your assigned café is unavailable. Contact DigiStamp to check your staff assignment.</p>}
    {!loading && !error && cafe && <>
      <aside className="merchant-sidebar"><p className="staff-role">{owner ? 'Owner' : 'Cashier'} workspace</p>
      <nav className="workspace-nav" aria-label="Café tools">
        <button type="button" aria-pressed={tab === 'checkout'} onClick={() => setTab('checkout')}><StampIcon kind="stamp" />Checkout</button>
        <button type="button" aria-pressed={tab === 'qr'} onClick={() => setTab('qr')}><StampIcon kind="qr" />Café QR</button>
        {owner && <><button type="button" aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}><StampIcon kind="cafe" />Customize</button><button type="button" aria-pressed={tab === 'billing'} onClick={() => setTab('billing')}><StampIcon kind="receipt" />Billing</button><button type="button" aria-pressed={tab === 'reports'} onClick={() => setTab('reports')}><StampIcon kind="home" />Reports<span className="nav-soon">Soon</span></button></>}
      </nav>
      </aside><div className="merchant-content">
      {tab !== 'billing' && <div className="workspace-context"><span className="access-label">{describeAccess(access, now).label}</span></div>}
      {tab === 'checkout' && <CashierPanel key={shopId} shopId={shopId} />}
      {tab === 'qr' && <section className="qr-panel"><h2>Café QR code</h2><p className="subtitle">Display this at checkout so customers can open your café’s page.</p>
        {link ? <><div className="qr-image"><QRCodeSVG value={link} size={210} level="M" marginSize={4} fgColor="#622b14" title={`QR code for ${cafe.name}`} /></div>
          <p className="qr-link"><a href={link}>{link}</a></p>
          <button type="button" className="primary-button" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setCopyError('') } catch { setCopyError('Could not copy the link. Select the displayed URL to copy it manually.') } }}>{copied ? 'Link copied' : 'Copy café link'}</button>
          {copyError && <p className="error" role="status">{copyError}</p>}
          <p className="qr-hint">Scanning opens this café’s page. Only an authorized cashier can award stamps.</p></> : <p className="status-message">A QR identifier has not been assigned to this café yet. Contact DigiStamp to set it up.</p>}
      </section>}
      {tab === 'billing' && owner && <BillingPanel key={shopId} cafeName={cafe.name} access={access} onRefresh={() => { setLoading(true); setError(''); setRefresh(value => value + 1) }} onCustomize={() => setTab('settings')} />}
      {tab === 'settings' && owner && <CafeSettings key={shopId} cafe={cafe} rewards={rewards} access={access} onSaved={() => setRefresh(value => value + 1)} />}
      {tab === 'reports' && owner && <section className="reports-preview"><span className="coming-soon">Coming soon</span><h2>Understand what brings people back.</h2><p className="subtitle">Monthly summaries and retention reports will appear here once reporting is available.</p></section>}
      </div>
    </>}
  </section>
}
