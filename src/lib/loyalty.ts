import type { CSSProperties } from 'react'

export type Cafe = {
  id: string
  name: string
  description?: string | null
  address?: string | null
  qr_code: string | null
  brand_color: string
  card_color: string
  logo_url: string | null
  stamp_icon: 'check' | 'star' | 'cafe'
}
export type Reward = { id: string; shop_id: string; title: string; required_stamps: number; is_active: boolean }
export type FeatureAccess = { status: 'trial' | 'active' | 'disabled'; trial_ends_at: string; features: string[] }
export const cafeColumns = 'id, name, description, address, qr_code, brand_color, card_color, logo_url, stamp_icon'

export function featureEnabled(access: FeatureAccess | null, feature: string, now: number) {
  return !!access && access.features.includes(feature) && (
    access.status === 'active' || (access.status === 'trial' && Date.parse(access.trial_ends_at) > now)
  )
}

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map(channel => {
    const value = parseInt(channel, 16) / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}

export function cafeStyle(cafe: Cafe): CSSProperties {
  const paper = /^#[\da-f]{6}$/i.test(cafe.card_color) ? cafe.card_color : '#FBF6E8'
  const brand = /^#[\da-f]{6}$/i.test(cafe.brand_color) ? cafe.brand_color : '#995F2F'
  const light = luminance(paper)
  const text = light > .179 ? '#241b15' : '#ffffff'
  const contrast = (Math.max(light, luminance(brand)) + .05) / (Math.min(light, luminance(brand)) + .05)
  return { '--cafe-paper': paper, '--cafe-ink': text, '--cafe-brand': contrast >= 4.5 ? brand : text } as CSSProperties
}

export function errorText(error: unknown) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unable to complete the request. Please try again.'
}
