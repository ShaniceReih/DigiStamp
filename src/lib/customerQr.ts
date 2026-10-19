const prefix = 'digistamp:customer:v1:'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function customerQrValue(customerId: string) {
  if (!uuid.test(customerId)) throw new Error('Invalid customer ID')
  return prefix + customerId.toLowerCase()
}

export function parseCustomerQr(value: string): string | null {
  const text = value.trim()
  if (!text.startsWith(prefix)) return null
  const customerId = text.slice(prefix.length)
  return uuid.test(customerId) ? customerId.toLowerCase() : null
}
