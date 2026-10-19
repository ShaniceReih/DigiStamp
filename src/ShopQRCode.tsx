
import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from './lib/supabase'

type Shop = {
  id: string
  name: string
  qr_code: string | null
}

type Props = {
  userId: string
}

export default function ShopQRCode({ userId }: Props) {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    let active = true

    async function loadShops() {
      try {
        const { data: staff, error: staffError } =
          await supabase
            .from('shop_staff')
            .select('shop_id')
            .eq('user_id', userId)

        if (staffError) throw staffError
        if (!active) return

        const shopIds = (staff ?? []).map(s => s.shop_id)

        if (shopIds.length === 0) {
          setShops([])
          return
        }

        const { data, error: shopError } = await supabase
          .from('shops')
          .select('id, name, qr_code')
          .in('id', shopIds)

        if (shopError) throw shopError

        if (active) {
          setShops(data ?? [])
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            err !== null &&
            typeof err === 'object' &&
            'message' in err
              ? String(err.message)
              : 'Unable to load shops.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadShops()

    return () => {
      active = false
    }
  }, [userId])

  function createShopLink(slug: string) {
    const url = new URL('/', window.location.origin)
    url.searchParams.set('shop', slug)
    return url.toString()
  }

  async function copyLink(link: string, shopId: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(shopId)
    } catch {
      setError('Could not copy. Please copy the URL manually.')
    }
  }

  return (
    <section className="qr-panel">
      <h2>My Café QR Codes</h2>
      <p className="subtitle">
        Display your DigiStamp QR code at checkout.
      </p>

      {loading && <p className="loading-state" role="status">Loading QR codes...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && shops.length === 0 && !error && (
        <p>No assigned cafés found.</p>
      )}

      {shops.map(shop => {
        if (!shop.qr_code) {
          return (
            <p key={shop.id}>
              {shop.name}: No QR identifier assigned.
            </p>
          )
        }

        const link = createShopLink(shop.qr_code)

        return (
          <div className="qr-shop" key={shop.id}>
            <h3>{shop.name}</h3>

            <div className="qr-image">
              <QRCodeSVG
                value={link}
                fgColor="#622b14"
                size={210}
                level="M"
                marginSize={4}
                title={`QR code for ${shop.name}`}
              />
            </div>

            <p className="qr-link"><a href={link}>{link}</a></p>

            <button
              type="button"
              className="primary-button"
              onClick={() => void copyLink(link, shop.id)}
            >
              {copied === shop.id
                ? 'Link Copied!'
                : 'Copy Café Link'}
            </button>

            <p className="qr-hint">
              Scanning opens this café's DigiStamp page.
              It does not automatically award stamps.
            </p>
          </div>
        )
      })}
    </section>
  )
}
