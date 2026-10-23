import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { cafeColumns, cafeStyle, errorText } from './lib/loyalty'
import type { Cafe, Reward } from './lib/loyalty'
import StampIcon from './StampIcon'
import LoyaltyCard from './LoyaltyCard'
import MerchantHome from './MerchantHome'
import CustomerPass from './CustomerPass'
import ProfileAvatar from './ProfileAvatar'

type Membership = { shop_id: string; role: 'owner' | 'cashier' }
type WalletRow = { shop_id: string; stamps: number; points: number }

type Props = { userId: string; userName: string; photoUrl: string | null; email: string; onSignOut: () => void; signingOut: boolean; onSettings: () => void }

export default function DigiStampHome({ userId, userName, photoUrl, email, onSignOut, signingOut, onSettings }: Props) {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [wallet, setWallet] = useState<WalletRow[]>([])
  const [shops, setShops] = useState<Cafe[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [checking, setChecking] = useState(true)
  const [roleError, setRoleError] = useState('')
  const [roleAttempt, setRoleAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [view, setView] = useState<'wallet' | 'merchant'>('merchant')
  const [customerTab, setCustomerTab] = useState<'wallet' | 'rewards' | 'play' | 'account'>('wallet')

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [customerTab])

  useEffect(() => {
    let active = true
    Promise.resolve(supabase.from('shop_staff').select('shop_id, role').eq('user_id', userId).in('role', ['owner', 'cashier']))
      .then(({ data, error }) => {
        if (!active) return
        if (error) setRoleError(error.message)
        else setMemberships((data ?? []) as Membership[])
        setChecking(false)
      }).catch(error => { if (active) { setRoleError(errorText(error)); setChecking(false) } })
    return () => { active = false }
  }, [userId, roleAttempt])

  useEffect(() => {
    if (checking || roleError || (memberships.length > 0 && view === 'merchant')) return
    let active = true
    async function load() {
      try {
        const { data, error } = await supabase.from('loyalty_accounts').select('shop_id, stamps, points').eq('customer_id', userId)
        if (error) throw error
        const accounts = (data ?? []) as WalletRow[]
        let cafes: Cafe[] = []
        let offers: Reward[] = []
        if (accounts.length) {
          const ids = accounts.map(account => account.shop_id)
          const results = await Promise.all([
            supabase.from('shops').select(cafeColumns).in('id', ids),
            supabase.from('rewards').select('id, shop_id, title, required_stamps, is_active').in('shop_id', ids).eq('is_active', true),
          ])
          for (const result of results) if (result.error) throw result.error
          cafes = (results[0].data ?? []) as Cafe[]
          offers = (results[1].data ?? []) as Reward[]
        }
        if (active) { setWallet(accounts); setShops(cafes); setRewards(offers) }
      } catch (error) { if (active) setError(errorText(error)) }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [checking, roleError, memberships, view, userId, refresh])

  if (checking) return <p className="loading-state" role="status">Checking DigiStamp account…</p>
  if (roleError) return <><h1 className="app-state-title">Account access</h1><p role="alert" className="error">Unable to verify your café permissions: {roleError}</p><button type="button" className="wallet-refresh" onClick={() => { setChecking(true); setRoleError(''); setRoleAttempt(value => value + 1) }}>Try again</button></>
  return <>
    {memberships.length > 0 && <nav className="workspace-nav" aria-label="Account view">
      <button type="button" aria-pressed={view === 'merchant'} onClick={() => setView('merchant')}>Café workspace</button>
      <button type="button" aria-pressed={view === 'wallet'} onClick={() => { setLoading(true); setError(''); setView('wallet') }}>My wallet</button>
    </nav>}
    {memberships.length > 0 && view === 'merchant' ? <MerchantHome memberships={memberships} /> : <section className="customer-shell">
      <header className="customer-greeting">{customerTab === 'wallet' && <p>Hello{userName ? `, ${userName.split(' ')[0]}` : ' there'}.</p>}<h1>{customerTab === 'wallet' ? 'My collection' : customerTab === 'rewards' ? 'Rewards' : customerTab === 'play' ? 'Play' : 'Account'}</h1></header>
      {customerTab === 'wallet' && <>
      <section className="collection-banner" aria-label="Your café collection"><div><p>{loading ? 'Finding your cards…' : `${wallet.length} ${wallet.length === 1 ? 'café card' : 'café cards'} in your collection.`}</p></div>
        <div className="collection-actions"><button type="button" onClick={() => setCustomerTab('rewards')}><StampIcon kind="gift" />My rewards</button><button type="button" onClick={() => setCustomerTab('account')}><StampIcon kind="qr" />My QR code</button></div>
      </section>
      <section className="wallet">
      <div className="wallet-header wallet-toolbar"><button type="button" className="wallet-refresh" disabled={loading} onClick={() => { setLoading(true); setError(''); setRefresh(value => value + 1) }}>Refresh</button></div>
      {loading && <div className="wallet-skeleton" role="status" aria-label="Loading your stamps"><span className="visually-hidden">Loading your stamps...</span><div aria-hidden="true" className="skeleton-line" /><div aria-hidden="true" className="skeleton-line skeleton-balance" /><div aria-hidden="true" className="skeleton-stamps">{[0,1,2,3,4].map(index => <span key={index} />)}</div><div aria-hidden="true" className="skeleton-line skeleton-caption" /></div>}
      {error && <p role="alert" className="error">Unable to load wallet: {error}</p>}
      {!loading && !error && !wallet.length && <div className="wallet-cafe wallet-empty"><StampIcon /><h3>No stamps yet!</h3><p>Visit a participating café to start earning rewards.</p></div>}
      {!loading && !error && wallet.map(account => {
        const cafe = shops.find(shop => shop.id === account.shop_id)
        return cafe ? <LoyaltyCard key={account.shop_id} cafe={cafe} stamps={account.stamps} points={account.points} rewards={rewards.filter(reward => reward.shop_id === account.shop_id)} /> : <p key={account.shop_id} className="status-message">Café details are unavailable. Your balance is {account.stamps} stamps.</p>
      })}
      <p className="wallet-note">Each café has its own stamps and rewards. A cashier verifies purchases before awarding stamps. Reward redemption is coming soon.</p>
      </section></>}
      {customerTab === 'rewards' && <section className="customer-rewards"><p className="subtitle">Your stamp balance stays separate at each café.</p>
        {loading && <p className="loading-state" role="status">Loading rewards…</p>}
        {!loading && !error && !rewards.length && <div className="wallet-empty"><StampIcon kind="gift" /><h3>No rewards published yet</h3><p>Rewards from your cafés will appear here when available.</p></div>}
        {error && <p className="error" role="alert">{error}</p>}
        {rewards.filter(reward => reward.is_active).map(reward => {
          const cafe = shops.find(shop => shop.id === reward.shop_id)
          const balance = wallet.find(account => account.shop_id === reward.shop_id)?.stamps ?? 0
          return cafe && <article key={reward.id} className="reward-ticket" style={cafeStyle(cafe)}><span className="reward-ticket-icon"><StampIcon kind="gift" /></span><div><p>{cafe.name}</p><h3>{reward.title}</h3><span>{balance} / {reward.required_stamps} stamps · {balance >= reward.required_stamps ? 'Target reached' : `${reward.required_stamps - balance} to go`}</span>{cafe.qr_code && <a href={`/?shop=${encodeURIComponent(cafe.qr_code)}`}>View café card →</a>}</div></article>
        })}
        <p className="wallet-note">Reward redemption is coming soon. Reaching a target does not redeem a reward automatically.</p>
      </section>}
      {customerTab === 'play' && <section className="play-preview"><span className="play-illustration" aria-hidden="true"><StampIcon kind="play" /></span><span className="coming-soon">Coming soon</span><h2>A small moment of fun.</h2><p>Quick café games are on the way. Games and their rewards will become available after a cashier verifies an eligible purchase.</p><button className="primary-button" type="button" onClick={() => setCustomerTab('wallet')}>Back to my stamps</button></section>}
      {customerTab === 'account' && <section className="customer-account"><div className="profile-card"><div className="profile-card-identity"><ProfileAvatar large name={userName || email} src={photoUrl} /><div><p className="profile-name">{userName || 'DigiStamp member'}</p><p className="subtitle">{email}</p></div></div></div>
      <button type="button" className="wallet-refresh" onClick={onSettings}>Account settings</button>
      <CustomerPass userId={userId} />
      {error && <p className="error" role="status">{error}</p>}
      <button type="button" className="text-button sign-out" onClick={onSignOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign Out'}</button>
      </section>}
      <nav className="customer-nav" aria-label="Customer navigation">
        <button type="button" aria-current={customerTab === 'wallet' ? 'page' : undefined} onClick={() => setCustomerTab('wallet')}><StampIcon kind="home" />Home</button>
        <button type="button" aria-current={customerTab === 'rewards' ? 'page' : undefined} onClick={() => setCustomerTab('rewards')}><StampIcon kind="gift" />Rewards</button>
        <button type="button" aria-current={customerTab === 'play' ? 'page' : undefined} onClick={() => setCustomerTab('play')}><StampIcon kind="play" />Play</button>
        <button type="button" aria-current={customerTab === 'account' ? 'page' : undefined} onClick={() => setCustomerTab('account')}><StampIcon kind="user" />Account</button>
      </nav>
    </section>}
  </>
}
