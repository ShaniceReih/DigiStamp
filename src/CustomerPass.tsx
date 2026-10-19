import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from './lib/supabase'
import { customerQrValue } from './lib/customerQr'
import { errorText } from './lib/loyalty'

export default function CustomerPass({ userId }: { userId: string }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [copied, setCopied] = useState(false)
  const [username, setUsername] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data, error } = await supabase.from('profiles').select('customer_code, username').eq('id', userId).maybeSingle()
        if (error) throw error
        if (!data?.customer_code) throw new Error('Your customer ID is not available yet. Contact DigiStamp if this continues.')
        if (active) { setCode(data.customer_code); setUsername(data.username ?? '') }
      } catch (error) { if (active) setError(errorText(error)) }
    }
    void load()
    return () => { active = false }
  }, [userId, attempt])
  return <section className="customer-pass"><h3>Your customer QR</h3><p className="wallet-note">Show this code to the cashier to collect a stamp at any participating café.</p>
    {!code && !error && <p role="status" className="loading-state">Loading your customer ID…</p>}
    {code && <><div className="qr-image customer-qr"><QRCodeSVG value={customerQrValue(code)} size={220} level="M" marginSize={4} fgColor="#622b14" bgColor="#ffffff" title="Your DigiStamp customer QR code" /></div>
      <p className="wallet-note">A cashier must still verify your purchase.</p>{username && <><h3>Your username</h3><p className="customer-username">@{username}</p><p className="wallet-note">The cashier can use this username when your QR is unavailable.</p></>}<h3>Your customer ID</h3><code className="short-customer-code">{code}</code>
      <button type="button" className="wallet-refresh" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setError('') } catch { setError('Could not copy. Select your customer ID to copy it manually.') } }}>{copied ? 'Customer ID copied' : 'Copy customer ID'}</button></>}
    {error && <><p className="error" role="status">{error}</p>{!code && <button type="button" className="wallet-refresh" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button>}</>}
  </section>
}
