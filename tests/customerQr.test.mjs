import assert from 'node:assert/strict'
import test from 'node:test'
import { customerQrValue, parseCustomerQr } from '../src/lib/customerQr.ts'

const id = '10000000-0000-0000-0000-000000000003'

test('a customer QR round-trips the account ID without personal data', () => {
  const code = customerQrValue(id)
  assert.equal(parseCustomerQr(code), id)
  assert.equal(parseCustomerQr(`  ${code}\n`), id)
})

test('café links, raw IDs, credentials, and other QR versions are rejected', () => {
  for (const text of [id, 'https://digistamp.example/?shop=demo', 'javascript:alert(1)', '',
    `digistamp:customer:v2:${id}`, `digistamp:staff:v1:${id}`, `digistamp:customer:v1:${id}?admin=true`,
    'digistamp:customer:v1:not-a-customer', `digistamp:customer:v1:${id}\n${id}`]) {
    assert.equal(parseCustomerQr(text), null, text)
  }
})

test('invalid IDs cannot be encoded as customer cards', () => {
  assert.throws(() => customerQrValue('customer@example.com'))
  assert.throws(() => customerQrValue(id + '/extra'))
})

test('valid mixed-case UUIDs are normalized', () => {
  const uppercase = 'ABCDEF12-1234-5678-9012-ABCDEF123456'
  assert.equal(parseCustomerQr(customerQrValue(uppercase)), uppercase.toLowerCase())
})
