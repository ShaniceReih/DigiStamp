
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type Shop = {
  id: string
  name: string
  description: string | null
  address: string | null
}

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
  const [shop, setShop] = useState<Shop | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadShop() {
      setLoading(true)
      setError('')

      try {
        const { data: shopData, error: shopError } =
          await supabase
            .from('shops')
            .select('id, name, description, address')
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

        if (active) {
          setBalance(loyalty)
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

      {loading && <p>Loading café...</p>}

      {error && <p className="error">{error}</p>}

      {!loading && !error && shop && (
        <>
          <div className="shop-icon">☕</div>

          <h2>{shop.name}</h2>
          <p className="subtitle">
            {shop.address || 'DigiStamp Partner Café'}
          </p>

          {shop.description && (
            <p>{shop.description}</p>
          )}

          <div className="wallet-cafe">
            <h3>Your Loyalty Card</h3>

            <p className="wallet-count">
              {balance?.stamps ?? 0} Digital Stamp(s)
            </p>

            <div className="wallet-grid">
              {Array.from({ length: 10 }, (_, index) => (
                <div
                  key={index}
                  className={
                    index < Math.min(balance?.stamps ?? 0, 10)
                      ? 'wallet-stamp filled'
                      : 'wallet-stamp'
                  }
                >
                  {index < Math.min(balance?.stamps ?? 0, 10)
                    ? '★'
                    : '☆'}
                </div>
              ))}
            </div>

            <p className="wallet-points">
              Points: {balance?.points ?? 0}
            </p>
          </div>

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
