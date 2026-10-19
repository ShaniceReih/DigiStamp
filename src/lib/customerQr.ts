const prefix = 'digistamp:customer:v1:'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const code = /^DS-[0-9]{6,19}$/i

export function isCustomerCode(value: string) { return code.test(value) }

export function customerQrValue(customerId: string) {
  if (code.test(customerId)) return 'digistamp:customer:v2:' + customerId.toUpperCase()
  if (!uuid.test(customerId)) throw new Error('Invalid customer ID')
  return prefix + customerId.toLowerCase()
}

export function parseCustomerQr(value: string): string | null {
  const text = value.trim()
  if (text.startsWith('digistamp:customer:v2:')) {
    const customerCode = text.slice('digistamp:customer:v2:'.length)
    return code.test(customerCode) ? customerCode.toUpperCase() : null
  }
  if (!text.startsWith(prefix)) return null
  const customerId = text.slice(prefix.length)
  return uuid.test(customerId) ? customerId.toLowerCase() : null
}
