
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import CashierTest from './CashierTest'
import ShopQRCode from './ShopQRCode'

type RoleStatus = 'loading' | 'staff' | 'customer' | 'error'

type WalletRow = {
  shop_id: string
  stamps: number
  points: number
  shops: { name: string } | { name: string }[] | null
}

type Props = {
  userId: string
}

export default function DigiStampHome({ userId }: Props) {
  const [role, setRole] = useState<RoleStatus>('loading')
  const [wallet, setWallet] = useState<WalletRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  // Determine whether the signed-in user is staff
  useEffect(() => {
    let active = true

    async function checkRole() {
      setRole('loading')

      const { data, error } = await supabase
        .from('shop_staff')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['owner', 'cashier'])
        .limit(1)

      if (!active) return

      if (error) {
        setRole('error')
      } else {
        setRole(data && data.length > 0 ? 'staff' : 'customer')
      }
    }

    void checkRole()

    return () => {
      active = false
    }
  }, [userId])

  // Load the customer's real Supabase balances
  useEffect(() => {
    if (role !== 'customer') return

    let active = true

    async function loadWallet() {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('loyalty_accounts')
        .select('shop_id, stamps, points, shops(name)')
        .eq('customer_id', userId)

      if (!active) return

      if (error) {
        setError(error.message)
      } else {
        setWallet((data ?? []) as unknown as WalletRow[])
      }

      setLoading(false)
    }

    void loadWallet()

    return () => {
      active = false
    }
  }, [role, userId, refresh])

  if (role === 'loading') {
    return <p>Checking DigiStamp account...</p>
  }

  if (role === 'error') {
    return <p className="error">Unable to verify account permissions.</p>
  }

  // Staff interface
  if (role === 'staff') {
  return (
    <>
      <ShopQRCode userId={userId} />
      <CashierTest />
    </>
  )
}

  // Customer interface
  return (
    <section className="wallet">
      <div className="wallet-header">
        <h2>My Digital Stamps</h2>
        <button
          type="button"
          className="wallet-refresh"
          onClick={() => setRefresh(value => value + 1)}
        >
          Refresh
        </button>
      </div>

      {loading && <p>Loading your stamps...</p>}

      {error && (
        <p className="error">Unable to load wallet: {error}</p>
      )}

      {!loading && !error && wallet.length === 0 && (
        <div className="wallet-cafe">
          <h3>No stamps yet!</h3>
          <p>Visit a participating cafe to start earning rewards.</p>
        </div>
      )}

      {!loading && !error && wallet.map(account => {
        const shopName = Array.isArray(account.shops)
          ? account.shops[0]?.name
          : account.shops?.name

        return (
          <div className="wallet-cafe" key={account.shop_id}>
            <h3>{shopName ?? 'Participating Cafe'}</h3>

            <p className="wallet-count">
              {account.stamps} Digital Stamp(s)
            </p>

            <div className="wallet-grid">
              {Array.from({ length: 10 }, (_, index) => (
                <div
                  key={index}
                  className={
                    index < Math.min(account.stamps, 10)
                      ? 'wallet-stamp filled'
                      : 'wallet-stamp'
                  }
                  aria-label={
                    index < Math.min(account.stamps, 10)
                      ? 'Earned stamp'
                      : 'Empty stamp'
                  }
                >
                  {index < Math.min(account.stamps, 10) ? '★' : '☆'}
                </div>
              ))}
            </div>

            <p className="wallet-points">
              Points: {account.points}
            </p>

            <small>10-stamp display is a demo milestone.</small>
          </div>
        )
      })}

      <p className="wallet-note">
        Stamps are credited after an authorized cashier
        verifies your purchase. Reward redemption is
        coming soon!
      </p>
    </section>
  )
}
