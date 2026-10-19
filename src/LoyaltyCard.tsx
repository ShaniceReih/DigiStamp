import StampIcon from './StampIcon'
import { cafeStyle } from './lib/loyalty'
import type { Cafe, Reward } from './lib/loyalty'

type Props = { cafe: Cafe; stamps: number; points?: number; rewards: Reward[] }

export default function LoyaltyCard({ cafe, stamps, points, rewards }: Props) {
  const active = rewards.filter(reward => reward.is_active).sort((a, b) => a.required_stamps - b.required_stamps)
  const next = active.find(reward => reward.required_stamps > stamps) ?? active[active.length - 1]
  // Earned stamps remain visible even when no reward target is configured.
  const target = next?.required_stamps ?? 0
  const slots = target > 0 ? target : stamps
  return (
    <article className="wallet-cafe cafe-card" style={cafeStyle(cafe)}>
      <div className="cafe-identity">
        {cafe.logo_url ? <img className="cafe-logo" src={cafe.logo_url} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none' }} /> : <span className="cafe-logo-placeholder"><StampIcon kind="cafe" /></span>}
        <h3>{cafe.name}</h3>
      </div>
      <p className="wallet-count">{stamps} {stamps === 1 ? 'stamp' : 'stamps'} collected{target > 0 ? ` · Target: ${target} for ${next.title}` : ''}</p>
      {slots > 0 && <div className="wallet-grid" aria-label={target > 0 ? `${Math.min(stamps, target)} of ${target} stamps toward ${next.title}` : `${stamps} earned stamps. No reward target configured.`}>
        {Array.from({ length: Math.min(slots, 20) }, (_, index) => (
          <span key={index} className={index < stamps ? 'wallet-stamp filled' : 'wallet-stamp'} aria-hidden="true">
            {index < stamps ? <StampIcon kind={cafe.stamp_icon} /> : index === target - 1 ? <StampIcon kind="star" /> : null}
          </span>
        ))}
      </div>}
      {target > 20 && <p className="reward-detail">{Math.min(stamps, target)} / {target} stamps · first 20 shown</p>}
      {!target && stamps > 20 && <p className="reward-detail">Showing 20 of {stamps} collected stamps.</p>}
      {!active.length && <p className="reward-detail">This café has not published a reward yet.</p>}
      {active.length > 0 && <ul className="reward-list">{active.map(reward => <li key={reward.id}>
        <span>{reward.title}</span><strong>{reward.required_stamps} stamps{stamps >= reward.required_stamps ? ' · Target reached' : ''}</strong>
      </li>)}</ul>}
      {points !== undefined && <p className="wallet-points">Points: {points}</p>}
    </article>
  )
}
