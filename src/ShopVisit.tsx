
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import StampIcon from './StampIcon'
import LoyaltyCard from './LoyaltyCard'
import { cafeColumns } from './lib/loyalty'
import type { Cafe, Reward } from './lib/loyalty'

type Balance = {
  stamps: number
  points: number
}

type Props = {
  userId: string
  shopSlug: string
}

export default function ShopVisit({
  userId,
  shopSlug,
}: Props) {
  const [shop, setShop] = useState<Cafe | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadShop() {
      setLoading(true)
      setError('')
      setShop(null)
      setBalance(null)
      setRewards([])

      try {
        const { data: shopData, error: shopError } =
          await supabase
            .from('shops')
            .select(cafeColumns)
            .eq('qr_code', shopSlug)
            .maybeSingle()

        if (shopError) throw shopError
        if (!active) return

        if (!shopData) {
          setError('Café not found.')
          return
        }

        setShop(shopData)

        const { data: loyalty, error: loyaltyError } =
          await supabase
            .from('loyalty_accounts')
            .select('stamps, points')
            .eq('shop_id', shopData.id)
            .eq('customer_id', userId)
            .maybeSingle()

        if (loyaltyError) throw loyaltyError

        const { data: offers, error: rewardError } = await supabase.from('rewards')
          .select('id, shop_id, title, required_stamps, is_active').eq('shop_id', shopData.id).eq('is_active', true)
        if (rewardError) throw rewardError

        if (active) {
          setBalance(loyalty)
          setRewards((offers ?? []) as Reward[])
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            err !== null &&
            typeof err === 'object' &&
            'message' in err
              ? String(err.message)
              : 'Unable to load café.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadShop()

    return () => {
      active = false
    }
  }, [userId, shopSlug])

  return (
    <section className="shop-visit">
      <a className="back-link" href="/">
        ← Back to My DigiStamp
      </a>

      {loading && <p className="loading-state" role="status">Loading café...</p>}

      {error && <><h1>Café unavailable</h1><p className="error" role="alert">{error}</p></>}

      {!loading && !error && shop && (
        <>
          <div className="shop-icon"><StampIcon kind="cafe" /></div>

          <h1>{shop.name}</h1>
          <p className="subtitle">
            {shop.address || 'DigiStamp Partner Café'}
          </p>

          {shop.description && (
            <p>{shop.description}</p>
          )}

          <LoyaltyCard cafe={shop} stamps={balance?.stamps ?? 0} points={balance?.points ?? 0} rewards={rewards} />

          <p className="shop-instruction">
            Show your purchase to the cashier.
            Your digital stamp will be added after
            the cashier verifies your transaction.
          </p>
        </>
      )}
    </section>
  )
}
