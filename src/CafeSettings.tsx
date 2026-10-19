import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'
import { errorText, featureEnabled } from './lib/loyalty'
import type { Cafe, FeatureAccess, Reward } from './lib/loyalty'
import LoyaltyCard from './LoyaltyCard'

type Props = { cafe: Cafe; access: FeatureAccess | null; rewards: Reward[]; onSaved: () => void }

export default function CafeSettings({ cafe, access, rewards, onSaved }: Props) {
  const [draft, setDraft] = useState(cafe)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const branding = featureEnabled(access, 'custom_branding', now)
  const rewardAccess = featureEnabled(access, 'custom_rewards', now)

  async function saveBranding(event: FormEvent) {
    event.preventDefault()
    if (saving || !branding) return
    setSaving(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('save_shop_branding', {
        p_shop_id: cafe.id, p_brand_color: draft.brand_color, p_card_color: draft.card_color,
        p_logo_url: draft.logo_url ?? '', p_stamp_icon: draft.stamp_icon,
      })
      if (error) throw error
      setIsError(false)
      setMessage('Café branding saved.')
      onSaved()
    } catch (error) { setIsError(true); setMessage(errorText(error)) }
    finally { setSaving(false) }
  }

  return (
    <section className="cafe-settings">
      <h2>Café customization</h2>
      <p className="subtitle">Your café’s identity, on every customer’s card.</p>
      <p className="status-message">
        {access?.status === 'trial' && Date.parse(access.trial_ends_at) > now
          ? `Trial access until ${new Date(access.trial_ends_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}.`
          : access?.status === 'active' ? 'Customization access is active.' : 'Customization access has ended. Contact DigiStamp to continue.'}
      </p>
      <form onSubmit={saveBranding}>
        <fieldset disabled={!branding || saving}>
          <legend>Branding</legend>
          <p className="wallet-note">Start with the DigiStamp defaults. Add your café’s colors and a hosted logo when they are ready.</p>
          <label>Brand color<input type="color" value={draft.brand_color} onChange={event => setDraft({ ...draft, brand_color: event.target.value })} /></label>
          <label>Card background<input type="color" value={draft.card_color} onChange={event => setDraft({ ...draft, card_color: event.target.value })} /></label>
          <label>Logo URL (optional)<input type="url" maxLength={2048} pattern="https://.*" placeholder="https://your-cafe.com/logo.png" value={draft.logo_url ?? ''} onChange={event => setDraft({ ...draft, logo_url: event.target.value })} /></label>
          <label>Stamp style<select value={draft.stamp_icon} onChange={event => setDraft({ ...draft, stamp_icon: event.target.value as Cafe['stamp_icon'] })}>
            <option value="check">Classic check</option><option value="star">Star</option><option value="cafe">Coffee cup</option>
          </select></label>
          <button className="primary-button" type="submit">{saving ? 'Saving…' : 'Save branding'}</button>
        </fieldset>
      </form>
      {message && <p role="status" className={isError ? 'error' : 'success'}>{message}</p>}
      <div className="branding-preview"><h3>Card preview</h3><p className="wallet-note">Sample balance · not a customer account</p>
        <LoyaltyCard cafe={draft} stamps={3} rewards={rewards.length ? rewards : [{ id: 'preview', shop_id: cafe.id, title: 'Your reward', required_stamps: 5, is_active: true }]} />
      </div>
      <section className="reward-settings"><h2>Rewards</h2><p className="subtitle">Set a stamp target and reward name for this café. Changes apply to existing balances.</p>
        {rewards.map(reward => <RewardForm key={`${reward.id}-${reward.title}-${reward.required_stamps}-${reward.is_active}`} cafeId={cafe.id} reward={reward} enabled={rewardAccess} onSaved={onSaved} />)}
        <RewardForm cafeId={cafe.id} enabled={rewardAccess} onSaved={onSaved} />
      </section>
    </section>
  )
}

function RewardForm({ cafeId, reward, enabled, onSaved }: { cafeId: string; reward?: Reward; enabled: boolean; onSaved: () => void }) {
  const [title, setTitle] = useState(reward?.title ?? '')
  const [target, setTarget] = useState(String(reward?.required_stamps ?? 10))
  const [active, setActive] = useState(reward?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (saving || !enabled) return
    setSaving(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('save_shop_reward', {
        p_shop_id: cafeId, p_reward_id: reward?.id ?? null, p_title: title.trim(), p_required_stamps: Number(target), p_is_active: active,
      })
      if (error) throw error
      setFailed(false)
      setMessage('Reward saved.')
      if (!reward) { setTitle(''); setTarget('10'); setActive(true) }
      onSaved()
    } catch (error) { setFailed(true); setMessage(errorText(error)) }
    finally { setSaving(false) }
  }
  return <form className="reward-editor" onSubmit={save}>
    <fieldset disabled={!enabled || saving}>
      <legend>{reward ? 'Edit reward' : 'Add a reward'}</legend>
      <label>Reward name<input value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} placeholder="e.g. Your café’s reward" /></label>
      <label>Stamps required<input type="number" min="1" max="100" step="1" required value={target} onChange={event => setTarget(event.target.value)} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />Visible to customers</label>
      <button type="submit" className="primary-button">{saving ? 'Saving…' : reward ? 'Save reward' : 'Add reward'}</button>
    </fieldset>
    {message && <p role="status" className={failed ? 'error' : 'success'}>{message}</p>}
  </form>
}
