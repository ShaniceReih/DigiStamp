import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  try {
    const authorization = request.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Bearer ')) return respond({ error: 'Sign in to continue' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    const scoped = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
    const { data: { user }, error: authError } = await service.auth.getUser(authorization.slice(7))
    if (authError || !user) return respond({ error: 'Your session is invalid. Sign in again' }, 401)
    const body = await request.json()
    async function removeProfilePhoto(id: string) {
      const {error} = await service.storage.from('profile-photos').remove([`${id}/profile.jpg`])
      if (error) throw new Error('Could not remove the profile photo. Please retry account deletion.')
    }
    if (body.action === 'delete_self') {
      if (body.confirmation !== 'DELETE') return respond({ error: 'Type DELETE to confirm' }, 400)
      const check = await scoped.rpc('check_account_deletion', { p_user_id:user.id })
      if (check.error) return respond({ error:check.error.message },400)
      await removeProfilePhoto(user.id)
      const { error } = await service.auth.admin.deleteUser(user.id)
      if (error) return respond({ error: error.message }, 400)
      return respond({ success: true })
    }
    const { data: admin, error: adminError } = await scoped.rpc('is_platform_admin')
    if (adminError || admin !== true) return respond({ error: 'Administrator access required' }, 403)
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 5 || reason.length > 500) return respond({ error: 'Enter an audit reason (5–500 characters)' }, 400)
    const target = typeof body.user_id === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.user_id) ? body.user_id : null
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    async function audit(action: string, id = target) {
      const { error } = await scoped.rpc('admin_record_account_action', { p_target: id, p_action: action, p_details: { email }, p_reason: reason })
      if (error) throw error
    }
    if (body.action === 'delete_user' && target) {
      if (body.confirmation !== 'DELETE') return respond({ error: 'Type DELETE to confirm' }, 400)
      const check = await scoped.rpc('check_account_deletion', { p_user_id:target })
      if (check.error) return respond({ error:check.error.message },400)
      await audit('DELETE_REQUEST')
      await removeProfilePhoto(target)
      const { error } = await service.auth.admin.deleteUser(target)
      if (error) return respond({ error: error.message }, 400)
      return respond({ success: true })
    }
    if (body.action === 'update_email' && target) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return respond({ error: 'Enter a valid email address' }, 400)
      await audit('EMAIL_CHANGE_REQUEST')
      const { error } = await service.auth.admin.updateUserById(target, { email, email_confirm: false })
      if (error) return respond({ error: error.message }, 400)
      await audit('EMAIL_CHANGED')
      const { error: mailError } = await service.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
      return respond({ success: true, message: mailError ? 'Email updated, but the confirmation email could not be sent. Ask the account owner to contact support.' : 'Email updated. A confirmation link was sent to the new address.' })
    }
    if (body.action === 'invite_user') {
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
      const name = typeof body.full_name === 'string' ? body.full_name.trim() : ''
      if (!name || name.length > 120 || !/^[a-z][a-z0-9_]{2,39}$/.test(username) || !email) return respond({ error: 'Enter a full name, valid username, and email' }, 400)
      const { data: available } = await scoped.rpc('username_available', { p_username: username })
      const { data: exists } = await service.from('profiles').select('id').eq('username',username).maybeSingle()
      if (!available || exists) return respond({ error: 'This username is already taken or reserved' }, 400)
      await audit('INVITE_REQUEST', null)
      const { data, error } = await service.auth.admin.inviteUserByEmail(email, { data: { full_name: name, username } })
      if (error) return respond({ error: error.message }, 400)
      await audit('INVITED', data.user?.id ?? null)
      return respond({ success: true, message: 'Invitation sent. The user starts as a customer; assign staff or admin access separately.' })
    }
    return respond({ error: 'Unknown account action' }, 400)
  } catch (error) { return respond({ error: error instanceof Error ? error.message : 'Account request failed' }, 400) }
})
