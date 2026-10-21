export type PackageFeature = { name: string; comingSoon?: boolean }
export type BillingPackage = { name: string; monthlyPrice: number; includes?: string; features: PackageFeature[]; note?: string }

// Catalog prices do not assign a subscription or grant access to a cafe.
export const billingPackages: BillingPackage[] = [
  { name: 'Starter', monthlyPrice: 499, features: [
    { name: 'Digital stamps' },
    { name: 'One mini-game', comingSoon: true },
    { name: 'Basic rewards' },
    { name: 'Monthly summary', comingSoon: true },
    { name: 'DigiStamp branding' },
  ] },
  { name: 'Growth', monthlyPrice: 899, includes: 'Starter', features: [
    { name: 'Shop branding' },
    { name: 'Multiple games', comingSoon: true },
    { name: 'Reward customization' },
    { name: 'Retention analytics', comingSoon: true },
  ] },
  { name: 'Premium', monthlyPrice: 1499, includes: 'Growth', features: [], note: 'Additional Premium features coming soon.' },
]

export const customizationServices = [
  { name: 'Basic setup and logo integration', fee: 'Free with Growth / Premium' },
  { name: 'Custom colors and interface theme', minimum: 500, maximum: 1000 },
  { name: 'Custom mini-game design', minimum: 1500, maximum: 3000, note: 'Coming soon' },
  { name: 'Full custom business interface', fee: 'Quotation-based' },
  { name: 'Optional tablet kiosk', fee: 'Separate rental or setup quotation', note: 'Coming soon' },
]

export function formatPesos(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}
