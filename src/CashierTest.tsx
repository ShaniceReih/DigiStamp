
import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'

export default function CashierTest() {
  const [customerId, setCustomerId] = useState('')
  const [receipt, setReceipt] = useState('DEMO-0001')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function awardStamp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loading) return

    setLoading(true)
    setMessage('Verifying purchase...')

    try {
      // Step 1: Find the demo cafe
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('qr_code', 'digistamp-demo-cafe')
        .single()

      if (shopError) {
        throw shopError
      }

      if (!shop) {
        throw new Error('Demo cafe not found.')
      }

      // Step 2: Award stamp using secure Supabase RPC
      const { data, error } = await supabase.rpc(
        'award_purchase_stamp',
        {
          p_shop_id: shop.id,
          p_customer_id: customerId.trim(),
          p_receipt_reference: receipt.trim(),
        }
      )

      if (error) {
        throw error
      }

      // Step 3: Validate the result
      if (!data || data.length === 0) {
        throw new Error('No transaction result returned.')
      }

      // Step 4: Display successful result
      setMessage(
        `Success! Customer now has ${data[0].total_stamps} stamp(s).`
      )

    } catch (error: unknown) {
      // Handle all types of Supabase errors
      console.error('DigiStamp Error:', error)

      let errorMessage = 'Unknown error'

      if (error instanceof Error) {
        errorMessage = error.message
      } else if (
        error !== null &&
        typeof error === 'object' &&
        'message' in error
      ) {
        errorMessage = String(error.message)
      } else {
        errorMessage = String(error)
      }

      setMessage(`Error: ${errorMessage}`)

    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="cashier-panel">
      <h2>Cashier Testing Panel</h2>
      <p className="subtitle">DigiStamp Demo Café</p>

      <form onSubmit={awardStamp}>
        <label>
          Customer User ID
          <input
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="Paste customer UUID"
            required
          />
        </label>

        <label>
          Receipt Reference
          <input
            type="text"
            value={receipt}
            onChange={(e) => setReceipt(e.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          className="primary-button"
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Award 1 Stamp'}
        </button>
      </form>

      {message && (
        <p role="status" className={message.startsWith('Error:') ? 'error' : message.startsWith('Success!') ? 'success' : 'status-message'}>
          {message}
        </p>
      )}
    </section>
  )
}
