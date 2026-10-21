import StampIcon from './StampIcon'
import { cafeStyle } from './lib/loyalty'
import type { Cafe, Reward } from './lib/loyalty'

type Props = { cafe: Cafe; stamps: number; points?: number; rewards: Reward[]; showIdentity?: boolean }

export default function LoyaltyCard({ cafe, stamps, points, rewards, showIdentity = true }: Props) {
  const active = rewards.filter(reward => reward.is_active).sort((a, b) => a.required_stamps - b.required_stamps)
  const next = active.find(reward => reward.required_stamps > stamps) ?? active[active.length - 1]
  // Earned stamps remain visible even when no reward target is configured.
  const target = next?.required_stamps ?? 0
  const slots = target > 0 ? target : stamps
  return (
    <article className="wallet-cafe cafe-card" style={cafeStyle(cafe)} aria-label={`${cafe.name} stamp card`}>
      {showIdentity && <header className="cafe-card-header"><div className="cafe-identity">
        {cafe.logo_url ? <img className="cafe-logo" src={cafe.logo_url} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none' }} /> : <span className="cafe-logo-placeholder"><StampIcon kind="cafe" /></span>}
        <h3>{cafe.name}</h3>
      </div></header>}
      <div className="stamp-balance"><p><strong>{stamps}</strong><span>{stamps === 1 ? 'stamp collected' : 'stamps collected'}</span></p>{target > 0 && <span className="stamp-target">{Math.min(stamps, target)} / {target}</span>}</div>
      {slots > 0 && <div className="wallet-grid" role="img" aria-label={target > 0 ? `${Math.min(stamps, target)} of ${target} stamps toward ${next.title}` : `${stamps} earned stamps. No reward target configured.`}>
        {Array.from({ length: Math.min(slots, 20) }, (_, index) => (
          <span key={index} className={index < stamps ? 'wallet-stamp filled' : 'wallet-stamp'} aria-hidden="true">
            {index < stamps ? <StampIcon kind={cafe.stamp_icon} /> : index === target - 1 ? <StampIcon kind="gift" /> : <span className="stamp-slot-number">{index + 1}</span>}
          </span>
        ))}
      </div>}
      {target > 20 && <p className="reward-detail">{Math.min(stamps, target)} / {target} stamps · first 20 shown</p>}
      {!target && stamps > 20 && <p className="reward-detail">Showing 20 of {stamps} collected stamps.</p>}
      {!slots && <p className="card-empty-stamps">Your earned stamps will appear here.</p>}
      {next ? <div className="card-next-reward"><span className="card-reward-icon"><StampIcon kind="gift" /></span><div><h4>{next.title}</h4><p>{stamps >= target ? 'Stamp target reached' : `${target - stamps} more ${target - stamps === 1 ? 'stamp' : 'stamps'} to reach this reward`}</p></div>{stamps >= target && <span className="reward-reached"><StampIcon kind="check" /></span>}</div>
        : <p className="card-no-reward">Your stamps are saved. This café has not published a reward yet.</p>}
      {active.length > 1 && <details className="card-all-rewards"><summary>All café rewards ({active.length})</summary><ul className="reward-list">{active.map(reward => <li key={reward.id}>
        <span>{reward.title}</span><strong>{reward.required_stamps} stamps{stamps >= reward.required_stamps ? ' · Target reached' : ''}</strong>
      </li>)}</ul></details>}
      <footer className="cafe-card-footer">{points !== undefined && <p><span>Points</span><strong>{points}</strong></p>}{cafe.qr_code && <a href={`/?shop=${encodeURIComponent(cafe.qr_code)}`}>View café <span aria-hidden="true">→</span></a>}</footer>
    </article>
  )
}
