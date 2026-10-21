import test from 'node:test'
import assert from 'node:assert/strict'
import { billingSummary, describeAccess, formatTrialEnd } from '../src/lib/billing.ts'
import { featureEnabled } from '../src/lib/loyalty.ts'

const now = Date.parse('2026-10-21T04:00:00Z')
const trial = { status: 'trial', trial_ends_at: '2026-10-21T04:00:01Z', features: ['custom_branding', 'custom_rewards'] }

test('trial access ends at the same instant as the entitlement gate', () => {
  assert.equal(describeAccess(trial, now).state, 'trial')
  const expiry = Date.parse(trial.trial_ends_at)
  assert.equal(describeAccess(trial, expiry).state, 'expired')
  assert.equal(featureEnabled(trial, 'custom_branding', expiry), false)
  assert.match(billingSummary('Test Cafe', trial, expiry), /Trial ended:/)
  assert.match(billingSummary('Test Cafe', trial, expiry), /Custom branding: Not enabled/)
})

test('active access never claims a payment or paid plan', () => {
  const access = { ...trial, status: 'active', trial_ends_at: '2020-01-01T00:00:00Z' }
  assert.equal(describeAccess(access, now).state, 'active')
  assert.equal(describeAccess(access, now).trialEnd, null)
  assert.match(describeAccess(access, now).description, /does not confirm a paid subscription/)
  assert.match(billingSummary('Test Cafe', access, now), /Price: Not set/)
})

test('missing or invalid trial data is unknown rather than free or active', () => {
  assert.equal(describeAccess(null, now).state, 'unknown')
  assert.equal(describeAccess({ ...trial, trial_ends_at: 'invalid' }, now).state, 'unknown')
  assert.doesNotMatch(billingSummary('Test Cafe', null, now), /\bFree\b|\bPaid\b|Invalid Date/)
})

test('disabled access and individually granted features remain distinct', () => {
  const disabled = { ...trial, status: 'disabled' }
  assert.equal(describeAccess(disabled, now).state, 'disabled')
  assert.match(billingSummary('Test Cafe', disabled, now), /Custom branding: Not enabled/)
  const partial = { ...trial, status: 'active', features: ['custom_rewards'] }
  const text = billingSummary('Test Cafe', partial, now)
  assert.match(text, /Custom branding: Not enabled/)
  assert.match(text, /Reward editing: Enabled/)
})

test('trial dates use Manila time on any device timezone', () => {
  const text = formatTrialEnd('2026-10-21T23:30:00Z')
  assert.match(text, /22/)
  assert.match(text, /7:30/)
  assert.match(text, /Manila time/)
})
