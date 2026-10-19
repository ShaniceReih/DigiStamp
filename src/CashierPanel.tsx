import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'
import { errorText } from './lib/loyalty'
import CustomerQrScanner from './CustomerQrScanner'
import StampIcon from './StampIcon'

export default function CashierPanel({ shopId, shopName }: { shopId: string; shopName: string }) {
  const [customerId, setCustomerId] = useState('')
  const [receipt, setReceipt] = useState('')
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const receiptRef = useRef<HTMLInputElement>(null)
  async function award(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setScanning(false)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('award_purchase_stamp', {
        p_shop_id: shopId, p_customer_id: customerId.trim(), p_receipt_reference: receipt.trim(),
      })
      if (error) throw error
      if (!data?.length) throw new Error('No confirmation received. Check the receipt before retrying.')
      setFailed(false)
      setMessage(`Stamp awarded. Customer balance: ${data[0].total_stamps}.`)
      setCustomerId('')
      setReceipt('')
      setScanMessage('')
    } catch (error) { setFailed(true); setMessage(errorText(error)) }
    finally { setSaving(false) }
  }
  return <section className="cashier-panel">
    <h2>Award a stamp</h2><p className="subtitle">{shopName} · Verify the purchase before crediting a stamp.</p>
    <button type="button" className="wallet-refresh scan-customer-button" disabled={saving || scanning} onClick={() => { setScanning(true); setScanMessage('') }}><StampIcon kind="qr" />Scan customer QR</button>
    {scanning && <CustomerQrScanner onClose={() => setScanning(false)} onDetected={id => { setCustomerId(id); setScanning(false); setMessage(''); setScanMessage('Customer QR scanned. Verify the purchase and enter the receipt to continue.'); receiptRef.current?.focus() }} />}
    {scanMessage && <p className="success" role="status">{scanMessage}</p>}
    <form onSubmit={award}>
      <fieldset disabled={saving}>
        <legend className="visually-hidden">Purchase details</legend>
        <label>Customer ID<input value={customerId} onChange={event => { setCustomerId(event.target.value); setScanMessage('') }} required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" placeholder="Scan a customer QR or paste their ID" /></label>
        <label>Receipt reference<input ref={receiptRef} value={receipt} onChange={event => setReceipt(event.target.value)} required minLength={4} maxLength={80} placeholder="Enter the purchase receipt number" /></label>
        <button type="submit" className="primary-button">{saving ? 'Awarding…' : 'Award 1 stamp'}</button>
      </fieldset>
    </form>
    {message && <p role="status" className={failed ? 'error' : 'success'}>{message}</p>}
    <p className="wallet-note">Each receipt can be credited once per café. Reward redemption is not available yet.</p>
  </section>
}
