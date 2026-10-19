import { useEffect, useId, useState } from 'react'
import { supabase } from './lib/supabase'
import { normalizeUsername, usernameError } from './lib/usernames'

export default function UsernameField({ value, onChange, current = '' }: { value: string; onChange: (value: string) => void; current?: string }) {
  const id = useId()
  const [result, setResult] = useState<{ value: string; available: boolean | null }>({ value: '', available: null })
  const normalized = normalizeUsername(value)
  const unchanged = normalized === current && !!current
  const invalid = unchanged ? '' : usernameError(value)
  useEffect(() => {
    if (!normalized || invalid || unchanged) return
    let active = true
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { p_username: normalized })
      if (active) setResult({ value: normalized, available: error ? null : data === true })
    }, 400)
    return () => { active = false; clearTimeout(timer) }
  }, [normalized, invalid, unchanged])
  const checked = result.value === normalized
  const taken = !invalid && !unchanged && checked && result.available === false
  return <label>Username<input aria-label="Username" value={value} onChange={event => onChange(event.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={40} placeholder="Choose a unique username" aria-describedby={id} aria-invalid={!!value && (!!invalid || taken)} />
    <span id={id} className={taken || (value && invalid) ? 'field-feedback field-invalid' : 'field-feedback'} role="status">{!value ? 'Unique across DigiStamp. Uppercase and lowercase count as the same name.' : unchanged ? 'Your current username.' : invalid || (checked ? result.available === null ? 'Could not check availability. We will check when you save.' : result.available ? 'Username is available.' : 'This username is already taken.' : 'Checking availability…')}</span>
  </label>
}
