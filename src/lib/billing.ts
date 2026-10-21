import type { FeatureAccess } from './loyalty'
import { featureEnabled } from './loyalty.ts'

export const billingFeatures = [
  { key: 'custom_branding', title: 'Custom branding', description: 'Your caf\u00e9 colors, logo and stamp style.' },
  { key: 'custom_rewards', title: 'Reward editing', description: 'Create and update your caf\u00e9 rewards.' },
]

export type AccessSummary = { state: 'trial' | 'expired' | 'active' | 'disabled' | 'unknown'; label: string; description: string; trialEnd: string | null }

// Access is an entitlement, never evidence of a subscription or a payment.
export function describeAccess(access: FeatureAccess | null, now: number): AccessSummary {
  if (!access) return { state: 'unknown', label: 'Not configured', description: 'No access record is available for this café. Ask your DigiStamp administrator to review it.', trialEnd: null }
  if (access.status === 'active') return { state: 'active', label: 'Active', description: 'Continuing access has been enabled by DigiStamp. This does not confirm a paid subscription.', trialEnd: null }
  if (access.status === 'disabled') return { state: 'disabled', label: 'Disabled', description: 'Customization access is disabled. Ask your DigiStamp administrator about your access.', trialEnd: null }
  const end = Date.parse(access.trial_ends_at)
  if (!Number.isFinite(end)) return { state: 'unknown', label: 'Needs review', description: 'The trial end date is unavailable. Ask your DigiStamp administrator to review it.', trialEnd: null }
  const expired = end <= now
  return { state: expired ? 'expired' : 'trial', label: expired ? 'Trial ended' : 'Trial', description: expired ? 'Your trial has ended. Custom branding and reward editing are no longer available through this trial.' : 'Custom features are available until your trial ends, according to the access listed below.', trialEnd: access.trial_ends_at }
}

export function formatTrialEnd(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) + ' (Manila time)'
}

export function billingSummary(cafeName: string, access: FeatureAccess | null, now: number) {
  const summary = describeAccess(access, now)
  return [
    'DigiStamp billing summary',
    'Café: ' + cafeName,
    'Access: ' + summary.label,
    ...(summary.trialEnd ? [(summary.state === 'expired' ? 'Trial ended: ' : 'Trial ends: ') + formatTrialEnd(summary.trialEnd)] : []),
    ...billingFeatures.map(feature => feature.title + ': ' + (featureEnabled(access, feature.key, now) ? 'Enabled' : 'Not enabled')),
    'Subscription plan: Not set',
    'Price: Not set',
    'Payment collection: Not available in DigiStamp',
    'Invoice history: Not available in DigiStamp',
    'Access status does not confirm a payment. Any separate billing arrangement is not recorded here.',
  ].join('\n')
}
