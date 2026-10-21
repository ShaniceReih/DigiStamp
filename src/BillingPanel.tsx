import { useEffect, useState } from 'react'
import { featureEnabled } from './lib/loyalty'
import type { FeatureAccess } from './lib/loyalty'
import { billingFeatures, billingSummary, describeAccess, formatTrialEnd } from './lib/billing'
import StampIcon from './StampIcon'
import BillingPackages from './BillingPackages'
import './BillingPanel.css'

type Props = { cafeName: string; access: FeatureAccess | null; onRefresh: () => void; onCustomize: () => void }

export default function BillingPanel({ cafeName, access, onRefresh, onCustomize }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const summary = describeAccess(access, now)
  const features = billingFeatures
  const canCustomize = features.some(feature => featureEnabled(access, feature.key, now))

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(billingSummary(cafeName, access, Date.now()))
      setCopyState('copied')
    } catch { setCopyState('failed') }
  }

  return <section className="billing-panel" aria-labelledby="billing-title">
    <div className="billing-heading"><div><h2 id="billing-title">Billing</h2><p className="subtitle">Your access, plan and payment setup.</p></div><button type="button" className="wallet-refresh" onClick={onRefresh}>Refresh status</button></div>
    <section className="billing-access" aria-labelledby="billing-access-title">
      <div className="billing-access-heading"><h3 id="billing-access-title">Current access</h3><span className={`billing-status billing-status--${summary.state}`}>{summary.label}</span></div>
      <p>{summary.description}</p>
      {summary.trialEnd && <p className="billing-trial-date"><span>{summary.state === 'expired' ? 'Trial ended' : 'Trial ends'}</span><time dateTime={summary.trialEnd}>{formatTrialEnd(summary.trialEnd)}</time></p>}
    </section>
    {/* Desktop: two equal columns + 24px gap fill the merchant content width. Mobile: one column. */}
    <div className="billing-grid">
      <section className="billing-section" aria-labelledby="billing-plan-title"><h3 id="billing-plan-title">Subscription details</h3>
        <dl className="billing-facts"><div><dt>Plan</dt><dd>Not set</dd></div><div><dt>Price</dt><dd>Not set</dd></div><div><dt>Renewal date</dt><dd>Not set</dd></div></dl>
        <p className="billing-note">No subscription is configured in DigiStamp. Any separate billing arrangement is not recorded here.</p>
      </section>
      <section className="billing-section" aria-labelledby="billing-payment-title"><h3 id="billing-payment-title">Payments &amp; invoices</h3>
        <dl className="billing-facts"><div><dt>Payment collection</dt><dd>Unavailable</dd></div><div><dt>Payment method</dt><dd>Not collected</dd></div><div><dt>Invoice history</dt><dd>Unavailable</dd></div></dl>
        <p className="billing-note">DigiStamp does not accept payments or issue invoices yet. No card or bank details are needed.</p>
      </section>
    </div>
    <section className="billing-features" aria-labelledby="billing-features-title"><div className="billing-section-heading"><h3 id="billing-features-title">Feature access</h3>{canCustomize && <button type="button" className="text-button" onClick={onCustomize}>Open customization</button>}</div>
      <ul>{features.map(feature => {
        const enabled = featureEnabled(access, feature.key, now)
        return <li key={feature.key}><div><p>{feature.title}</p><span>{feature.description}</span></div><span className={enabled ? 'billing-feature-state is-enabled' : 'billing-feature-state'}>{enabled && <StampIcon kind="check" />}{enabled ? 'Enabled' : 'Not enabled'}</span></li>
      })}</ul>
      <p className="billing-note">DigiStamp manages these permissions. Viewing billing does not change your access.</p>
    </section>
    <BillingPackages />
    <footer className="billing-footer"><button type="button" className="wallet-refresh" onClick={() => void copySummary()}>Copy billing summary</button><p role="status" className={copyState === 'failed' ? 'error' : 'billing-note'}>{copyState === 'copied' ? 'Billing summary copied.' : copyState === 'failed' ? 'Could not copy. Select the billing details above to copy them manually.' : 'Share your current details with your DigiStamp administrator.'}</p></footer>
  </section>
}
