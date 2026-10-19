export function normalizeUsername(value: string) { return value.trim().replace(/^@/, '').toLowerCase() }
export function usernameError(value: string) {
  const username = normalizeUsername(value)
  if (!/^[a-z][a-z0-9_]{2,39}$/.test(username)) return 'Use 3–40 characters: start with a letter, then letters, numbers, or underscores.'
  if (/^ds_\d+$/.test(username) || ['admin','administrator','root','support','digistamp','system','owner','cashier','customer','deleted'].includes(username)) return 'This username is reserved. Choose another.'
  return ''
}
